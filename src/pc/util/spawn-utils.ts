import { Polygon } from "../../../yuka/src/math/Polygon";
import { Vector3 } from "../../../yuka/src/math/Vector3";
import { yukaToAltPolygon } from "./mesh-utils";
import CullingPlane from "../../hx/altern/culling/CullingPlane";
import Face from "../../hx/altern/geom/Face";
import Wrapper from "../../hx/altern/geom/Wrapper";
import Vertex from "../../hx/altern/geom/Vertex";
import ClipMacros from "../../hx/altern/geom/ClipMacros";
import { AABB } from "../../../yuka/src/math/AABB";
import { Ray } from "../../../yuka/src/math/Ray";
import { VisitedTilesProxy } from "./VisitedTilesProxy";
const QuickHull = require("quick-hull-2d");

// NOTE: duplicate. Consider factoring this out to yuka globals
const HANDEDNESS_LEFT = -1;
const HANDEDNESS_RIGHT = -1;
var USE_HANDEDNESS = HANDEDNESS_LEFT;

// export const AREA_CALC = Symbol('spawnAreaAvailable');
// export const AREA_CALC_SCORE = Symbol('spawnAreaScore');
// export const AREA_CALC_TIME = Symbol('spawnTimestamp');
// var PROCESS_ID = 0; // incrementing processID for timestamping

var CLIP_PLANES_BOX2D:CullingPlane;


const EPSILON = 0.00001;
const VISITED:Set<Polygon> = new Set();
export const VISITED_REGIONS:Map<Polygon, number> = new Map();

const VISITED_TILES:VisitedTilesProxy = new VisitedTilesProxy();
const STACK:Polygon[] = [];
const POINT = new Vector3();
const RAY:Ray = new Ray();
const BOUNDS:AABB = new AABB();
const BOUNDS2:AABB = new AABB();
const POLYGON_COMPASS:Polygon[] = new Array(4);
const AREA_QUERIES:Float32Array = new Float32Array(8);
const QUEUE:number[][] = [];
var TRI_FACE:Face = null;

export const TRI_SOUP:number[] = []; //10 values per tri. All triangles' points and area:  3x3 for 3 * xyz points + 1 area of entire triangle
export const TRI_RANGES_PER_REGION:number[] = []; // from/to tri counts + total rated area per region + full area per region (4 values)

var SPREAD_OUT_RATIO:number = 1.5;
export function setSpreadOutRatio(val:number) {
	SPREAD_OUT_RATIO = val;
}

function getNewTriFace() {
	let f:Face = new Face();
	let w:Wrapper;
	f.wrapper = w = new Wrapper();
	//w.vertex = new Vertex();
	w= w.next = new Wrapper();
	//w.vertex = new Vertex();
	w= w.next = new Wrapper();
	//w.vertex = new Vertex();
	return f;
}

function getNewPlanesBox2D() { // CSS border style order, but outward facing to represent inner bounds! // ClipMacros.clipWithPlaneList uses reversed logic..bleh!
	let headC = new CullingPlane();
	let c = headC;
	c.x = 0;
	c.y = 0;
	c.z = -1;
	c.offset = 0.5;

	c = c.next = new CullingPlane();
	c.x = 1;
	c.y = 0;
	c.z = 0;
	c.offset = 0.5;

	c = c.next = new CullingPlane();
	c.x = 0;
	c.y = 0;
	c.z = 1;
	c.offset = 0.5;

	c = c.next = new CullingPlane();
	c.x = -1;
	c.y = 0;
	c.z = 0;
	c.offset = 0.5;

	return headC;
}


/**
 * Calculates total walkable area from a single polygon given a tile sample bounding box
 * @param polygons The set of valid polygons to sample area within a specific tile location
 * @param clipBounds The precomputed clip boundaries
 */
export function getClippedFaceWithinClipBounds(polygon: Polygon, clipBounds:CullingPlane):Face {
	let makeshiftFace = yukaToAltPolygon(polygon);

	let clippedFace = ClipMacros.clipWithPlaneList(clipBounds, makeshiftFace);
	//if (!clippedFace) {
	//	console.warn("getAreaWithinClipBounds :: clip face result expected!");
	//}
	makeshiftFace.destroy();
	makeshiftFace.next = Face.collector;
	Face.collector = makeshiftFace;
	return clippedFace;
}

export function getClipPlanesInstanceForBox2D(center:Vector3, extentsX:number, extentsZ:number):CullingPlane {
	if (!CLIP_PLANES_BOX2D) {
		CLIP_PLANES_BOX2D = getNewPlanesBox2D();
	}

	let x;
	let z;

	// top right vertex reference (for north and east)
	x = center.x + extentsX;
	z = center.z - extentsZ;

	let headC = CLIP_PLANES_BOX2D;

	let c = headC;
	c.offset = x * c.x + z * c.z;

	c = c.next;
	c.offset = x * c.x + z * c.z;

	// bottom left vertex reference (for south and west)
	x = center.x - extentsX;
	z = center.z + extentsZ;

	c = c.next;
	c.offset = x * c.x + z * c.z;

	c = c.next;
	c.offset = x * c.x + z * c.z;
	return headC;
}

