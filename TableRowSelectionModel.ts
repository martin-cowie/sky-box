const EventEmitter = require('events');

const SELECTED_CLASS = "selected";

/**
 * Connect to a table and the user can select rows intuitively with click, meta/ctl-click and shift click.
 * list to `selection` events for a list of the selected rows.
 */
export class TableRowSelectionModel extends EventEmitter {

    private model: HTMLTableRowElement[] = [];

    private constructor(private tableElem: HTMLTableElement) {
        super();
        this.tableElem.onclick = (ev) => this.handleClick(ev);
    }

    static from(tableElem: HTMLTableElement) {
        return new TableRowSelectionModel(tableElem);
    }

    /**
     * Find HTMLRowElement s beyween from and to, excluding those already selected
     */
    findPathBetween(from: HTMLTableRowElement, to: HTMLTableRowElement) {
        const section = from.parentElement as HTMLTableSectionElement;
        if (!section) {
            throw Error('argument has parent node!')
        }

        const [x,y] = from.sectionRowIndex<to.sectionRowIndex ? [from, to] : [to, from];
        const result = [];

        for(let i = x.sectionRowIndex; i <= y.sectionRowIndex; i++ ) {
            const row = section.rows[i];

            //TODO: this is icky
            if (!this.model.includes(row)) {
                result.push(row);
            }
        }
        return result;
    }

    handleClick(ev: MouseEvent) {
        const trElem = (ev.target as HTMLElement).parentElement as HTMLTableRowElement;
        if (!trElem) {
            throw Error('event target has no parentElement!')
        }

        if (trElem.parentElement?.tagName !== 'TBODY') {
            return;
        }
        console.log(`Selected row: `, trElem);

        if (ev.shiftKey) {
            // Extend the selection onwards from the last
            if(this.model.length) {
                const lastSelected = this.model[this.model.length -1];
                const path = this.findPathBetween(lastSelected, trElem);

                console.log(`Found path of ${path.length} elements, to add to model`);
                path.forEach(elem => elem.classList.add(SELECTED_CLASS));
                this.model.push(...path);
            } else {
                // The same as a single simple click
                trElem.classList.add(SELECTED_CLASS);
                this.model = [trElem];
            }
        } else if (ev.metaKey || ev.ctrlKey) {
            //Add/Remove this to the selection
            if (this.model.includes(trElem)) {
                const i = this.model.indexOf(trElem);
                this.model.splice(i, 1);

                trElem.classList.remove(SELECTED_CLASS);
            } else {
                this.model.push(trElem);
                trElem.classList.add(SELECTED_CLASS);
            }
        } else {
            // A single selected row

            // Clear any existing selected rows
            this.model.forEach(trElem => trElem.classList.remove(SELECTED_CLASS));
            trElem.classList.add(SELECTED_CLASS);

            // Set the new state
            this.model = [trElem];
        }
        this.emit('selection', this.model);
    }

}