//TODO: make table sortable, and groupable on series/genre

const moment = require('moment');

import {SkyBox} from './SkyBox.js';
import {Item, ItemComparator} from './Item.js';

declare type ItemFilter = (item: Item) => boolean;

const PASSTHRU: ItemFilter = (item: Item) => true;
const ONLY_UNVIEWED_ITEMS: ItemFilter = (item: Item) => item.viewed == false;

/**
 * Build a comparator that inverts a given comparator
 * @param comp invert this
 */
function invertComparator(comp: ItemComparator): ItemComparator {
    return (a: Item, b: Item) => 0 - comp(a, b);
}


export class ItemTableController {
 
    /**
     * The items on display, in any order.
     */
    private items: Item[] = [];

    private findFilter: ItemFilter = PASSTHRU;
    private viewedFilter: ItemFilter = PASSTHRU;
    private columnComparator: ItemComparator|null = null;

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
                    this.doFind(this.findTermInput.value);
                }
            });
            this.findDismissButton.onclick = () => this.toggleFind();
    }

    public async refresh(): Promise<void> {
        this.items = await this.skyBox.fetchAllItems();
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

        headerEmitter.on('headerClicked', (headerName: string, comparator: ItemComparator) => {
            this.sortColumn(headerName, comparator);
        });
    }

    private populateTableBody() {
        const newBody = document.createElement('tbody');

        // Create a copy for mutating
        const items = Array.from(this.items);

        if (this.columnComparator) {
            items.sort(this.columnComparator);
        }

        items
            .filter(this.findFilter)
            .filter(this.viewedFilter)
            .forEach(item => item.toRows(newBody));

        this.table.tBodies[0].replaceWith(newBody);

        this.table.style.visibility = 'visible';
    }

    private sortColumn(columnName: string, comparator: ItemComparator) {
        console.debug(`Sorting on column '${columnName}'`);

        // invert the comparator, if already selected
        this.columnComparator = (this.columnComparator === comparator) ? invertComparator(comparator) : comparator;
        this.populateTableBody();
    }

    public toggleShowViewed(value: boolean) {
        this.viewedFilter = value ? PASSTHRU : ONLY_UNVIEWED_ITEMS;
        this.populateTableBody();
    }

    public toggleFind() {
        this.findElem.style.display = (this.findElem.style.display == 'none') ? 'block' : 'none';
        if (this.findElem.style.display === 'block') {
            this.findTermInput.focus();
        } else {
            this.findFilter = PASSTHRU;
            this.populateTableBody();
        }
    }

    public doFind(term: string) {
        console.debug('Search for ' + this.findTermInput.value);

        this.findFilter = (item: Item) => 
            item.title.toLocaleLowerCase().includes(term.toLocaleLowerCase()) || 
            item.description.toLocaleLowerCase().includes(term.toLocaleLowerCase());
        this.populateTableBody();
    }

    private populateSummary() {
        const totalDuration = moment.duration(this.items.reduce((acc, item) => acc + item.recordedDuration, 0), 'seconds');
        const totalUnwatchedDuration = moment.duration(this.items.reduce((acc, item) => item.viewed ? acc : acc + item.recordedDuration, 0), 'seconds');

        this.summaryElem.innerText = `You have ${totalDuration.humanize()} of recordings, of which ${totalUnwatchedDuration.humanize()} is unwatched.`
    }
}