function getClipPlanesFromHullPoints( pts:number[][]):CullingPlane[] {
	let headC = CullingPlane.create();
	let c = headC;
	perpCullPlane(c, pts[0][0], pts[0][1], pts[1][0], pts[1][1]);
	let tailC;
	for (let i =1, l=pts.length; i < l; i++) {
		c = c.next = CullingPlane.create();
		let nextI = i < l - 1 ? i + 1 : 0;
		perpCullPlane(c, pts[i][0], pts[i][1], pts[nextI][0], pts[nextI][1]);
		tailC = c;
	}
	return [headC, tailC];
}

function clipRegionsWitCullingPlanes(regions:Map<Polygon, number>, cullingPlanes:CullingPlane[], getFaceAreaMethod:(face: Face)=> number, getAreaPenaltyMethod: (face: Face, polygon: Polygon) => number):AreaResults {
	if (!TRI_FACE) {
		TRI_FACE = getNewTriFace();
	}
	let triFace = TRI_FACE;
	let headC = cullingPlanes[0];
	let tailC = cullingPlanes[1];

	let headFace:Face = null;
	let tailFace:Face  = null;
	let entireSoupArea:number = 0;
	let totalRegionsArea:number = 0;

	const triSoup = TRI_SOUP;
	let tsi = 0;
	const triRanges = TRI_RANGES_PER_REGION;
	let tsr = 0;
	regions.forEach((v, p)=> {
		let face = getClippedFaceWithinClipBounds(p, headC);
		if (face) {
			if (headFace !== null) {
				tailFace.next = face;
			} else headFace = face;
			tailFace = face;

			// face.offset
			let triAw = triFace.wrapper;
			let triBw = triFace.wrapper.next;
			let triCw = triFace.wrapper.next.next;
		
			var areaAccum:number = 0;
			let w:Wrapper = face.wrapper.next;
			let wn:Wrapper = w.next;
			triAw.vertex = face.wrapper.vertex;

			triRanges[tsr++] = tsi;
			while (wn != null) {
				triBw.vertex = w.vertex;
				triCw.vertex = wn.vertex;
				triSoup[tsi++] = triAw.vertex.x;
				triSoup[tsi++] = triAw.vertex.y;
				triSoup[tsi++] = triAw.vertex.z;
				triSoup[tsi++] = triBw.vertex.x;
				triSoup[tsi++] = triBw.vertex.y;
				triSoup[tsi++] = triBw.vertex.z;
				triSoup[tsi++] = triCw.vertex.x;
				triSoup[tsi++] = triCw.vertex.y;
				triSoup[tsi++] = triCw.vertex.z;
				let areaToAdd = getFaceAreaMethod(triFace);
				triSoup[tsi++] = areaToAdd;
				areaAccum += areaToAdd;
				w = w.next;
				wn = wn.next;
			}
			entireSoupArea += areaAccum;
			let areaBeforeDeduct = areaAccum;
			areaAccum -= getAreaPenaltyMethod ? getAreaPenaltyMethod(face, p) : 0;
			if (areaAccum < 0) areaAccum = 0;
			triRanges[tsr++] = tsi; // end index
			totalRegionsArea += areaAccum;

			regions.set(p, tsr); // the index within tri-ranges where area of entire region can be found
			triRanges[tsr++] = areaAccum;
			triRanges[tsr++] = areaBeforeDeduct;
			
			DEBUG_CONTOURS.push(traceFaceContours(face));
			
			face.destroy();
		} else {
			regions.set(p, -1);
			// console.warn("No clip area found for region clip attempt by convex hull!")
		}
	});
	if (tailFace !== null) {
		tailFace.next = Face.collector;
		Face.collector = headFace;
	}

	triRanges.length = tsr;
	triSoup.length = tsi;

	if (tailC) {
		tailC.next = CullingPlane.collector;
		CullingPlane.collector = headC;
	}
	
	return [totalRegionsArea, entireSoupArea];
}

function perpCullPlane(c:CullingPlane, ax:number , az:number, bx:number, bz:number) {
	let dx = bx - ax;
	let dz = bz - az;
	let handedness = USE_HANDEDNESS;
	let d = Math.sqrt(dx*dx + dz*dz);
	dx/=d;
	dz/=d;
	// note that altern culling plane for this purpose is flipped, so dz and dx is already flipped
	// normals must point outward from anti-clockwise order of points
	c.x = -dz * handedness;
	c.y = 0;
	c.z = dx * handedness;
	c.offset = ax * c.x + az * c.z; 
}


export const DEBUG_CONTOURS:number[][] = [];

/**
 * Calculates total tiled area expanse used to best meet/exceed given area requirements from start navigation mesh polygon within tile sample consideration
 * @param startPolygon The start polygon to begin scanning for surrounding polygon regions (if needed) to meet total area required
 * @param tileCenter It is assumed tile center is situated at where the startPolygon is located at as well
 * @param xExtent The half x (length) extent of tile
 * @param zExtent The half z (breath) extent of tile
 * @param getFaceAreaMethod Method to calculate area to be gained from polygon sample. Defaults to 2D area of face (viewing from top-down).
 * @param getAreaPenaltyMethod Optional method to deduct from area agained, to penalise area.
 * @param totalAreaRequired Optional. If left unspecified, uses the 2D area of the tile (length * breath) as the total area required
 */
