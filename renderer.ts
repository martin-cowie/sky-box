//TODO: a better packaging setup, so we can Import anything: local, imported or from the Electron runtime.
//TODO: relatedly, remove the need for the `.js` suffix in `import` statements.

import {SkyFinder} from './SkyFinder.js'
import {SkyBox} from './SkyBox.js';
import {ItemTableController} from './ItemTableController.js';

const finder = new SkyFinder();
finder.on('found', async (skyBox: SkyBox) => {

    document.title = skyBox.toString();

    const tableController = new ItemTableController(skyBox, 
        document.getElementById("epgTable") as HTMLTableElement, 
        document.getElementById("summary") as HTMLDivElement,
        document.getElementById("unviewedCheckbox") as HTMLInputElement
        );

    tableController.refresh();

});

finder.find();