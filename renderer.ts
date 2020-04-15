import {SkyFinder} from './SkyFinder'
import {SkyBox} from './SkyBox';
import {ItemTableController} from './ItemTableController';
import {ipcRenderer, remote}  from 'electron';

async function handleFoundSkyBox(skyBox: SkyBox) {
    document.title = skyBox.toString();

    const tableController = new ItemTableController(skyBox,
        document.getElementById("itemTable") as HTMLTableElement,
        document.getElementById("summary") as HTMLDivElement,
        document.getElementById('findControls') as HTMLElement,
        document.getElementById('findTermInput') as HTMLInputElement,
        document.getElementById('findDismissButton') as HTMLInputElement,
        document.getElementById('findSummary') as HTMLElement
        );

    tableController.refresh();

    ipcRenderer.on('toggleFind', () => {
        console.debug(`Find menuItem clicked`)
        tableController.toggleFind();
    });

    ipcRenderer.on('showViewedContent', (event: any, newValue:any) => {
        console.debug(`showViewedContent: ${newValue}`);
        tableController.toggleShowViewed(newValue);
    });
}

const args = remote.process.argv;
if (args.length > 2) {
    const filename = args[2];
    console.log(`loading test data from ${filename}`);
    SkyBox.fromTestData(filename).then(handleFoundSkyBox);
} else {
    const finder = new SkyFinder();
    finder.on('found', handleFoundSkyBox);
    finder.find();
}