export function getRequiredTilesFromTile(startPolygon:Polygon, tileCenter: Vector3, xExtent: number, zExtent: number,
	getFaceAreaMethod?: (face: Face)=> number,
	getAreaPenaltyMethod?: (face: Face, polygon:Polygon) => number,
	totalAreaRequired?:number):AreaResults {
	if (!totalAreaRequired) {
		totalAreaRequired = (xExtent*2) * (zExtent*2);
	}
	if (!getFaceAreaMethod) getFaceAreaMethod = getArea2DOfFace;

	let compass = POLYGON_COMPASS;
	compass[0] = null; compass[1] = null; compass[2]= null; compass[3] = null;
	DEBUG_CONTOURS.length = 0;

	let visitedRegions = VISITED_REGIONS;
	visitedRegions.clear();

	let area = calcAreaScoreWithinTile(startPolygon, tileCenter, xExtent, zExtent, getFaceAreaMethod, getAreaPenaltyMethod, compass, visitedRegions);
	let clipHullAreaResults;

	if (area + EPSILON < totalAreaRequired) { // need to expand from current tile, start BFS, but prioroitise expanding best area gained
		let north = compass[0];
		let south = compass[2];
		let west = compass[3];
		let east = compass[1];
		let areaQueries = AREA_QUERIES;
		let visitedTiles = VISITED_TILES;
	
		visitedTiles.clear();
		// diagonals start from north east clockwise

		areaQueries[0] = null; compass[1] = null; compass[2]= null; compass[3] = null;
		let point = POINT;
		areaQueries.slice(0);

		let curTileCenter = tileCenter;
		let cX = 0;
		let cY = 0;
		let queue = QUEUE;
		queue.length = 0;
		queue.push([0, 0, 0, 0]);

		visitedTiles.set(cX,cY, area);
		area = 0;

		let ar;

		let expandCalcCount = 0;

		while (queue.length > 0) { // <- to convert this to BFS queue
			let tuples = queue.pop();
			cX = tuples[2];
			cY = tuples[3];
			areaQueries.fill(-1, 0, 8);

			for (let i=0, l=tuples.length; i<l; i+=2) {
				if (!visitedTiles.has(tuples[i],tuples[i+1])) {
					continue;
				}
				let areaToAdd = visitedTiles.get(tuples[i],tuples[i+1]);
				if (areaToAdd) visitedTiles.push(tuples[i],tuples[i+1]);
				area += areaToAdd;
				visitedTiles.set(tuples[i],tuples[i+1], 0); // if already processed area, reset back to zero
			}

			if (area >= totalAreaRequired) {
				break;
			}

			// search exaustively across all 8 direction tiles for best area expansion for BFS
			if (!visitedTiles.has((cX),(cY - 1)) && north) {
				compass[0] = null; compass[1] = null; compass[2]= null; compass[3] = null;
				expandCalcCount++;
				areaQueries[0] = ar = calcAreaScoreWithinTile(north, point.set(0, 0, -zExtent*2).add(curTileCenter), xExtent, zExtent, getFaceAreaMethod, getAreaPenaltyMethod, compass, visitedRegions);
				visitedTiles.set((cX),(cY - 1), ar);
				if (areaQueries[0] > EPSILON) {
					if (areaQueries[7] < 0 && compass[3] && !visitedTiles.has((cX-1),(cY - 1))) { // NW
						areaQueries[7] = ar = calcAreaScoreWithinTile(compass[3], point.set(-xExtent*2, 0, -zExtent*2).add(curTileCenter), xExtent, zExtent, getFaceAreaMethod, getAreaPenaltyMethod, null, visitedRegions);
						expandCalcCount++;
						visitedTiles.set((cX-1),(cY - 1), ar);
					}
					if (areaQueries[4] < 0 && compass[1] && !visitedTiles.has((cX+1),(cY - 1))) { // NE
						areaQueries[4] = ar = calcAreaScoreWithinTile(compass[1], point.set(xExtent*2, 0, -zExtent*2).add(curTileCenter), xExtent, zExtent, getFaceAreaMethod, getAreaPenaltyMethod, null, visitedRegions);
						expandCalcCount++;
						visitedTiles.set((cX+1),(cY - 1), ar);
					}
				}
			}
			if (!visitedTiles.has((cX+1),(cY)) && east) {
				compass[0] = null; compass[1] = null; compass[2]= null; compass[3] = null;
				expandCalcCount++;
				areaQueries[1] = ar = calcAreaScoreWithinTile(east, point.set(xExtent*2, 0, 0).add(curTileCenter), xExtent, zExtent, getFaceAreaMethod, getAreaPenaltyMethod, compass, visitedRegions);
				visitedTiles.set((cX+1),(cY), ar);
				if (areaQueries[1] > EPSILON) {
					if (areaQueries[4] < 0 && compass[0] && !visitedTiles.has((cX+1),(cY-1))) { // NE
						areaQueries[4] = ar = calcAreaScoreWithinTile(compass[0], point.set(xExtent*2, 0, -zExtent*2).add(curTileCenter), xExtent, zExtent, getFaceAreaMethod, getAreaPenaltyMethod, null, visitedRegions);
						expandCalcCount++;
						visitedTiles.set((cX+1),(cY-1), ar);
					}
					if (areaQueries[5] < 0 && compass[2] && !visitedTiles.has((cX+1),(cY+1))) { // SE
						areaQueries[5] = ar = calcAreaScoreWithinTile(compass[2], point.set(xExtent*2, 0, zExtent*2).add(curTileCenter), xExtent, zExtent, getFaceAreaMethod, getAreaPenaltyMethod, null, visitedRegions);
						expandCalcCount++;
						visitedTiles.set((cX+1),(cY+1), ar);
					}
				}
			}

			if (!visitedTiles.has((cX),(cY + 1)) && south) {
				compass[0] = null; compass[1] = null; compass[2]= null; compass[3] = null;
				expandCalcCount++;
				areaQueries[2] = ar = calcAreaScoreWithinTile(south, point.set(0, 0, zExtent*2).add(curTileCenter), xExtent, zExtent, getFaceAreaMethod, getAreaPenaltyMethod, compass, visitedRegions);
				visitedTiles.set((cX),(cY + 1), ar);
				if (areaQueries[2] > EPSILON) {
					if (areaQueries[5] < 0 && compass[1] && !visitedTiles.has((cX+1),(cY + 1))) { // SE
						areaQueries[5] = ar = calcAreaScoreWithinTile(compass[1], point.set(xExtent*2, 0, zExtent*2).add(curTileCenter), xExtent, zExtent, getFaceAreaMethod, getAreaPenaltyMethod, null, visitedRegions);
						expandCalcCount++;
						visitedTiles.set((cX+1),(cY + 1), ar);
					}
					if (areaQueries[6] < 0 && compass[3] && !visitedTiles.has((cX-1),(cY + 1))) { // SW
						areaQueries[6] = ar = calcAreaScoreWithinTile(compass[3], point.set(-xExtent*2, 0, zExtent*2).add(curTileCenter), xExtent, zExtent, getFaceAreaMethod, getAreaPenaltyMethod, null, visitedRegions);
						expandCalcCount++;
						visitedTiles.set((cX-1),(cY + 1), ar);
					}
				}
			}
			if (!visitedTiles.has((cX - 1),(cY)) && west) {
				compass[0] = null; compass[1] = null; compass[2]= null; compass[3] = null;
				expandCalcCount++;
				areaQueries[3] = ar = calcAreaScoreWithinTile(west, point.set(0, 0, -zExtent*2).add(curTileCenter), xExtent, zExtent, getFaceAreaMethod, getAreaPenaltyMethod, compass, visitedRegions);
				visitedTiles.set((cX - 1),(cY), ar);
				if (areaQueries[3] > EPSILON) {
					if (areaQueries[6] < 0 && compass[2] && !visitedTiles.has((cX - 1),(cY + 1))) { // SW
						areaQueries[6] = ar =  calcAreaScoreWithinTile(compass[2], point.set(-xExtent*2, 0, zExtent*2).add(curTileCenter), xExtent, zExtent, getFaceAreaMethod, getAreaPenaltyMethod, null, visitedRegions);
						expandCalcCount++;
						visitedTiles.set((cX - 1),(cY + 1), ar);
					}
					if (areaQueries[7] < 0 && compass[0] && !visitedTiles.has((cX - 1),(cY - 1))) { // NW
						areaQueries[7] = ar = calcAreaScoreWithinTile(compass[0], point.set(-xExtent*2, 0, -zExtent*2).add(curTileCenter), xExtent, zExtent, getFaceAreaMethod, getAreaPenaltyMethod, null, visitedRegions);
						expandCalcCount++;
						visitedTiles.set((cX - 1),(cY - 1), ar);
					}
				}
			}

			enqueueByAreaScore(queue, areaQueries, cX, cY);
		}
		/*
		if (!expandCalcCount) {
			console.log("None found!")
		}
		*/

		let hullPoints = new Array(visitedTiles.len/2*4);
		let hi = 0;
		for (let i=0, l=visitedTiles.len; i<l; i+=2) {
			let tx = tileCenter.x + visitedTiles.resultsCache[i]*xExtent*2;
			let tz = tileCenter.z + visitedTiles.resultsCache[i+1]*zExtent*2;
			hullPoints[hi++] = [ tx - xExtent, tz - zExtent ];
			hullPoints[hi++] = [ tx + xExtent, tz - zExtent ];
			hullPoints[hi++] = [ tx - xExtent, tz + zExtent ];
			hullPoints[hi++] = [ tx + xExtent, tz + zExtent ];
		}
		let resultHull = QuickHull(hullPoints);
		// DEBUG_CONTOURS.push(traceHullContour(resultHull));
		let lastArea = area;
		clipHullAreaResults = clipRegionsWitCullingPlanes(visitedRegions, getClipPlanesFromHullPoints(resultHull), getFaceAreaMethod, getAreaPenaltyMethod);
		area = clipHullAreaResults[0];
		//console.log(lastArea+'/'+area + ' vst ' + totalAreaRequired + " ::"+resultHull.length);
		if (area < totalAreaRequired) {
			console.warn("Failed to meet area reuired:" + lastArea+'/'+area+'/'+clipHullAreaResults[1] + ' vst ' + totalAreaRequired + " ::"+resultHull.length )
		}
		return clipHullAreaResults;
	}
	 // DEBUG_CONTOURS.push(traceTileContours(tileCenter.x, tileCenter.z, xExtent, zExtent));
	 // console.log(area + ' vs ' + totalAreaRequired);

	
	clipHullAreaResults = clipRegionsWitCullingPlanes(visitedRegions, [getClipPlanesInstanceForBox2D(tileCenter, xExtent*SPREAD_OUT_RATIO, zExtent*SPREAD_OUT_RATIO)], 
						   getFaceAreaMethod, getAreaPenaltyMethod); 
	return clipHullAreaResults;
	// return set of All tiles and available area across all tiles,
	// which can be used as a sample space guide bound within world to flood fill areas or survey nearby walkable areas
}

