//TODO: make table sortable, and groupable on series/genre

const axios = require('axios').default;
const xpath = require('xpath');
const dom = require('xmldom').DOMParser;
const type = require('typeof-arguments');
const moment = require('moment');

import {Item} from './Item.js'
import {SkyFinder} from './SkyFinder.js'
import {SkyBox} from './SkyBox.js';

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
    type(arguments, [HTMLDivElement, Array]);
    const totalDuration = moment.duration(items.reduce((acc, item) => acc + item.recordedDuration, 0), 'seconds');
    const totalUnwatchedDuration = moment.duration(items.reduce((acc, item) => item.viewed ? acc : acc + item.recordedDuration, 0), 'seconds');

    summaryElem.innerText = `You have ${totalDuration.humanize()} of recordings, of which ${totalUnwatchedDuration.humanize()} is unwatched.`
}

async function fetchAllItems(location) {
    type(arguments, [String]);

    // GET the URL, and extract the control URL for the URN
    const skyBox = await SkyBox.from(location);
    const items = skyBox.fetchAllItems();

    console.log(items);
    return items;
}

const finder = new SkyFinder();
finder.on('found', (location) => {

    // GET the URL, and extract the control URL for the URN
    fetchAllItems(location).then(items => {
        populateTable(document.getElementById("epgTable"), items);
        populateSummary(document.getElementById("footer"), items);
    })
    .catch(err => {
        console.error(`Exception: `, err);
    });
});

finder.find();