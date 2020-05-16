export class ProgressController {
    constructor(private rootDiv: HTMLDivElement) {

    }

    public setSearching(isSearching = true) {
        if (isSearching) {
            this.rootDiv.innerHTML = `Searching`;
        } else {
            this.rootDiv.innerHTML = '';
            this.rootDiv.style.display = 'none;'
        }
    }

    setProgress(completed: number, total: number) {
        this.rootDiv.innerHTML = `Completed ${completed}/${total}`;
    }
}