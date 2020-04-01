//TODO: make table sortable, and groupable on series/genre

const moment = require('moment');

import {SkyBox} from './SkyBox.js';
import {Item} from './Item.js';

export class ItemTableController {
 
    private items: Item[] = [];

    constructor(
        private readonly skyBox: SkyBox, 
        private readonly table: HTMLTableElement, 
        private readonly summaryDiv: HTMLDivElement) {
    }

    public async refresh(): Promise<void> {
        this.items = await this.skyBox.fetchAllItems();
        this.populateTable()
        this.populateSummary();
    }

    public draw() {
        this.populateTable()
        this.populateSummary();
    }

    private populateTable() {
        const newHeader = document.createElement('thead');
        Item.createHeaders(newHeader);
        this.table.tHead?.replaceWith(newHeader);

        const newBody = document.createElement('tbody');
        this.items.forEach(item => item.toRows(newBody));
        this.table.tBodies[0].replaceWith(newBody);

        this.table.style.visibility = 'visible';
    }

    private populateSummary() {
        const totalDuration = moment.duration(this.items.reduce((acc, item) => acc + item.recordedDuration, 0), 'seconds');
        const totalUnwatchedDuration = moment.duration(this.items.reduce((acc, item) => item.viewed ? acc : acc + item.recordedDuration, 0), 'seconds');

        this.summaryDiv.innerText = `You have ${totalDuration.humanize()} of recordings, of which ${totalUnwatchedDuration.humanize()} is unwatched.`
    }
}