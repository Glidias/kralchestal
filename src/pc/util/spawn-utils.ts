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
const VISITED_REGIONS:Map<Polygon, number> = new Map();
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

function clipRegionsWithHullPoints(regions:Map<Polygon, number>, pts:number[][], getFaceAreaMethod:(face: Face)=> number, getAreaPenaltyMethod: (face: Face, polygon: Polygon) => number) {
	if (!TRI_FACE) {
		TRI_FACE = getNewTriFace();
	}
	let triFace = TRI_FACE;
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

	let headFace:Face = null;
	let tailFace:Face  = null;
	let entireSoupArea:number = 0;
	let totalRegionsArea:number = 0;
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

			while (wn != null) {
				triBw.vertex = w.vertex;
				triCw.vertex = wn.vertex;
				let areaToAdd = getFaceAreaMethod(triFace);
				areaAccum += areaToAdd;
				entireSoupArea += areaToAdd;
				w = w.next;
				wn = wn.next;
			}
			areaAccum -= getAreaPenaltyMethod ? getAreaPenaltyMethod(face, p) : 0;
			if (areaAccum < 0) areaAccum = 0;

			totalRegionsArea += areaAccum;
			regions.set(p, areaAccum);
			DEBUG_CONTOURS.push(traceFaceContours(face));
			
			face.destroy();
		} else {
			console.warn("No clip area found for region clip attempt by convex hull!")
		}
	});
	if (tailFace !== null) {
		tailFace.next = Face.collector;
		Face.collector = headFace;
	}
	return [totalRegionsArea, entireSoupArea];
}

function perpCullPlane(c:CullingPlane, ax:number , az:number, bx:number, bz:number) {
	let dx = bx - ax;
	let dz = bz - az;
	let handedness = USE_HANDEDNESS;
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
	totalAreaRequired?:number):number {
	if (!totalAreaRequired) {
		totalAreaRequired = (xExtent*2) * (zExtent*2);
	}
	if (!getFaceAreaMethod) getFaceAreaMethod = getArea2DOfFace;

	let compass = POLYGON_COMPASS;
	compass[0] = null; compass[1] = null; compass[2]= null; compass[3] = null;
	DEBUG_CONTOURS.length = 0;

	let area = calcAreaScoreWithinTile(startPolygon, tileCenter, xExtent, zExtent, getFaceAreaMethod, getAreaPenaltyMethod, compass);

	if (area + EPSILON < totalAreaRequired) { // need to expand from current tile, start BFS, but prioroitise expanding best area gained
		let north = compass[0];
		let south = compass[2];
		let west = compass[3];
		let east = compass[1];
		let areaQueries = AREA_QUERIES;
		let visitedTiles = VISITED_TILES;
		let visitedRegions = VISITED_REGIONS;

		visitedRegions.clear();
		VISITED.forEach(function(r){visitedRegions.set(r,0)}, visitedRegions);

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
				areaQueries[3] = ar = calcAreaScoreWithinTile(west, point.set(0, 0, -zExtent*2).add(curTileCenter), xExtent, zExtent, getFaceAreaMethod, getAreaPenaltyMethod, compass);
				visitedTiles.set((cX - 1),(cY), ar);
				if (areaQueries[3] > EPSILON) {
					if (areaQueries[6] < 0 && compass[2] && !visitedTiles.has((cX - 1),(cY + 1))) { // SW
						areaQueries[6] = ar =  calcAreaScoreWithinTile(compass[2], point.set(-xExtent*2, 0, zExtent*2).add(curTileCenter), xExtent, zExtent, getFaceAreaMethod, getAreaPenaltyMethod, null);
						expandCalcCount++;
						visitedTiles.set((cX - 1),(cY + 1), ar);
					}
					if (areaQueries[7] < 0 && compass[0] && !visitedTiles.has((cX - 1),(cY - 1))) { // NW
						areaQueries[7] = ar = calcAreaScoreWithinTile(compass[0], point.set(-xExtent*2, 0, -zExtent*2).add(curTileCenter), xExtent, zExtent, getFaceAreaMethod, getAreaPenaltyMethod, null);
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
		
		area = clipRegionsWithHullPoints(visitedRegions, resultHull, getFaceAreaMethod, getAreaPenaltyMethod)[0];
		console.log(area + ' vst ' + totalAreaRequired + " ::"+resultHull.length);
		return area;
	}
	

	 DEBUG_CONTOURS.push(traceTileContours(tileCenter.x, tileCenter.z, xExtent, zExtent));
	 console.log(area + ' vs ' + totalAreaRequired);

	return area;
	// return set of All tiles and available area across all tiles,
	// which can be used as a sample space guide bound within world to flood fill areas or survey nearby walkable areas
}

type ScoreTraverse = {area:number, payload?:number[]};

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

function totalAreaScoreCombi(a:number, b:number, c:number, Ax:number,  Ay:number, Bx:number,  By:number, Cx:number, Cy:number, score:ScoreTraverse) {
	score.area = (a >= 0 ? a : 0) + (b >= 0 ? b: 0) + (c >=0 ? c: 0);
	score.payload = [Ax, Ay, Bx, By, Cx, Cy];
}

function isTraversibleScorePayload(payload:number[]) {
	return VISITED_TILES.get(payload[0],payload[1]) > EPSILON && VISITED_TILES.get(payload[2],payload[3]) > EPSILON && VISITED_TILES.get(payload[4],payload[5]) > EPSILON;
}

function enqueueByAreaScore(queue:number[][], areaQueries:Float32Array, x:number, y:number) {
	let scores = TABULATE_SCORES;
	for (let i=0; i<8; i++ ){
		// clockwise from 12 o-click
		totalAreaScoreCombi(areaQueries[7], areaQueries[0], areaQueries[4], x-1, y-1,  x, y-1,  x+1, y-1, scores[0]);
		totalAreaScoreCombi(areaQueries[0], areaQueries[4], areaQueries[1], x, y-1,  x+1, y-1,  x+1, y, scores[1]);
		totalAreaScoreCombi(areaQueries[4], areaQueries[1], areaQueries[5], x+1, y-1,  x+1, y,  x+1, y+1, scores[2]);
		totalAreaScoreCombi(areaQueries[1], areaQueries[5], areaQueries[2], x+1, y,  x+1, y+1,  x, y+1, scores[3]);
		totalAreaScoreCombi(areaQueries[5], areaQueries[2], areaQueries[6], x+1, y+1,  x, y+1,  x-1, y+1, scores[4]);
		totalAreaScoreCombi(areaQueries[2], areaQueries[6], areaQueries[3], x, y+1,  x-1, y+1,  x-1, y, scores[5]);
		totalAreaScoreCombi(areaQueries[6], areaQueries[3], areaQueries[7], x-1, y+1,  x-1, y,  x-1, y-1, scores[6]);
		totalAreaScoreCombi(areaQueries[3], areaQueries[7], areaQueries[0], x-1, y,  x-1, y-1,  x, y-1, scores[7]);
	}

	scores.sort(compare);
	for (let i=0; i<8; i++ ){
		let score = scores[i];
		if (score.area <=EPSILON) break;
		if (isTraversibleScorePayload(score.payload)) queue.push(score.payload);
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


// Final result of spawning samples can involve several approaches
/*
  Reservoire sampling using existing navmesh graph with Dilkshrya, favoring start to ending polygon region,
  weighted areas per region

  Flood fill all points...(hashed) across entire region with optional filter,
  then get all nearest neighbor points beginning from starting point... (repeat process recursively for all points)
*/


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
