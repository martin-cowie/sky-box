
import {SkyFinder} from './SkyFinder.js'
import {SkyBox} from './SkyBox.js';
import {ItemTableController} from './ItemTableController.js';

const finder = new SkyFinder();
finder.on('found', async (skyBox: SkyBox) => {

    document.title = skyBox.toString();

    const tableController = new ItemTableController(skyBox, 
        document.getElementById("epgTable") as HTMLTableElement, 
        document.getElementById("footer") as HTMLDivElement);

    tableController.refresh();

});

finder.find();