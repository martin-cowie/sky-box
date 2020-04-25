import moment from 'moment';
import {EventEmitter} from 'events';
/**
 * Parse the not-quite-ISO standard period/duration format that Sky uses.
 * e.g. `P0D01:03:57` for 1hour, 3mins and 57sec
 * @param {String} str
 * @returns the number of seconds of the duration
 */
function parseDuration(str: string) {
    const re = /P0D(\d+):(\d+):(\d+)/;
    const parts = str.match(re);
    if (!parts) {
        throw Error('Cannot parse Period: ' + str);
    }
    const [, hours, mins, seconds] = parts;
    return Number(seconds) + (60 * parseInt(mins)) + (60 * 60 * parseInt(hours));
}

function mapServiceType(genre: number): string {
    switch(genre) {
        case 16: return 'Music';
        case 11: return 'Documentary';
        case 3: // fallthrough
        case 8: return 'Entertainment';
        case 7: return 'Sport';
        case 6: return 'Film';
        case 5: return 'Live'; //FIXME: this is a guess
        case 2: return 'Kids';
        default: return String(genre);
    }
}

export declare type ItemComparator = (a: Item, b: Item) => number;

const comparators: {[k: string]: ItemComparator} = {
    'Title': (a: Item, b: Item) => a.title.localeCompare(b.title),
    'Channel': (a: Item, b: Item) => a.channel.localeCompare(b.channel),
    'Recorded': (a: Item, b: Item) => a.recordedStartTime > b.recordedStartTime ? 1 : -1,
    'Genre': (a: Item, b: Item) => a.genre > b.genre ? 1 : -1,
    'Duration': (a: Item, b: Item) => a.recordedDuration > b.recordedDuration ? 1 : -1
};


export class Item {

    readonly id: string;
    readonly title: string
    readonly description: string
    readonly viewed: boolean;
    readonly recordedStartTime: Date

    /**
     * Duration in seconds
     */
    readonly recordedDuration: number;

    /**
     * channel name
     */
    readonly channel: string;

    /**
     * optional series ID
     */
    readonly seriesID: string|null;

    readonly genre: number;

    private constructor(id: string, title: string, description: string, viewed: boolean, recordedStartTime: Date, recordedDuration: number, channel: string, seriesID: string|null, genre: number) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.viewed = viewed;
        this.recordedStartTime = recordedStartTime;
        this.recordedDuration = recordedDuration;
        this.channel = channel;
        this.seriesID = seriesID;
        this.genre = genre;
    }

    /**
     * Insert one or more rows representing this Item, into the given table, within a new `tbody`.
     * @param table destination for newly created rows.
     */
    public toRows(table: HTMLTableElement): void {
        const tbody = table.createTBody();

        const row = tbody.insertRow();
        row.classList.add(this.viewed ? 'viewed' : 'notViewed');

        const descriptionRow = tbody.insertRow();
        descriptionRow.classList.add('description');

        const createCell = (text: string) => {
            row.insertCell().innerText = text;
        };

        [this.title, this.channel,
            moment(this.recordedStartTime).format('dddd, YYYY-MM-DD'),
            moment.duration(this.recordedDuration, 'seconds').humanize(),
            mapServiceType(this.genre)
        ].forEach(v => createCell(v));

        const descriptionCell = descriptionRow.insertCell();
        descriptionCell.innerText = this.description;
        descriptionCell.colSpan = 5;
    }

    /**
     * Insert a table header, representing an Item.
     * @param thead destination for newly created header.
     * @returns an EventEmitter for the group of headers
     */
    public static createHeaders(thead: HTMLTableSectionElement): EventEmitter {
        const row = thead.insertRow();
        const createCell = (text: string, emitter: any) => {
            const th = document.createElement('th');
            th.innerText = text;
            th.onclick = () => emitter.emit('headerClicked', text, comparators[text]);
            row.appendChild(th);
        };

        const result = new EventEmitter();
        ['Title', 'Channel', 'Recorded','Duration','Genre']
            .forEach(n => createCell(n, result));

        return result;
}

    /**
     * Factory method. Build an Item from the given XML
     * @param {Element} itemElement
     * @returns an Item if possible or null otherwise.
     */
    public static from(itemElement: Element): Item|null {
        function textOfNamedElement(name: string): string|null {
            const elementZero = itemElement.getElementsByTagName(name).item(0);
            const result = elementZero?.textContent;
            return result ? result : null; // undefined -> null
        }

        const hasElement = (tag: string) => {
            return itemElement.getElementsByTagName(tag).length > 0;
        }

        if (!(hasElement('upnp:recordedStartDateTime') && hasElement('upnp:recordedDuration'))) {
            // Sign that this has not been recorded yet
            return null;
        }

        const id = itemElement.getAttribute('id');
        const title = textOfNamedElement('dc:title');
        const description = textOfNamedElement('dc:description');
        const viewed = Number(textOfNamedElement('vx:X_isViewed')) ? true : false ;

        const recordedStartTimeStr = textOfNamedElement('upnp:recordedStartDateTime');
        const recordedDurationStr = textOfNamedElement('upnp:recordedDuration');

        const channelName = textOfNamedElement('upnp:channelName');
        const seriesID = textOfNamedElement('upnp:seriesID');
        const serviceType = Number(textOfNamedElement('vx:X_genre'));

        if (!id || !title || !description || !channelName || !recordedStartTimeStr || !recordedDurationStr) {
            return null;
        }

        return Object.freeze(new Item(id, title, description,
            viewed,
            new Date(recordedStartTimeStr),
            parseDuration(recordedDurationStr),
            channelName,
            seriesID,
            serviceType));
    }
}