// get random point for tri soup
// or get random point through region
export type AreaResults = [number, number, number?]

/*
SAmple immediately 
Reservoire sampling all regions visited regions (up to areascore limit quota per region), than weigted sampling for tri within region.
TRI_SOUP (Or may fill up to max per tri, pick closest compact to startPoint? ... too close to others clamped to agent radius).

OR
Weight sampling of all regions in soup, then weigted sampling within triaangle
TRI_RANGES_PER_REGION, VISITED_REGIONS

TO integrate wit
// Consider dylkstria stream into reservoire from VISITED_REGIONS...
OR // K nearest neighbor within treshold, pick largest distance nearest neighbor to continue sampling for neighbors
*/

export function getFillableVisitedRegions():Polygon[] {
	let arr:Polygon[] = [];
	VISITED_REGIONS.forEach((value, key)=> {
		if (value >= 2) {
			arr.push(key);
		}
	})
	return arr;
}

export function getAreaOfRegion(region:Polygon) {
	let index = VISITED_REGIONS.get(region);
	if (index >= 2 && (index & 1)) {
		throw new Error("invalid area index query found!");
	}
	return index >= 2 ? TRI_RANGES_PER_REGION[index] : 0;
}

export function setAreaOfRegion(region:Polygon, val:number):boolean {
	let index = VISITED_REGIONS.get(region);
	if (index >= 2 && (index & 1)) {
		throw new Error("invalid area index query found!");
	}
	if (index >= 2){
		TRI_RANGES_PER_REGION[index] = val;
		return true;
	} 
	return false;
}

