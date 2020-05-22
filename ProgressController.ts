
function partDraw(element: SVGCircleElement, fractionFrom: number, fractionTo: number): void {
    if (fractionFrom > 1.0) {
        throw new Error('fractionFrom must be >=0 and <=1: ' + fractionFrom);
    }
    if (fractionTo > 1.0) {
        throw new Error('fractionTo must be >=0 and <=1: ' + fractionTo);
    }
    const length = element.getTotalLength();

    // Map 0.0 .. 1.0 to path-length .. 0 (weird, but that's SVG for you)
    const f = (pos:number) => length - (length * pos);

    element.style.transition = 'none';

    // Set up the starting positions
    element.style.strokeDasharray = length + ' ' + length;
    element.style.strokeDashoffset = String(f(fractionFrom));

    // Trigger a layout so styles are calculated & the browser
    // picks up the starting position before animating
    element.getBoundingClientRect();

    // Define our transition
    element.style.transition = 'stroke-dashoffset .5s ease-in-out';

    // Go!
    element.style.strokeDashoffset = String(f(fractionTo));
}

export class ProgressController {
    private readonly progressCircle: SVGCircleElement;
    private readonly text: SVGTextElement;
    private animElem: SVGAnimateTransformElement;
    private progress = 0.0;

    constructor(private rootDiv: HTMLDivElement) {
        this.text = rootDiv.getElementsByTagName('text')[0] as SVGTextElement;
        this.progressCircle = rootDiv.getElementsByTagName('circle')[0] as SVGCircleElement;

        this.progressCircle.getBoundingClientRect();
        // Create spinner
        const cx = this.progressCircle.cx.baseVal.value;
        const cy = this.progressCircle.cy.baseVal.value;

        this.animElem = document.createElementNS('http://www.w3.org/2000/svg', 'animateTransform') as SVGAnimateTransformElement;
        this.animElem.setAttribute("attributeName", "transform");
        this.animElem.setAttribute("type", "rotate");
        this.animElem.setAttribute("from", `0 ${cx} ${cy}`);
        this.animElem.setAttribute("to", `360 ${cx} ${cy}`);
        this.animElem.setAttribute("dur", "2s");
        this.animElem.setAttribute("repeatCount", "indefinite");
}

    public setSearching(isSearching = true) {
        if (isSearching) {
            this.text.innerHTML = 'Searching';
            this.spin(true);
        } else {
            this.spin(false);
            this.rootDiv.style.display = 'none';
        }
    }

    public setProgress(completed: number, total: number) {
        if (this.isSpinning()) {
            this.spin(false);
        }
        this.text.innerHTML = `Completed ${completed}/${total}`;

        const to = completed/total;
        partDraw(this.progressCircle, this.progress, to);
        this.progress = to;
    }

    private isSpinning(): boolean {
        return this.animElem.parentElement ? true : false;
    }

    private spin(spinning: boolean): void {
        if (spinning) {
            partDraw(this.progressCircle, 0.0, 0.5);
            this.progressCircle.appendChild(this.animElem);
        } else {
            this.animElem.remove();
            partDraw(this.progressCircle, 0.5, 1.0);
        }
    }
}