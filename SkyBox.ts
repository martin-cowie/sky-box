import axios from 'axios';
import {useNamespaces} from 'xpath';
import {DOMParser} from 'xmldom';

import {Item} from './Item';
import {decodeXml, SKY_BROWSE_URN} from './Common';
import {readFileSync} from 'fs';

const SOAP_URL = "http://schemas.xmlsoap.org/soap/envelope/";

//TODO: figure out how to apply XPath regardless of name-spaces
//TODO: remove hack, replace explicit namespace with prefix `X` with the default namespace
const XPATH_EXPR = `/X:root/X:device/X:serviceList/X:service[X:serviceType/text()='${SKY_BROWSE_URN}']/X:controlURL/text()`;
const BROWSE_ACTION = "\"urn:schemas-nds-com:service:SkyBrowse:2#Browse\"";
const DESTROY_ACTION = "\"urn:schemas-nds-com:service:SkyBrowse:2#DestroyObject\"";

/**
 * Encapsulate SkyPlus (a.k.a. 'SkyBox') functionality.
 */
export interface SkyBox {
    fetchAllItems(): Promise<Item[]>;

    deleteItems(items: Item[]): Promise<void>;
}

export namespace SkyBox {
    /**
     * Factory method. Resolve a SkyBrowse URL to a SkyBox object.
     * @param {String} location
     */
    export async function from(location: string): Promise<SkyBox> {
        const response = await axios.get(location);

        // TODO: This XML & XPath ugliness could be replaced with browser APIs
        const doc = new DOMParser().parseFromString(response.data);
        const select = useNamespaces({'X': 'urn:schemas-upnp-org:device-1-0'});
        const nodes = select(XPATH_EXPR, doc);
        const path = nodes[0].toString();

        const postURL = new URL(path, location);
        return new SkyBoxImpl(postURL);
    }

    export async function fromTestData(filename: string): Promise<SkyBox>  {
        return new SkyBoxTestImpl(filename);
    }
}

class SkyBoxTestImpl implements SkyBox {

    private xmlSource: string;
    private items: Item[];

    constructor(private filename: string) {
        this.xmlSource = String(readFileSync(filename));
        
        const contentDoc = new DOMParser().parseFromString(this.xmlSource);

        //-------------------------------
        // Build a result
        const items = Array
            .from(contentDoc.documentElement.getElementsByTagName('item'))
            .map(itemElement => Item.from(itemElement));

        // Remove null items (items that haven't been recorded yet)
        this.items = items.filter(item => item) as Item[];
    }

    toString(): string {
        return this.filename;
    }

    async fetchAllItems(): Promise<Item[]> {
        return this.items;
    }

    async deleteItems(items: Item[]): Promise<void> {
        const idsToRemove = new Set(items.map(i => i.id));
        this.items = this.items.filter(i => !idsToRemove.has(i.id));
    }

}

class SkyBoxImpl implements SkyBox {

    private postURL: URL;

    constructor(postURL: URL) {
        this.postURL = postURL;
    }

    toString() {
        return `SkyBox at ` + this.postURL.hostname;
    }

    private createElem (elemType: string, parentNode: Node, document: Document, ns?: string): Element {
        const elem = ns ? document.createElementNS(ns, elemType) : document.createElement(elemType);
        parentNode.appendChild(elem);
        return elem;
    };


    private buildFetchRequest(objectID: string, startIndex: number, requestCount: number): string {
        const result = document.implementation.createDocument("", "", null);

        const envelopeElem = this.createElem("s:Envelope", result, result, SOAP_URL);
        const bodyElem = this.createElem("s:Body", envelopeElem, result, SOAP_URL);
        const browseElem = this.createElem("u:Browse", bodyElem, result, SKY_BROWSE_URN);

        envelopeElem.setAttributeNS(SOAP_URL, "s:encodingStyle", "http://schemas.xmlsoap.org/soap/encoding");

        Object.entries({
            ObjectID: objectID,
            BrowseFlag: 'BrowseDirectChildren',
            Filter: '*',
            StartingIndex: startIndex,
            RequestedCount: requestCount,
            SortCriteria: null
        }).forEach(([key, value]) => {
            const elem = this.createElem(key, browseElem, result);
            if (value !== null) {
                const text = document.createTextNode(String(value));
                elem.appendChild(text);
            }
        });

        return new XMLSerializer().serializeToString(result);
    }