export type TriSample = {
	a: Vector3,
	b: Vector3,
	c: Vector3,
	region: Polygon,
	randOffset: number,
	triArea: number,
	triIndex: number
};

export function getNewTriSample(a:Vector3, b:Vector3, c:Vector3):TriSample {
	return {
		a, b, c,
		region: null,
		randOffset: 0,
		triArea: -1,
		triIndex: -1
	}
}

export function setAreaAtTriIndex(triIndex:number, val:number):void {
	TRI_SOUP[triIndex + 9] = val;
}

function getTotalAreasOfRegions(regions:Polygon[],  areaResults:AreaResults, fromIndex:number, toLenIndex:number) {
	let totalArea = 0;
	if (areaResults.length >= 3) {
		if (areaResults[2] < 0) {
			for (let i = fromIndex; i< toLenIndex; i++) {
				totalArea += getAreaOfRegion(regions[i]);
			}
			areaResults[2] = totalArea;
		} else {
			totalArea = areaResults[2];
		}
	} else {
		for (let i = fromIndex; i< toLenIndex; i++) {
			totalArea += getAreaOfRegion(regions[i]);
		}
	}
	return totalArea;
}

export function sampleRegionTriWeighted(triSample:TriSample, regions:Polygon[], areaResults:AreaResults, randFunc:()=>number, randFuncTri:()=>number=null, fromIndex:number=0, toLenIndex:number=null) {
	// 	// VISITED_REGIONS -> TRI_RANGES_PER_REGION  vs areaResults[0]  region-rated area
	if (toLenIndex === null) {
		toLenIndex = regions.length;
	}
	if (randFuncTri === null) randFuncTri = randFunc;
	
	let totalArea = fromIndex === 0 && toLenIndex === regions.length ? areaResults[0] : getTotalAreasOfRegions(regions, areaResults, fromIndex, toLenIndex);
	if (totalArea <= 0) {
		return null;
	}
	
	const visitedRegions = VISITED_REGIONS;
	const triRanges = TRI_RANGES_PER_REGION;
	let r = randFunc() * totalArea;
	let areaAccum = 0;
	let chosenRegion = null;
	let chosenAreaIndex = 0;

	for (let i = fromIndex; i< toLenIndex; i++) {
		let polygon = regions[i];
		let areaIndex = visitedRegions.get(polygon);
		if (areaIndex >= 2) {
			let area = triRanges[areaIndex];
			if (r >= areaAccum && r < (areaAccum + area)) {
				chosenRegion = polygon;
				chosenAreaIndex = areaIndex;
				break;
			}
			areaAccum += area;
			
		} else {
			// auto-calculate if not found in cache instead of throw error?
			throw new Error("invalid area access attempt on list of given regions!")
		}
	}

	if (chosenRegion) {
		return _sampleTriFromRegion(triSample, chosenRegion, triRanges[chosenAreaIndex+1], triRanges[chosenAreaIndex-2], triRanges[chosenAreaIndex - 1], randFuncTri());
	}
	return null;
}

