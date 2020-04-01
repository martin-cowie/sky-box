//TODO: make table sortable, and groupable on series/genre

const type = require('typeof-arguments');
const moment = require('moment');

import {Item} from './Item.js'
import {SkyFinder} from './SkyFinder.js'
import { SkyBox } from './SkyBox.js';

function populateTable(tableElem: HTMLTableElement, items: Item[]) {
    type(arguments, [HTMLTableElement, Array]);

    const newHeader = document.createElement('thead');
    Item.createHeaders(newHeader);
    tableElem.tHead?.replaceWith(newHeader);

    const newBody = document.createElement('tbody');
    items.forEach(item => item.toRows(newBody));
    tableElem.tBodies[0].replaceWith(newBody);

    tableElem.style.visibility = 'visible';
}

function populateSummary(summaryElem: HTMLDivElement, items: Item[]) {
    type(arguments, [HTMLDivElement, Array]);
    const totalDuration = moment.duration(items.reduce((acc, item) => acc + item.recordedDuration, 0), 'seconds');
    const totalUnwatchedDuration = moment.duration(items.reduce((acc, item) => item.viewed ? acc : acc + item.recordedDuration, 0), 'seconds');

    summaryElem.innerText = `You have ${totalDuration.humanize()} of recordings, of which ${totalUnwatchedDuration.humanize()} is unwatched.`
}

const finder = new SkyFinder();
finder.on('found', (skyBox: SkyBox) => {

    document.title = skyBox.toString();

    // GET the URL, and extract the control URL for the URN
    skyBox.fetchAllItems().then(items => {
        populateTable(document.getElementById("epgTable") as HTMLTableElement, items);
        populateSummary(document.getElementById("footer") as HTMLDivElement, items);
    })
    .catch(err => {
        console.error(`Cannot get items from ${skyBox.toString()}: `, err);
    });
});

finder.find();