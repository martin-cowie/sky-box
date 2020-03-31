const moment = require('moment');

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
    const [_, hours, mins, seconds] = parts;
    return Number(seconds) + (60 * parseInt(mins)) + (60 * 60 * parseInt(hours));
}

export class Item {
    
    readonly id: string;
    readonly title: string
    readonly description: string

    readonly viewed: boolean;

    readonly recordedStartTime: Date
    readonly recordedDuration: number;// of milliseconds

    readonly channel: string; // String channel name
    readonly seriesID: string|null; // String optional series ID

    readonly genre: number; // Number

    constructor(id: string, title: string, description: string, viewed: boolean, recordedStartTime: Date, recordedDuration: number, channel: string, seriesID: string|null, genre: number) {
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

    public toRows(tbody: HTMLTableSectionElement): void {
        const row = tbody.insertRow();
        row.classList.add(this.viewed ? 'viewed' : 'notViewed');

        const descriptionRow = tbody.insertRow();
        descriptionRow.classList.add('description');

        const createCell = (text) => {
            row.insertCell().innerText = text;
        };

        [this.title, this.channel,
            moment(this.recordedStartTime).format('dddd, YYYY-MM-DD'),
            moment.duration(this.recordedDuration, 'seconds').humanize(),
            this.genre].forEach(v => createCell(v));

        const descriptionCell = descriptionRow.insertCell();
        descriptionCell.innerText = this.description;
        descriptionCell.colSpan = 5;
    }

    public static createHeaders(thead: HTMLTableSectionElement): void {
        const row = thead.insertRow();
        const createCell = (text) => {
            const th = document.createElement('th');
            th.innerText = text;
            row.appendChild(th);
        };

        ['Title', 'Channel', 'Recorded','Duration','Genre']
            .forEach(n => createCell(n));
}

    /**
     * Factory method. Build an Item from the given XML
     * @param {Element} itemElement
     */
    public static from(itemElement: Element): Item|null {
        function textOfNamedElement(name: string): string|null {
            const elementZero = itemElement.getElementsByTagName(name).item(0);
            const result = elementZero?.textContent;
            return result ? result : null; // undefined -> null
        }

        const hasElement = (tag) => {
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