export function sampleRegionTriReservoir(triSample:TriSample, regions:Polygon[], areaResults:AreaResults, randFunc:()=>number, randFuncTri:()=>number=null, fromIndex:number=0, toLenIndex:number=null) {
	// VISITED_REGIONS -> TRI_RANGES_PER_REGION  vs areaResults[0]  region-rated area
	if (toLenIndex === null) {
		toLenIndex = regions.length;
	}
	if (randFuncTri === null) randFuncTri = randFunc;

	const visitedRegions = VISITED_REGIONS;
	const triRanges = TRI_RANGES_PER_REGION;
	let areaSum = 0;
	let chosenRegion = null;
	let chosenAreaIndex = 0;
	for (let i = fromIndex; i< toLenIndex; i++) {
		let polygon = regions[i];
		let areaIndex = visitedRegions.get(polygon);
		if (areaIndex >= 2) {
			let area = triRanges[areaIndex];
			areaSum += area;
			if (area >= randFunc() * areaSum) {
				chosenRegion = polygon;
				chosenAreaIndex = areaIndex;
			}
		} else {
			// dev assertion
			// auto-calculate if not found in cache instead of throw error?
			throw new Error("invalid area access attempt on list of given regions!")
		}
	}

	if (chosenRegion) {
		return _sampleTriFromRegion(triSample, chosenRegion, triRanges[chosenAreaIndex+1], triRanges[chosenAreaIndex-2], triRanges[chosenAreaIndex - 1], randFuncTri());
	}
	return null;
}

export function sampleTriWeighted(triSample:TriSample, areaResults:AreaResults, randFunc:()=>number) {
	return _sampleTriFromRegion(triSample, null, areaResults[1], 0, TRI_SOUP.length, randFunc());
}

function _sampleTriFromRegion(triSample:TriSample, region:Polygon, regionArea:number, fromIndex:number, toIndex:number, r:number) {
	r *= regionArea;

	triSample.region = region;
	const triSoup = TRI_SOUP;
	let areaAccum = 0;
	let ti = -1;
	for (let i = fromIndex; i< toIndex; i+=10) {
		let area = triSoup[i+9];
		if (r >= areaAccum && r < (areaAccum + area)) {
			triSample.randOffset = (r - areaAccum) / area;
			triSample.triArea = area;
			triSample.triIndex = i;
			ti = i;
			break;
		}
		areaAccum += area;
	}
	if (ti < 0) return null;
	
	triSample.a.x = triSoup[ti++];
	triSample.a.y = triSoup[ti++];
	triSample.a.z = triSoup[ti++];

	triSample.b.x = triSoup[ti++];
	triSample.b.y = triSoup[ti++];
	triSample.b.z = triSoup[ti++];

	triSample.c.x = triSoup[ti++];
	triSample.c.y = triSoup[ti++];
	triSample.c.z = triSoup[ti++];

	return triSample;
}

type ScoreTraverse = {area:number, payload?:number[], coverage?:number};

const TABULATE_SCORES: ScoreTraverse[] = (() => {
	return [
		{area:0},
		{area:0},
		{area:0},
		{area:0},
		{area:0},
		{area:0},
		{area:0},
		{area:0}
	];
})();

function totalAreaScoreCombi(a:number, b:number, c:number, Ax:number,  Ay:number, Bx:number,  By:number, Cx:number, Cy:number, score:ScoreTraverse, x:number, y:number) {
	score.area = (a >= 0 ? a : 0) + (b >= 0 ? b: 0) + (c >=0 ? c: 0);
	score.payload = [Ax, Ay, Bx, By, Cx, Cy];
	let coverage = 0;
	coverage |= VISITED_TILES.get(Ax, Ay) > EPSILON ? (1 << ((Ax - x + 1) * 3 + (Ay - y + 1))) : 0;
	coverage |=  VISITED_TILES.get(Bx, By) > EPSILON ? (1 << ((Bx - x + 1) * 3 + (By - y + 1))) : 0;
	coverage |=  VISITED_TILES.get(Cx, Cy) > EPSILON ? (1 << ((Cx - x + 1) * 3 + (Cy - y + 1))) : 0;
	score.coverage = coverage;

}

