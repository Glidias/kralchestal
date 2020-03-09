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

// export const AREA_CALC = Symbol('spawnAreaAvailable');
// export const AREA_CALC_SCORE = Symbol('spawnAreaScore');
// export const AREA_CALC_TIME = Symbol('spawnTimestamp');
// var PROCESS_ID = 0; // incrementing processID for timestamping

var CLIP_PLANES_BOX2D:CullingPlane;



const VISITED:Set<Polygon> = new Set();
const STACK:Polygon[] = [];
const POINT = new Vector3();
const RAY:Ray = new Ray();
const BOUNDS:AABB = new AABB();
const BOUNDS2:AABB = new AABB();
const POLYGON_COMPASS:Polygon[] = new Array(4);
const AREA_QUERIES:Float32Array = new Float32Array(8);

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
		//console.warn("getAreaWithinClipBounds :: clip face result expected!");
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

export function getClipFaceWithinClipPolygon(polygon: Polygon, clipPolygon: Polygon) {

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
	getAreaPenaltyMethod?: (face: Face, polygon:Polygon, tileCenter: Vector3, xExtent: number, zExtent: number) => number,
	totalAreaRequired?:number):number {
	if (!totalAreaRequired) {
		totalAreaRequired = (xExtent*2) * (zExtent*2);
	}
	if (!getFaceAreaMethod) getFaceAreaMethod = getArea2DOfFace;

	let compass = POLYGON_COMPASS;
	compass[0] = null; compass[1] = null; compass[2]= null; compass[3] = null;
	DEBUG_CONTOURS.length = 0;

	let area = calcAreaScoreWithinTile(startPolygon, tileCenter, xExtent, zExtent, getFaceAreaMethod, getAreaPenaltyMethod, compass);
	
	if (area < totalAreaRequired) { // need to expand from current tile
		let north = compass[0];
		let south = compass[2];
		let west = compass[3];
		let east = compass[1];
		let areaQueries = AREA_QUERIES;
		let point = POINT;

		while (area < totalAreaRequired) {
			let expandCalcCount = 0;
			
			if (north) {
				compass[0] = null; compass[1] = null; compass[2]= null; compass[3] = null;
				expandCalcCount++;
				areaQueries[0] = calcAreaScoreWithinTile(north, point.set(0, 0, -zExtent*2).add(tileCenter), xExtent, zExtent, getFaceAreaMethod, getAreaPenaltyMethod, compass);
			}

			//AREA_QUERIES[4] = calcAreaScoreWithinTile(, point.set(0, 0, -zExtent*2).add(tileCenter), xExtent, zExtent, getFaceAreaMethod, getAreaPenaltyMethod, compass) : 0;
			if (east) {
				compass[0] = null; compass[1] = null; compass[2]= null; compass[3] = null;
				expandCalcCount++;
				areaQueries[1] = calcAreaScoreWithinTile(east, point.set(xExtent*2, 0, 0).add(tileCenter), xExtent, zExtent, getFaceAreaMethod, getAreaPenaltyMethod, compass);
			}

			if (south) {
				compass[0] = null; compass[1] = null; compass[2]= null; compass[3] = null;
				expandCalcCount++;
				areaQueries[2] = calcAreaScoreWithinTile(south, point.set(0, 0, zExtent*2).add(tileCenter), xExtent, zExtent, getFaceAreaMethod, getAreaPenaltyMethod, compass);
			}
			if (west) {
				compass[0] = null; compass[1] = null; compass[2]= null; compass[3] = null;
				expandCalcCount++;
				areaQueries[3] = calcAreaScoreWithinTile(west, point.set(0, 0, -zExtent*2).add(tileCenter), xExtent, zExtent, getFaceAreaMethod, getAreaPenaltyMethod, compass);
				// area += calcAreaScoreWithinTile();
			}
			
			if (!expandCalcCount) {
				console.log("None found!")
			}
			break;
		}
	}

	
	 console.log(area + ' vs ' + totalAreaRequired);

	return area;
	// return set of All tiles and available area across all tiles,
	// which can be used as a sample space guide bound within world to flood fill areas or survey nearby walkable areas
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
	getAreaPenaltyMethod?: (face: Face, polygon:Polygon, tileCenter: Vector3, xExtent: number, zExtent: number) => number, compass?:Polygon[]):number {
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

	while (--si >= 0) {
		let polygon = STACK[si];
		if (visited.has(polygon)) {
			continue;
		}
		visited.add(polygon);

		let clippedFace = getClippedFaceWithinClipBounds(polygon, tileClipBounds)
		
		if (compass) {
			let clipBordersTriggered = ClipMacros.CLIP_PLANES_TRIGGERED;
			if (compass[0]===null && (clipBordersTriggered & 1)!==0) {
				compass[0] = polygon;
				console.log("expand north:" + (polygon === startPolygon));
			}
			if (compass[1]===null && (clipBordersTriggered & 2)!==0) {
				compass[1] = polygon;
				console.log("expand east:" + (polygon === startPolygon));
			}
			if (compass[2]===null && (clipBordersTriggered & 4)!==0) {
				compass[2] = polygon;
				console.log("expand south:" + (polygon === startPolygon));
			}
			if (compass[3]===null && (clipBordersTriggered & 8)!==0) {
				compass[3] = polygon;
				console.log("expand west:" + (polygon === startPolygon));
			}
		}
		//clipBordersTriggered & 1 ?
		let areaToAdd = clippedFace ? getFaceAreaMethod(clippedFace)  : 0;

		//if ((polygon as any)[AREA_CALC] === undefined) {
		//	(polygon as any)[AREA_CALC] = 0;
		//	(polygon as any)[AREA_CALC_SCORE] = 0;
		//}
		//(polygon as any)[AREA_CALC] += areaToAdd;
		areaToAdd -= getAreaPenaltyMethod ? getAreaPenaltyMethod(clippedFace, polygon, tileCenter, xExtent, zExtent) : 0;
		//(polygon as any)[AREA_CALC_SCORE] += areaToAdd;
		if (areaToAdd < 0) areaToAdd = 0; // sanity bounds, negative penalties cannot reduce area to negative
		areaScore += areaToAdd;
		if (clippedFace) {
			if (polygon !== startPolygon) {
				DEBUG_CONTOURS.push(traceFaceContours(clippedFace));
				//console.log("adding extra:"+areaToAdd);
			}
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