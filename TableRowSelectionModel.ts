import {EventEmitter} from 'events';

const SELECTED_CLASS = "selected";

/**
 * Connect to a table and the user can select rows intuitively with click, meta/ctl-click and shift click.
 * @event `selection` a list of the selected rows.
 */
export class TableRowSelectionModel extends EventEmitter {

    private model: HTMLTableSectionElement[] = [];

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
    private findPathBetween(from: HTMLTableSectionElement, to: HTMLTableSectionElement): HTMLTableSectionElement[] {
        const section = from.parentElement as HTMLTableSectionElement;
        if (!section) {
            throw Error('argument lacks parent node!')
        }

        // const [x,y] = from.sectionRowIndex<to.sectionRowIndex ? [from, to] : [to, from];
        // const result = [];

        // for(let i = x.sectionRowIndex; i <= y.sectionRowIndex; i++ ) {
        //     result.push(section.rows[i]);
        // }
        // return result;
        const lookingNorth: HTMLTableSectionElement[] = [];
        for (let elem: Element|null = from; elem; elem = elem.previousElementSibling) {
            lookingNorth.unshift(elem as HTMLTableSectionElement);
            if (elem == to) {
                return lookingNorth;
            }
        }

        const lookingSouth: HTMLTableSectionElement[] = [];
        for (let elem: Element|null = from; elem; elem = elem.nextElementSibling) {
            lookingSouth.push(elem as HTMLTableSectionElement);
            if (elem == to) {
                return lookingSouth;
            }
        }

        return [];
    }

    private handleClick(ev: MouseEvent) {
        const tobdyElem = (ev.target as HTMLElement).closest('tbody') as HTMLTableSectionElement
        if (!tobdyElem) {
            throw Error('event target has no parentElement!')
        }

        console.debug(`Selected tbody: `, tobdyElem);

        if (ev.shiftKey) {
            // Extend the selection onwards from the last
            if(this.model.length) {
                const lastSelected = this.model[this.model.length -1];
                const path = this.findPathBetween(lastSelected, tobdyElem).filter(rowElem => !this.model.includes(rowElem));

                console.log(`Found path of ${path.length} elements, to add to model`);
                path.forEach(elem => elem.classList.add(SELECTED_CLASS));
                this.model.push(...path);
            } else {
                // The same as a single simple click
                tobdyElem.classList.add(SELECTED_CLASS);
                this.model = [tobdyElem];
            }
        } else if (ev.metaKey || ev.ctrlKey) {
            //Add/Remove this to the selection
            if (this.model.includes(tobdyElem)) {
                const i = this.model.indexOf(tobdyElem);
                this.model.splice(i, 1);

                tobdyElem.classList.remove(SELECTED_CLASS);
            } else {
                this.model.push(tobdyElem);
                tobdyElem.classList.add(SELECTED_CLASS);
            }
        } else {
            // A single selected row

            // Clear any existing selected rows
            this.model.forEach(trElem => trElem.classList.remove(SELECTED_CLASS));
            tobdyElem.classList.add(SELECTED_CLASS);

            // Set the new state
            this.model = [tobdyElem];
        }
        this.emit('selection', this.model);
    }

}