    private buildDeleteRequest(objectID: string): string {
        var result = document.implementation.createDocument("", "", null);

        const envelopeElem = this.createElem("s:Envelope", result, result, SOAP_URL);
        const bodyElem = this.createElem("s:Body", envelopeElem, result, SOAP_URL);
        const destroyElem = this.createElem("u:DestroyObject", bodyElem, result, SKY_BROWSE_URN);
        const objectIDElem = this.createElem("ObjectID", destroyElem, result);

        const text = document.createTextNode(objectID);
        objectIDElem.appendChild(text);

        return new XMLSerializer().serializeToString(result);
    }

    /**
     * @param {URL} postURL
     * @param {Number} startIndex
     * @returns tuple [Array of Items, total number of items matching]
     */
    private async fetchItems(postURL: URL, startIndex: number): Promise<[(Item|null)[], number]> {

        //-------------------------------
        // Compose & send the request

        const objectID = "3"; // FIXME: resolve this magic number
        const requestCount = 25;

        const request = this.buildFetchRequest(objectID, startIndex, requestCount);
        console.debug(`Fetch request `, request);

        const response = await axios.post(postURL.toString(), request, {
            headers: {
                SOAPACTION: BROWSE_ACTION,
                'Content-Type': "text/xml"
            }
        });

        //-------------------------------
        // Handle the response, which is doubley-wrapped XML
        const RESULT_TEXT = "/s:Envelope/s:Body/u:BrowseResponse/Result/text()";
        const TOTAL_MATCHES_TEXT = "/s:Envelope/s:Body/u:BrowseResponse/TotalMatches/text()";

        const select = useNamespaces({
            's': SOAP_URL,
            'u': SKY_BROWSE_URN
        });

        const responseDoc = new DOMParser().parseFromString(response.data);
        const contentNodes = select(RESULT_TEXT, responseDoc);
        const totalMatchesNodes = select(TOTAL_MATCHES_TEXT, responseDoc);
        const xmlSource = decodeXml(contentNodes[0].toString());
        const contentDoc = new DOMParser().parseFromString(xmlSource);
        const totalMatches = parseInt(totalMatchesNodes[0].toString());

        //-------------------------------
        // Build a result
        const items = Array
            .from(contentDoc.documentElement.getElementsByTagName('item'))
            .map(itemElement => Item.from(itemElement));
        return [items, totalMatches];
    }

    /**
     * @returns Array<Item> from this SkyBox
     */
    async fetchAllItems(): Promise<Item[]> {
        console.debug(`fetchAllItems(${this.postURL.toString()})`);

        const result: (Item|null)[] = [];
        const [items, totalItems] = await this.fetchItems(this.postURL, 0);
        result.push(...items);
        console.debug(`Query matches total of ${totalItems}, response contains ${items.length} items`);

        while(result.length < totalItems) {
            const [moreItems,] = await this.fetchItems(this.postURL, result.length);
            result.push(...moreItems);
            console.log(`${result.length}/${totalItems}`);
        }

        // Remove null items (items that haven't been recorded yet)
        return result.filter(item => item) as Item[];
    }

    public async deleteItems(items: Item[]): Promise<void> {
        for (const item of items) {
            const request = this.buildDeleteRequest(item.id);
            console.debug(`Delete request `, request);
        
            const response = await axios.post(this.postURL.toString(), request, {
                headers: {
                    SOAPACTION: DESTROY_ACTION,
                    'Content-Type': "text/xml"
                }
            });

            if (response.status != 200) {
                throw new Error(`Cannot remove ${item.id}`); //FIXME: something better
            }
        };
    }


}