function enqueueByAreaScore(queue:number[][], areaQueries:Float32Array, x:number, y:number) {
	let scores = TABULATE_SCORES;
	
	// clockwise from 12 o-click
	totalAreaScoreCombi(areaQueries[7], areaQueries[0], areaQueries[4], x-1, y-1,  x, y-1,  x+1, y-1, scores[0], x, y);
	totalAreaScoreCombi(areaQueries[0], areaQueries[4], areaQueries[1], x, y-1,  x+1, y-1,  x+1, y, scores[1], x, y);
	totalAreaScoreCombi(areaQueries[4], areaQueries[1], areaQueries[5], x+1, y-1,  x+1, y,  x+1, y+1, scores[2], x, y);
	totalAreaScoreCombi(areaQueries[1], areaQueries[5], areaQueries[2], x+1, y,  x+1, y+1,  x, y+1, scores[3], x, y);
	totalAreaScoreCombi(areaQueries[5], areaQueries[2], areaQueries[6], x+1, y+1,  x, y+1,  x-1, y+1, scores[4], x, y);
	totalAreaScoreCombi(areaQueries[2], areaQueries[6], areaQueries[3], x, y+1,  x-1, y+1,  x-1, y, scores[5], x, y);
	totalAreaScoreCombi(areaQueries[6], areaQueries[3], areaQueries[7], x-1, y+1,  x-1, y,  x-1, y-1, scores[6], x, y);
	totalAreaScoreCombi(areaQueries[3], areaQueries[7], areaQueries[0], x-1, y,  x-1, y-1,  x, y-1, scores[7], x, y);

	scores.sort(compare);
	let coveredMask = 0;
	for (let i=0; i<8; i++ ){
		let score = scores[i];
		if (score.area <=EPSILON) break;
		if ( (score.coverage & (~coveredMask))!==0 ) {
			queue.push(score.payload);
			coveredMask |= score.coverage;
		} 
	}

}


function compare( a:ScoreTraverse, b:ScoreTraverse ) {
	return ( a.area > b.area ) ? - 1 : ( a.area < b.area ) ? 1 : 0;
}



/**
 * Calculates total area score gained from given tile area
 * @param startPolygon The start polygon to begin scanning for current and surrounding polygon regions
 * @param tileCenter It is assumed tile center is situated at where the startPolygon is located at as well
 * @param xExtent The half x (length) extent of tile
 * @param zExtent The half z (breath) extent of tile
 * @param getFaceAreaMethod Method to calculate area to be gained from polygon sample. Defaults to 2D area of face (viewing from top-down).
 * @param getAreaPenaltyMethod Optional method to deduct from area gained, to penalise area.
 * @param compass Mainly for internal use. An array of size 4 to keep track of first encountered clipped polygon for each AABB border edge
 */
export function calcAreaScoreWithinTile(startPolygon:Polygon, tileCenter: Vector3, xExtent: number, zExtent: number,
	getFaceAreaMethod: (face: Face)=> number,
	getAreaPenaltyMethod?: (face: Face, polygon: Polygon) => number, compass?:Polygon[], globalVisited?:Map<Polygon, number>):number {
	let tileClipBounds = getClipPlanesInstanceForBox2D(tileCenter, xExtent, zExtent);

	let aabb = BOUNDS;
	let ray = RAY;
	aabb.min.x = tileCenter.x - xExtent;
	aabb.min.y = Number.MIN_SAFE_INTEGER;
	aabb.min.z = tileCenter.z - zExtent;
	aabb.max.x = tileCenter.x + xExtent;
	aabb.max.y = Number.MAX_SAFE_INTEGER;
	aabb.max.z = tileCenter.z + zExtent;

	let visited = VISITED;
	visited.clear();

	let stack = STACK;
	stack[0] = startPolygon;
	let si = 1;
	let areaScore = 0;
	//let clipCount = 0;

	while (--si >= 0) {
		let polygon = STACK[si];
		if (visited.has(polygon)) {
			continue;
		}
		visited.add(polygon);

		let clippedFace = getClippedFaceWithinClipBounds(polygon, tileClipBounds)
		//clipCount += clippedFace ? 1 : 0;
		if (compass) {
			let clipBordersTriggered = ClipMacros.CLIP_PLANES_TRIGGERED;
			if (compass[0]===null && (clipBordersTriggered & 1)!==0) {
				compass[0] = polygon;
				//console.log("expand north:" + (polygon === startPolygon));
			}
			if (compass[1]===null && (clipBordersTriggered & 2)!==0) {
				compass[1] = polygon;
				//console.log("expand east:" + (polygon === startPolygon));
			}
			if (compass[2]===null && (clipBordersTriggered & 4)!==0) {
				compass[2] = polygon;
				//console.log("expand south:" + (polygon === startPolygon));
			}
			if (compass[3]===null && (clipBordersTriggered & 8)!==0) {
				compass[3] = polygon;
				//console.log("expand west:" + (polygon === startPolygon));
			}
		}
		//clipBordersTriggered & 1 ?
		let areaToAdd = clippedFace ? getFaceAreaMethod(clippedFace)  : 0;

		//if ((polygon as any)[AREA_CALC] === undefined) {
		//	(polygon as any)[AREA_CALC] = 0;
		//	(polygon as any)[AREA_CALC_SCORE] = 0;
		//}
		//(polygon as any)[AREA_CALC] += areaToAdd;
		areaToAdd -= getAreaPenaltyMethod ? getAreaPenaltyMethod(clippedFace, polygon) : 0;
		//(polygon as any)[AREA_CALC_SCORE] += areaToAdd;
		if (areaToAdd < 0) areaToAdd = 0; // sanity bounds, negative penalties cannot reduce area to negative
		areaScore += areaToAdd;
		if (clippedFace) {
			//if (polygon !== startPolygon) {
				//DEBUG_CONTOURS.push(traceFaceContours(clippedFace));
				//console.log("adding extra:"+areaToAdd);
			//}
			clippedFace.destroy();
			clippedFace.next = Face.collector;
			Face.collector = clippedFace;
		}
		let edge = polygon.edge;
		do {
			if (edge.twin !== null && !visited.has(edge.twin.polygon)) {
				if ( !(edge.vertex.x < aabb.min.x || edge.vertex.x > aabb.max.x ||
					//edge.vertex.y < aabb.min.y || edge.vertex.y > aabb.max.y ||
					edge.vertex.z < aabb.min.z || edge.vertex.z > aabb.max.z
					 )
					||
					!(edge.prev.vertex.x < aabb.min.x || edge.prev.vertex.x > aabb.max.x ||
						//edge.prev.vertex.y < aabb.min.y || edge.prev.vertex.y > aabb.max.y ||
						edge.prev.vertex.z < aabb.min.z || edge.prev.vertex.z > aabb.max.z
					 )
				 	) {
					stack[si++] = edge.twin.polygon;
					//console.log("ADDED portaled polygon11");
				} else { // both points lie outside, does the ray interesects bounds?
					// consiedr aabb vs aabb test?
					ray.origin.x = edge.prev.vertex.x;
					ray.origin.y = edge.prev.vertex.y;
					ray.origin.z = edge.prev.vertex.z;
					ray.direction.x = edge.vertex.x - ray.origin.x;
					ray.direction.y = edge.vertex.y - ray.origin.y;
					ray.direction.z = edge.vertex.z - ray.origin.z;
					if (ray.intersectsAABB(aabb)) {
						stack[si++] = edge.twin.polygon;
						//console.log("ADDED portaled polygon");
					}
				}
			}
			edge = edge.next;
		} while(edge !== polygon.edge)
	}
	//console.log(visited.size);
	//console.log("clipped:"+clipCount);
	if (globalVisited) {
		visited.forEach(function(r){globalVisited.set(r,0)},globalVisited);
	}
	return areaScore;
}

