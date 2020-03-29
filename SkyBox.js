const axios = require('axios').default;
const xpath = require('xpath');
const dom = require('xmldom').DOMParser;
const type = require('typeof-arguments');

import {Item} from './Item.js';
import {decodeXml, SKY_BROWSE_URN} from './Common.js';

const SOAP_URL = "http://schemas.xmlsoap.org/soap/envelope/";

//TODO: figure out how to apply XPath regardless of name-spaces
//TODO: remove hack, replace explicit namespace with prefix `X` with the default namespace
const XPATH_EXPR = `/X:root/X:device/X:serviceList/X:service[X:serviceType/text()='${SKY_BROWSE_URN}']/X:controlURL/text()`;
const BROWSE_ACTION = "\"urn:schemas-nds-com:service:SkyBrowse:2#Browse\"";

/**
 * Encapsulate SkyPlus (a.k.a. 'SkyBox') functionality.
 */
export class SkyBox {
    constructor(postURL) {
        type(arguments, [URL]);
        this.postURL = postURL;
    }

    toString() {
        return `SkyBox at ` + this.postURL.hostname;
    }

    /**
     * Factory method. Resolve a SkyBrowse URL to a SkyBox object.
     * @param {String} location 
     */
    static async from(location) {
        type(arguments, [String]);
        const response = await axios.get(location);

        // TODO: This XML & XPath ugliness could be replaced with browser APIs
        const doc = new dom().parseFromString(response.data);
        const select = xpath.useNamespaces({'X': 'urn:schemas-upnp-org:device-1-0'});
        const nodes = select(XPATH_EXPR, doc);
        const path = nodes[0].toString();

        const postURL = new URL(path, location);
        return new SkyBox(postURL);
    }

    /**
     * Build an XML request.
     * @param {Number} objectID
     * @param {Number} startIndex
     * @param {Number} requestCount
     */
    _buildRequest(objectID, startIndex, requestCount) {
        var result = document.implementation.createDocument("", "", null);

        const createElem = (elemType, parentNode, ns) => {
            var elem = ns ? result.createElementNS(ns, elemType) : result.createElement(elemType);
            parentNode.appendChild(elem);
            return elem;
        };

        const envelopeElem = createElem("s:Envelope", result, SOAP_URL);
        const bodyElem = createElem("s:Body", envelopeElem, SOAP_URL);
        const browseElem = createElem("u:Browse", bodyElem, SKY_BROWSE_URN);

        envelopeElem.setAttributeNS(SOAP_URL, "s:encodingStyle", "http://schemas.xmlsoap.org/soap/encoding");

        Object.entries({
            ObjectID: objectID,
            BrowseFlag: 'BrowseDirectChildren',
            Filter: '*',
            StartingIndex: startIndex,
            RequestedCount: requestCount,
            SortCriteria: null
        }).forEach(([key, value]) => {
            const elem = createElem(key, browseElem);
            if (value !== null) {
                const text = document.createTextNode(value);
                elem.appendChild(text);
            }
        });

        return new XMLSerializer().serializeToString(result);
    }

    /**
     * @param {URL} postURL
     * @param {Number} startIndex
     * @returns tuple [Array of Items, total number of items matching]
     */
    async _fetchItems(postURL, startIndex) {
        type(arguments, [URL, Number]);

        //-------------------------------
        // Compose & send the request

        const objectID = 3; // FIXME: resolve this magic number
        const requestCount = 25;

        const request = this._buildRequest(objectID, startIndex, requestCount);
        console.debug(`XML request `, request);

        const response = await axios.post(postURL, request, {
            headers: {
                SOAPACTION: BROWSE_ACTION,
                'Content-Type': "text/xml"
            }
        });

        //-------------------------------
        // Handle the response
        const RESULT_TEXT = "/s:Envelope/s:Body/u:BrowseResponse/Result/text()";
        const TOTAL_MATCHES_TEXT = "/s:Envelope/s:Body/u:BrowseResponse/TotalMatches/text()";

        const select = xpath.useNamespaces({
            's': SOAP_URL,
            'u': SKY_BROWSE_URN
        });

        const responseDoc = new dom().parseFromString(response.data);
        const contentNodes = select(RESULT_TEXT, responseDoc);
        const totalMatchesNodes = select(TOTAL_MATCHES_TEXT, responseDoc);
        const xmlSource = decodeXml(contentNodes[0].toString());
        const contentDoc = new dom().parseFromString(xmlSource);
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
    async fetchAllItems() {
        console.debug(`fetchAllItems(${this.postURL.toString()})`);

        const result = [];
        const [items, totalItems] = await this._fetchItems(this.postURL, 0);
        result.push(...items);
        console.debug(`Query matches total of ${totalItems}, response contains ${items.length} items`);

        while(result.length < totalItems) {
            const [moreItems, _] = await this._fetchItems(this.postURL, result.length);
            result.push(...moreItems);
            console.log(`${result.length}/${totalItems}`);
        }

        // Remove items that haven't been recorded yet
        return result.filter(item => item);
    }

}