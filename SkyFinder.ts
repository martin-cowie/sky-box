const {Client} = require('node-ssdp');
import {EventEmitter} from 'events';

import {SKY_BROWSE_URN, SKY_PLAY_URN} from './Common';
import {SkyBox} from './SkyBox';

interface SSDPHeaders {
    LOCATION: string;

    /**
     * URN of the SSDP search.
     */
    ST: string;
}

interface SSDPRemoteInfo {
    address: string;
}

export class SkyBoxURNs {
    [k: string]: string|null;

    constructor() {
        this[SKY_BROWSE_URN] = null;
        this[SKY_PLAY_URN] = null;
    }
}

function isFull(urns: SkyBoxURNs) {
    return Object.values(urns).every(v => v !== null);
}

/**
 * Find SkyPlus machines.
 * @event 'found' includes the URL for the SkyBrowse service
 */
export class SkyFinder extends EventEmitter {

    private ssdp = new Client;

    private rawSkyBoxURNs: {[remoteIP: string]: SkyBoxURNs} = {};

    private urns = [SKY_BROWSE_URN, SKY_PLAY_URN];

    constructor() {
        super();

        this.ssdp.on('response', (headers: SSDPHeaders, code: number, rinfo: SSDPRemoteInfo) => this.handleResponse(headers, code, rinfo));
    }

    private doSearch() {
        for(const urn of this.urns) {
            this.ssdp.search(urn);
        }
    }

    /**
     * Search for a SkyPlus machine, and continue searching.
     */
    find() {
        this.doSearch();

        // Periodically re-poll
        //TODO: it's unclear if this necessary
        setInterval(() => {
            this.doSearch();
        }, 10_000);
    }

    private handleResponse(headers: SSDPHeaders, code: number, rinfo: SSDPRemoteInfo) {
        console.debug(`headerResponse`, headers, code, rinfo);
        if (code != 200) {
            return;
        }

        // Get/Create the matching record of URNs & populate it
        const urns: SkyBoxURNs = (!this.rawSkyBoxURNs.hasOwnProperty(rinfo.address)) ?
        this.rawSkyBoxURNs[rinfo.address] = new SkyBoxURNs() :
        this.rawSkyBoxURNs[rinfo.address];

        if (isFull(urns)) {
            return;
        } else {
            const urn = headers.ST;
            urns[urn] = headers.LOCATION;
            if (isFull(urns)) {
                SkyBox.from(urns[SKY_BROWSE_URN] as string, urns[SKY_PLAY_URN] as string).then(skyBox => this.emit('found', skyBox));
            }
        }

    }

}