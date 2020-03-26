const type = require('typeof-arguments');

/**
 * Parse the not-quite-ISO standard period/duration format that Sky uses.
 * e.g. `P0D01:03:57` for 1hour, 3mins and 57sec
 * @param {String} str 
 * @returns the number of seconds of the duration
 */
function parseDuration(str) {
    type(arguments, [String]);

    const re = /P0D(\d+):(\d+):(\d+)/;
    const parts = str.match(re);
    if (!parts) {
        throw Error('Cannot parse Period: ', str);
    }
    const [_, hours, mins, seconds] = parts;
    return Number(seconds) + (60 * mins) + (60 * 60 * hours);
}

export class Item {
    id; // String
    title; // String
    description; // String

    viewed; // Boolean

    recordedStartTime; // Date
    recordedStartTime; // Number of milliseconds

    channel; // String channel name
    seriesID; // String optional series ID

    genre; // Number

    constructor(id, title, description, viewed, recordedStartTime, recordedDuration, channel, seriesID, genre) {
        type(arguments, [String, String, String, Boolean, "Date|undefined", "Number|undefined", String, 'string|undefined', Number]);
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
     * Factory method. Build an Item from the given XML
     * @param {Element} itemElement 
     */
    static from(itemElement) {
        function textOfNamedElement(name) {
            const elementZero = itemElement.getElementsByTagName(name).item(0);
            return elementZero?.textContent;
        }

        if (itemElement.getElementsByTagName('upnp:recordedStartDateTime').length == 0) {
            // This has not been recorded yet
            return null;
        }

        const id = itemElement.getAttribute('id');
        const title = textOfNamedElement('dc:title');
        const description = textOfNamedElement('dc:description');
        const viewed = Number(textOfNamedElement('vx:X_isViewed')) ? true : false ;

        //TODO: These two attrs may not exist - poss. on downloaded content(?)
        const recordedStartTime = new Date(textOfNamedElement('upnp:recordedStartDateTime'));
        const recordedDuration = parseDuration(textOfNamedElement('upnp:recordedDuration'));

        const channelName = textOfNamedElement('upnp:channelName');
        const seriesID = textOfNamedElement('upnp:seriesID');
        const serviceType = Number(textOfNamedElement('vx:X_genre'));

        return Object.freeze(new Item(id, title, description, 
            viewed,
            recordedStartTime,
            recordedDuration, 
            channelName,
            seriesID,
            serviceType));
    }
}