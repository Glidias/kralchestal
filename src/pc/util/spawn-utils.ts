/**
 * Main spawning utility for distributing of points randomly on namesh/polygonal regions
 */
import { Polygon } from "../../../yuka/src/math/Polygon";
import { Vector3 } from "../../../yuka/src/math/Vector3";
import { AreaResults, getArea2DOfPolygon, findSampledIndexByRatings, TRI_SOUP } from "./area-utils";
import { Graph } from "../../../yuka/src/graph/core/Graph";

type SpawnPt = {x:number, y:number, z:number};
type SpawnCallback = (pt:SpawnPt)=>boolean;
const SPAWNPT = {x:0, y:0, z:0};

/**
 * Populates set of region by approximate area distribution of regions by natural logarithm of area and a given precision value of lograithm result
 * @param spawnCallback Callback method to process/add point. 
 *  Return true to indicate spawn successful, else system might repeat sample attempt.
 * @param regions List of regions
 * @param totalAmount Must be a non-zero value. Positive value indicates total amount to spawn. 
 *  Negative value indicates a divisor against total area of regions to determine total amount to spawn
 * @param loegMultiplier Defaults to 1. Optionally supplied custom multiplier value to determine log rating in relation to decimal precision
 * @param logPrecision Defaults to 0.1
 * @param maxAreaCap Optionally a maximum area cap for rating for a given area. Defaults to Infinity.
 * @param methodArea Defaults to getArea2DOfPolygon from area-utils, but may use get3DSurfaceAreaPolygon if you don't mind fully utilising sloped areas
 * @param methodPenaltyArea Optionally supply a method to return a penalty value to reduce area rating of region
 */
export function populateAllLog10(spawnCallback:SpawnCallback, regions:Polygon[], totalAmount:number, logMultiplier:number=1, logPrecision:number=0.1,  maxAreaCap:number=Infinity, methodArea:(region:Polygon)=>number=getArea2DOfPolygon, methodPenaltyArea:(region:Polygon)=>number=null) {
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
 * Somewhat inspired from Recast/Detour library, but this is far more comprehensive with more options
 * Assumes getRequiredTilesFromTile() from `./area-utils.ts` is used to get necessary area results of valid regions to consider.
 * Allows spawning from within a neighborhood/location vincity.
 * @param spawnCallback Callback method to process/add point. 
 *  Return true to indicate spawn successful, else system might repeat sample attempt (or defer it in some cases).
 * @param totalAmount  Must be a non-zero value. Positive value indicates total amount to spawn. 
 *  Negative value indicates divisor against region area to determine total amount to spawn within a region
 * @param areaResults The area result from getRequiredTilesFromTile() for area-utils
 * @param startPtInclude Optionally includes stipulated start position as part of the totalAmount to spawn
 * @param startPolygon Optionally supplying the starting polygon reference to begin spawning by Dilk search of vincity.
 * If this is provided, sampleRegionTriReservoir() from area-utils is used instead of a generalised randomised weighted sample.
 * Also, totalAmount must be a positive value. If it isn't, an error is thrown.
 * @param navmesh Whether to use navmesh object consisting of regions and graph combination
 * @param totalAmountDivisor Optionally use this as a region area divisor in conjunction with the required positive totalAmount parameter 
 * to limit reservoir sampling and graph/neighborhood searching from start polygon 
 * to help concentrate spawnings from start polygon in proportion to available region areas.
 */
export function populateFromVincity(spawnCallback:SpawnCallback, totalAmount:number, areaResults:AreaResults, 
    startPtInclude: Vector3=null, startPolygon:Polygon=null,  
    navmesh:{regions:Polygon[], graph:Graph, getNodeIndex:(region:Polygon)=>number}=null, totalAmountDivisor:number=0) {
    if (totalAmount === 0) throw new Error("Total amount supplied must be non-zero value!")
    if (!startPolygon) {
        if (totalAmount < 0) { // just fill all areaResults[1] triangles from triSoup fully in proportion to area per tri!
            //TRI_SOUP
        } else { // weighted sampling picks up to totalAmount reuired

        }
    } else { // potential graph/neighborhood search re-order of polygons for Reservoir sampling  areaResults[0] regions
        if (totalAmount < 0) throw new Error('Total amount must be a positive value for ')
    }
}


