const {Client} = require('node-ssdp');
const EventEmitter = require('events');

import {SKY_BROWSE_URN} from './Common.js';

/**
 * Find SkyPlus machines. 
 * @event 'found' includes the URL for the SkyBrowse service
 */
export class SkyFinder extends EventEmitter {
    constructor() {
        super();
        this.ssdp = new Client();
        this.found = new Set();
        this.ssdp.on('response', (headers, code, rinfo) => this._handleResponse(headers, code, rinfo));
    }

    /**
     * Search for a SkyPlus machine, and continue searching.
     */
    find() {
        this.ssdp.search(SKY_BROWSE_URN);

        // Periodically re-poll
        setInterval(() => {
            this.ssdp.search(SKY_BROWSE_URN);
        }, 10_000);
    }

    _handleResponse(headers, code, rinfo) {
        console.debug(`_headerResponse`, headers, code, rinfo);
        if (code != 200) {
            return;
        }
        if (this.found.has(rinfo.address)) {
            console.debug(`Ignoring known host`, rinfo.address);
            return;
        }
        this.found.add(rinfo.address);

        // TODO: construct a SkyBox object and deliver that via event
        this.emit('found', headers.LOCATION);
    }

}