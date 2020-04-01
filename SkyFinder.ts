const {Client} = require('node-ssdp');
const EventEmitter = require('events');

import {SKY_BROWSE_URN} from './Common.js';
import {SkyBox} from './SkyBox.js';

interface SSDPHeaders {
    LOCATION: string;
}

interface SSDPRemoteInfo {
    address: string;
}

/**
 * Find SkyPlus machines. 
 * @event 'found' includes the URL for the SkyBrowse service
 */
export class SkyFinder extends EventEmitter {

    private ssdp = new Client;

    private found: Set<string> = new Set();

    constructor() {
        super();
        
        this.ssdp.on('response', (headers: SSDPHeaders, code: number, rinfo: SSDPRemoteInfo) => this.handleResponse(headers, code, rinfo));
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

    private handleResponse(headers: SSDPHeaders, code: number, rinfo: SSDPRemoteInfo) {
        console.debug(`_headerResponse`, headers, code, rinfo);
        if (code != 200) {
            return;
        }
        if (this.found.has(rinfo.address)) {
            return;
        }
        this.found.add(rinfo.address);

        SkyBox.from(headers.LOCATION).then(skyBox => this.emit('found', skyBox));
    }

}