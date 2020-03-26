//TODO: make table sortable, and groupable on series/genre

const {Client} = require('node-ssdp');
const axios = require('axios').default;
const xpath = require('xpath');
const dom = require('xmldom').DOMParser;
const type = require('typeof-arguments');
const moment = require('moment');

import {Item} from './Item.js'
import {decodeXml} from './Common.js';

const SOAP_URL = "http://schemas.xmlsoap.org/soap/envelope/";
const SKY_BROWSE_URN = 'urn:schemas-nds-com:service:SkyBrowse:2';

//TODO: figure out how to apply XPath regardless of name-spaces
//TODO: remove hack, replace explicit namespace with prefix `X` with the default namespace
const XPATH_EXPR = `/X:root/X:device/X:serviceList/X:service[X:serviceType/text()='${SKY_BROWSE_URN}']/X:controlURL/text()`;
const BROWSE_ACTION = "\"urn:schemas-nds-com:service:SkyBrowse:2#Browse\"";

/**
 * Build an XML request.
 * @param {Number} objectID
 * @param {Number} startIndex
 * @param {Number} requestCount
 */
function buildRequest(objectID, startIndex, requestCount) {
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

async function fetchAllItems(postURL) {
    console.debug(`fetchAllItems(${postURL.toString()})`);

    const result = [];
    const [items, totalItems] = await fetchItems(postURL, 0);
    result.push(...items);
    console.debug(`Query matches total of ${totalItems}, response contains ${items.length} items`);

    while(result.length < totalItems) {
        const [moreItems, _] = await fetchItems(postURL, result.length);
        result.push(...moreItems);
        console.log(`${result.length}/${totalItems}`);
    }

    // Remove items that haven't been recorded yet
    return result.filter(item => item);
}

/**
 *
 * @param {URL} postURL
 * @param {Number} startIndex
 * @returns tuple [Array of Items, total number of items matching]
 */
async function fetchItems(postURL, startIndex) {
    type(arguments, [URL, Number]);

    //-------------------------------
    // Compose & send the request

    const objectID = 3; // FIXME: resolve this magic number
    const requestCount = 25;

    const request = buildRequest(objectID, startIndex, requestCount);
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

function populateTable(tableElem, items) {
    type(arguments, [HTMLTableElement, Array]);

    const newHeader = document.createElement('thead');
    Item.createHeaders(newHeader);
    tableElem.tHead.replaceWith(newHeader);

    const newBody = document.createElement('tbody');
    items.forEach(item => item.toRows(newBody));
    tableElem.tBodies[0].replaceWith(newBody);

    tableElem.style.visibility = 'visible';
}

function populateSummary(summaryElem, items) {
    const totalDuration = moment.duration(items.reduce((acc, item) => acc + item.recordedDuration, 0), 'seconds');
    const totalUnwatchedDuration = moment.duration(items.reduce((acc, item) => item.viewed ? acc : acc + item.recordedDuration, 0), 'seconds');

    summaryElem.innerText = `You have ${totalDuration.humanize()} of recordings, of which ${totalUnwatchedDuration.humanize()} is unwatched.`
}

//TODO: Abstract this into a SkyPlusFinder
const ssdp = new Client();
ssdp.on('response', (headers, code, rinfo) => {
    const location = headers.LOCATION;
    console.debug(`Sky Plus URL: ${location}`);

    // GET the URL, and extract the control URL for the URN
    axios.get(location).then(response => {

        // TODO: This XML & XPath ugliness could be replaced with browser APIs
        const doc = new dom().parseFromString(response.data);
        const select = xpath.useNamespaces({'X': 'urn:schemas-upnp-org:device-1-0'});
        const nodes = select(XPATH_EXPR, doc);
        const path = nodes[0].toString();

        const postURL = new URL(path, location);

        return fetchAllItems(postURL);
    }).then(items => {
        console.log(items);

        populateTable(document.getElementById("epgTable"), items);
        populateSummary(document.getElementById("footer"), items);
    })
    .catch(err => {
        console.error(`Cannot GET ${location}`, err);
    })
});


ssdp.search(SKY_BROWSE_URN);
// setInterval(function() {
//     ssdp.search(SKY_BROWSE_URN);
// }, 5_000);
