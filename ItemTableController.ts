//TODO: make table sortable, and groupable on series/genre
import moment from 'moment';

import {SkyBox} from './SkyBox';
import {Item, ItemComparator} from './Item';
import {ItemSelectionModel} from './ItemSelectionModel';

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

    //** The Items on display, in any order.
    private items: Item[] = [];

    //** Selected Items
    private selectedItems: Item[] = [];

    private findFilter?: ItemFilter;
    private viewedFilter?: ItemFilter;
    private columnComparator?: ItemComparator;
    private selectionModel: ItemSelectionModel;
    private summaryText: string = "";

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

            this.selectionModel = ItemSelectionModel.from(table);
            this.selectionModel.on('selection', (items: Item[]) => {
                this.doSelectionChange(items);
            });

            window.addEventListener("keydown", (event) => {
            switch (event.key) {
                case 'Escape':
                    console.log(`Escape pressed`);
                    this.selectionModel.clear();
                    break;

                case 'Delete':
                case 'Backspace':
                    console.log(`Delete pressed`);
                    this.doDelete();
                    break;

                case 'Enter':
                    this.doPlay();
            }
        });
    }

    public async refresh(): Promise<void> {
        this.items = await this.skyBox.fetchAllItems();
        this.draw();
    }

    public draw(): void {
        this.populateTableHeader();
        this.populateTableBody()
        this.populateSummary();
    }

    private populateTableHeader(): void {
        const newHeader = document.createElement('thead');
        const headerEmitter = Item.createHeaders(newHeader);
        this.table.tHead?.replaceWith(newHeader);

        headerEmitter.on('headerClicked', (headerName: string, comparator: ItemComparator) => {
            this.sortColumn(headerName, comparator);
        });
    }

    private populateTableBody(): void {

        // Create a copy for mutating
        const items = Array.from(this.items);

        if (this.columnComparator) {
            items.sort(this.columnComparator);
        }

        Array.from(this.table.tBodies).forEach(tbody => tbody.remove());

        if (this.findFilter || this.viewedFilter) {
            const filteredItems = [this.findFilter, this.viewedFilter].reduce((acc, filter) => {
                return filter ? acc.filter(filter) : acc;
            }, items);

            filteredItems.forEach(item => item.toRows(this.table));

            const duration = moment.duration(
                filteredItems.reduce((acc, item) => acc + item.recordedDuration, 0), 'seconds'
            ).humanize();

            this.findSummary.innerText = `${filteredItems.length} matches, roughly ${duration}`;
        } else {
            items.forEach(item => item.toRows(this.table));
            this.findSummary.innerText = '';
        }
        this.table.style.visibility = 'visible';

    }

    private sortColumn(columnName: string, comparator: ItemComparator): void {
        console.debug(`Sorting on column '${columnName}'`);

        // invert the comparator, if already selected
        this.columnComparator = (this.columnComparator === comparator) ? invertComparator(comparator) : comparator;
        this.populateTableBody();
    }

    public toggleShowViewed(value: boolean): void {
        this.viewedFilter = value ? undefined : ONLY_UNVIEWED_ITEMS;
        this.populateTableBody();
    }

    public toggleFind(): void {
        this.findElem.style.display = (this.findElem.style.display == 'none') ? 'block' : 'none';
        if (this.findElem.style.display === 'block') {
            this.findTermInput.focus();
        } else {
            this.findFilter = undefined;
            this.populateTableBody();
        }
    }

    public doFind(term: string): void {
        console.debug('Search for ' + this.findTermInput.value);

        this.findFilter = (item: Item) =>
            item.title.toLocaleLowerCase().includes(term.toLocaleLowerCase()) ||
            item.description.toLocaleLowerCase().includes(term.toLocaleLowerCase());
        this.populateTableBody();
    }

    private populateSummary(): void {
        const totalDuration = moment.duration(this.items.reduce((acc, item) => acc + item.recordedDuration, 0), 'seconds');
        const totalUnwatchedDuration = moment.duration(this.items.reduce((acc, item) => item.viewed ? acc : acc + item.recordedDuration, 0), 'seconds');

        this.summaryText = `${totalDuration.humanize()} of recordings, ${totalUnwatchedDuration.humanize()} unwatched.`;
        this.summaryElem.innerText = this.summaryText;
    }

    private async doDelete(): Promise<void> {
        if (this.selectedItems.length === 0) {
            return;
        }

        const selectedDuration = moment.duration(this.selectedItems.reduce((acc, item) => acc + item.recordedDuration, 0), 'seconds');
        const confirmationText = `Delete ${this.selectedItems.length} recordings covering ${selectedDuration.humanize()} of time?`;

        if (window.confirm(confirmationText)) {
            console.log(`Preparing to remove ${this.selectedItems.length} items`);

            const idsToRemove = new Set(this.selectedItems.map(i => i.id));
            await this.skyBox.deleteItems(this.selectedItems);

            this.selectionModel.clear();
            this.items = this.items.filter(i => !idsToRemove.has(i.id));
            this.draw();
        }
    }

    private doPlay(): void {
        if (this.selectedItems.length != 1) {
            return;
        }

        this.skyBox.play(this.selectedItems[0]);
    }

    private doSelectionChange(items: Item[]): void {
        this.selectedItems = items;
        console.debug(`Selected ${items.length} rows`);

        if (items.length == 0) {
            this.summaryElem.innerText = this.summaryText;
        } else {
            const totalDuration = moment.duration(items.reduce((acc, item) => acc + item.recordedDuration, 0), 'seconds');
            this.summaryElem.innerText = `Selected ${totalDuration.humanize()} of recordings`;
        }
    }

}