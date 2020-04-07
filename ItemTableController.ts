//TODO: make table sortable, and groupable on series/genre

const moment = require('moment');

import {SkyBox} from './SkyBox.js';
import {Item, ItemComparator} from './Item.js';

declare type ItemFilter = (item: Item) => boolean;

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

    private findFilter?: ItemFilter;
    private viewedFilter?: ItemFilter;
    private columnComparator?: ItemComparator;

    constructor(
        private readonly skyBox: SkyBox, 
        private readonly table: HTMLTableElement, 
        private readonly summaryElem: HTMLElement,
        private readonly findElem: HTMLElement,
        private readonly findTermInput: HTMLInputElement,
        private readonly findDismissButton: HTMLInputElement,
        private readonly findSummary: HTMLElement
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

        if (this.findFilter || this.viewedFilter) {
            const filteredItems = [this.findFilter, this.viewedFilter].reduce((acc, filter) => {
                return filter ? acc.filter(filter) : acc;
            }, items);

            filteredItems.forEach(item => item.toRows(newBody));

            const duration = moment.duration(
                filteredItems.reduce((acc, item) => acc + item.recordedDuration, 0), 'seconds'
            ).humanize();

            this.findSummary.innerText = `${filteredItems.length} matches, roughly ${duration}`;
        } else {
            items.forEach(item => item.toRows(newBody));
            this.findSummary.innerText = '';
        }
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
        this.viewedFilter = value ? undefined : ONLY_UNVIEWED_ITEMS;
        this.populateTableBody();
    }

    public toggleFind() {
        this.findElem.style.display = (this.findElem.style.display == 'none') ? 'block' : 'none';
        if (this.findElem.style.display === 'block') {
            this.findTermInput.focus();
        } else {
            this.findFilter = undefined;
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

        this.summaryElem.innerText = `${totalDuration.humanize()} of recordings, ${totalUnwatchedDuration.humanize()} unwatched.`
    }
}