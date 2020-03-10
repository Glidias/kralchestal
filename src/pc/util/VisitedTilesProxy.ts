class VisitedTilesProxy {
	s:Map<string, number> = new Map();
	resultsCache:number[] = new Array(20);
	len:number = 0;

	constructor() {

	}

	purge(total:number=20) {
		this.len = 0;
		let newLen = total * 2;
		this.resultsCache.length = newLen;
	}

	get(x:number, y:number) {
		return this.s.get(x+','+y);
	}

	set(x:number, y:number, val:number) {
		let k = x+','+y;
		if (!this.s.has(k)) {
			this.resultsCache[this.len++] = x;
			this.resultsCache[this.len++] = y;
		}
		this.s.set(k, val);
	}

	clear() {
		this.len = 0;
		this.s.clear();
	}

	has(x:number, y:number) {
		return this.s.has(x+','+y);
	}

}
export {VisitedTilesProxy}