//TODO: make table sortable, and groupable on series/genre

const moment = require('moment');

import {SkyBox} from './SkyBox.js';
import {Item} from './Item.js';

export class ItemTableController {
 
    /**
     * The items on display, in any order.
     */
    private items: Item[] = [];

    /** 
     * The Items received from the SkyBox, in received order.
    */
    private originalItems: Item[] = [];

    private static comparators: {[k: string]: (a: Item, b:Item)=>number} = {
        'Title': (a: Item, b: Item) => a.title.localeCompare(b.title),
        'Channel': (a: Item, b: Item) => a.channel.localeCompare(b.channel),
        'Recorded': (a: Item, b: Item) => a.recordedStartTime > b.recordedStartTime ? 1 : -1,
        'Genre': (a: Item, b: Item) => a.genre > b.genre ? 1 : -1,
        'Duration': (a: Item, b: Item) => a.recordedDuration > b.recordedDuration ? 1 : -1
    };

    constructor(
        private readonly skyBox: SkyBox, 
        private readonly table: HTMLTableElement, 
        private readonly summaryElem: HTMLElement,
        private readonly findElem: HTMLElement,
        private readonly findTermInput: HTMLInputElement,
        private readonly findDismissButton: HTMLInputElement
        ) {
            this.findTermInput.addEventListener('keyup', (event) => {
                if (event.key === 'Enter') {
                    console.debug('Search for ' + this.findTermInput.value)
                }
            });
            this.findDismissButton.onclick = () => this.toggleFind();
    }

    public async refresh(): Promise<void> {
        this.items = await this.skyBox.fetchAllItems();
        this.originalItems = Array.from(this.items);
        this.draw();
    }

    public draw() {
        this.populateTableHeader();
        this.populateTableBody()
        this.populateSummary();
    }

    private populateTableHeader() {
        const newHeader = document.createElement('thead');
        const headerEmitter = Item.createHeaders(newHeader);
        this.table.tHead?.replaceWith(newHeader);

        headerEmitter.on('headerClicked', (headerName: string) => {
            this.sortColumn(headerName);
        });
    }

    private populateTableBody() {
        const newBody = document.createElement('tbody');
        this.items.forEach(item => item.toRows(newBody));
        this.table.tBodies[0].replaceWith(newBody);

        this.table.style.visibility = 'visible';
    }

    private sortColumn(columnName: string) {
        const comparator = ItemTableController.comparators[columnName];

        if (comparator) {
            console.debug(`Sorting on column '${columnName}'`);
            this.items.sort(comparator);
            this.populateTableBody();
        } else {
            console.error(`Cannot sort on column ${columnName} yet`);
        }
    }

    public showViewed(value: boolean) {
        if (value) {
            this.items = Array.from(this.originalItems);
        } else {
            this.items = this.items.filter(item => item.viewed == false);
        }
        this.populateTableBody();
    }

    public toggleFind() {
        this.findElem.style.display = (this.findElem.style.display == 'none') ? 'block' : 'none';
        if (this.findElem.style.display === 'block') {
            this.findTermInput.focus();
        }
    }

    private populateSummary() {
        const totalDuration = moment.duration(this.items.reduce((acc, item) => acc + item.recordedDuration, 0), 'seconds');
        const totalUnwatchedDuration = moment.duration(this.items.reduce((acc, item) => item.viewed ? acc : acc + item.recordedDuration, 0), 'seconds');

        this.summaryElem.innerText = `You have ${totalDuration.humanize()} of recordings, of which ${totalUnwatchedDuration.humanize()} is unwatched.`
    }
}