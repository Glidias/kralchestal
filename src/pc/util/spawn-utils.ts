/**
 * Main spawning utility for distributing of points randomly on namesh/polygonal regions
 */
import { Polygon } from "../../../yuka/src/math/Polygon";
import { Vector3 } from "../../../yuka/src/math/Vector3";
import { AreaResults, getArea2DOfPolygon, findSampledIndexByRatings } from "./area-utils";
import { Graph } from "../../../yuka/src/graph/core/Graph";

type SpawnPt = {x:number, y:number, z:number};
const SPAWNPT = {x:0, y:0, z:0};

/**
 * Populates set of region by approximate area distribution of regions by natural logarithm of area and a given precision value of lograithm result
 * @param spawnCallback Callback method to process/add point
 * @param regions List of regions
 * @param totalAmount Must be a non-zero value. Positive value indicates total amount to spawn. 
 *  Negative value indicates a divisor against total area of regions to determine total amount to spawn
 * @param loegMultiplier Defaults to 1. Optionally supplied custom multiplier value to determine log rating in relation to decimal precision
 * @param logPrecision Defaults to 0.1
 * @param maxAreaCap Optionally a maximum area cap for rating for a given area. Defaults to Infinity.
 * @param methodArea Defaults to getArea2DOfPolygon from area-utils, but may use get3DSurfaceAreaPolygon if you don't mind fully utilising sloped areas
 * @param methodPenaltyArea Optionally supply a method to return a penalty value to reduce area rating of region
 */
export function populateAllLog10(spawnCallback:(pt:SpawnPt)=>void, regions:Polygon[], totalAmount:number, logMultiplier:number=1, logPrecision:number=0.1,  maxAreaCap:number=Infinity, methodArea:(region:Polygon)=>number=getArea2DOfPolygon, methodPenaltyArea:(region:Polygon)=>number=null) {
    let allocArea:Float32Array = new Float32Array(regions.length);
    let allocAreaRatings:Float32Array = new Float32Array(regions.length);
    let totalArea = 0;
    for (let i = 0, l=regions.length; i<l; i++) {
        let region = regions[i];
        //getAreaOfRegion()
        let areaToAdd = methodArea(region);
        allocArea[i] = areaToAdd; // true area of region for sampling within any tris within region

        areaToAdd -= methodPenaltyArea !== null ? methodPenaltyArea(region) : 0;
        if (areaToAdd > maxAreaCap) areaToAdd = maxAreaCap;

        // general lorgarithm rating of area
        areaToAdd = Math.round(Math.log((1 + areaToAdd*logMultiplier) / logPrecision)) * logPrecision; 
        allocAreaRatings[i] = areaToAdd;
        totalArea+= areaToAdd;
    }
    // array of similar allocAreaRatings, are grouped together into an array for sampling
    
    //findSampledIndexByRatings()
}

/**
 * Assumes getRequiredTilesFromTile() from `./area-utils.ts` is used to get necessary area results of valid regions to consider
 * @param spawnCallback Callback method to process/add point
 * @param totalAmount  Must be a non-zero value. Positive value indicates total amount to spawn. 
 *  Negative value indicates divisor against region area to determine total amount to spawn within a region
 * @param areaResults The area result from getRequiredTilesFromTile() for area-utils
 * @param startPolygon Optionally supplying the starting polygon reference to begin spawning by Dilk search of vincity
 * @param startPtInclude Optionally includes stipulated start position as part of the totalAmount to spawn
 * @param navmesh Whether to use navmesh and graph combination
 */
export function populateFromVincity(spawnCallback:(pt:SpawnPt)=>void, totalAmount:number, areaResults:AreaResults, 
    startPolygon:Polygon=null, startPtInclude: Vector3=null, 
    navmesh:{regions:Polygon[], graph:Graph, getNodeIndex:(region:Polygon)=>number}=null) {
    
}