export function getArea2DOfFace(face:Face):number {
	var w:Wrapper;
	var a:Vertex = face.wrapper.vertex;

	var areaAccum:number = 0;
	w = face.wrapper.next;
	var wn:Wrapper = w.next;
	while (wn != null) {
		var b:Vertex = w.vertex;
		var c:Vertex = wn.vertex;
		areaAccum += (( c.x - a.x ) * ( b.z - a.z ) - ( b.x - a.x ) * ( c.z - a.z )) * 0.5;
		w = w.next;
		wn = wn.next;
	}
	return areaAccum;
}

export function get3DSurfaceAreaFace(face:Face):number {
	return face.getArea();
}


function traceTileContours(x:number, z:number, xT:number, zT:number):number[] {
	let numArr = [];
	let ni = 0;

	numArr[ni++] = x - xT;
	numArr[ni++] = 0;
	numArr[ni++] = z - zT;

	numArr[ni++] = x + xT;
	numArr[ni++] = 0;
	numArr[ni++] = z - zT;


	numArr[ni++] = x + xT;
	numArr[ni++] = 0;
	numArr[ni++] = z - zT;

	numArr[ni++] = x + xT;
	numArr[ni++] = 0;
	numArr[ni++] = z + zT;


	numArr[ni++] = x + xT;
	numArr[ni++] = 0;
	numArr[ni++] = z + zT;

	numArr[ni++] = x - xT;
	numArr[ni++] = 0;
	numArr[ni++] = z + zT;


	numArr[ni++] = x - xT;
	numArr[ni++] = 0;
	numArr[ni++] = z + zT;

	numArr[ni++] = x - xT;
	numArr[ni++] = 0;
	numArr[ni++] = z - zT;


	return numArr;
}

function traceFaceContours(face:Face):number[] {
	let numArr = [];
	let ni = 0;
	let lastW = face.wrapper;
	for (let w:Wrapper = face.wrapper.next; w!=null; w=w.next) {
		numArr[ni++] = lastW.vertex.x;
		numArr[ni++] = lastW.vertex.y;
		numArr[ni++] = lastW.vertex.z;

		numArr[ni++] = w.vertex.x;
		numArr[ni++] = w.vertex.y;
		numArr[ni++] = w.vertex.z;
		lastW = w;
	}
	numArr[ni++] = lastW.vertex.x;
	numArr[ni++] = lastW.vertex.y;
	numArr[ni++] = lastW.vertex.z;

	numArr[ni++] = face.wrapper.vertex.x;
	numArr[ni++] = face.wrapper.vertex.y;
	numArr[ni++] = face.wrapper.vertex.z;

	return numArr;
}

function traceHullContour(contours:any) {
	let numArr = [];
	let ni = 0;
	let lastPt
	for (let i = 0, l=contours.length; i < l; i++) {
		let pt = contours[i];
		lastPt = i !== 0 ? contours[i-1] : contours[contours.length-1];
		numArr[ni++] = lastPt[0];
		numArr[ni++] = 0;
		numArr[ni++] = lastPt[1];


		numArr[ni++] = pt[0];
		numArr[ni++] = 0;
		numArr[ni++] = pt[1];
	}

	return numArr;
}
