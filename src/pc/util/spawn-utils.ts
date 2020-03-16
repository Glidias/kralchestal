/**
 * Main spawning utility for distributing of points randomly on namesh/polygonal regions
 */
import { Polygon } from "../../../yuka/src/math/Polygon";
import { Vector3 } from "../../../yuka/src/math/Vector3";
import { AreaResults, getArea2DOfPolygon, findSampledIndexByRatings, EPSILON, VISITED_REGIONS, TRI_SOUP, _sampleTriFromRegion, getNewTriSample, TriAreaCallback, sampleTriWeighted, sampleRegionTriWeighted, getFillableVisitedRegions, sampleRegionTriReservoir } from "./area-utils";
import { Graph } from "../../../yuka/src/graph/core/Graph";
import { pointOnTriangle } from "./random-utils";
import { GraphPlus, ShortestPathTree, NavPtEdge } from "./graphpoly-utils";
import { Dijkstra } from "../../../yuka/src/graph/search/Dijkstra";
import { Edge } from "../../../yuka/src/graph/core/Edge";
import { LineSegment } from "../../../yuka/src/math/LineSegment";

type SpawnPt = {x:number, y:number, z:number};
type SpawnCallback = (pt:SpawnPt)=>boolean;
const SPAWNPT = {x:0, y:0, z:0};

var GRAPH_PLUS:GraphPlus;
var SPT_PLUS:ShortestPathTree;
var DIJK_PLUS:Dijkstra;
var REGIONS_TEMP:Polygon[];
var REGIONS_TEMP_INDICES:Map<Polygon, number>;
var EDGE_LINE:LineSegment;
var closestPoint:Vector3;

function getGraphPlus() {
    if (!GRAPH_PLUS) {
        GRAPH_PLUS = new GraphPlus();
        SPT_PLUS = new ShortestPathTree();
        DIJK_PLUS = new Dijkstra(GRAPH_PLUS, 0, -1);
        // There is a risk to this hack, since SPT_PLUS fakes the Map and doesn't implement everything from it
        // only what is needed for DIJK or Astar algorithms (at their current codebases)
        DIJK_PLUS._shortestPathTree = SPT_PLUS as any; 
        REGIONS_TEMP = [];
        REGIONS_TEMP_INDICES = new Map();
        EDGE_LINE = new LineSegment(null, null);
        closestPoint = new Vector3();
    }
    return GRAPH_PLUS;
}

type AllocAreaRating = {
    rating: number,
    regionIndices: number[]
}

type RegionRatingsResult = {
    areas: Float32Array,
    regions: Polygon[],
    totalAreaRating: number,
    totalAreaLogRating: number,
    allocAreaRatings: AllocAreaRating[],
    allocAreaRatingValues: number[]
}

var RND_REGION = Math.random;
export function setRegionPickRandomiser(method:()=>number) {
    RND_REGION = method;
}
var RND_TRI = Math.random; 
export function setTriPickRandomiser(method:()=>number) {
    RND_TRI = method;
}
var RND_TRI_P = Math.random;
export function setTriPointPRandomiser(method:()=>number) {
    RND_TRI_P = method;
}
var RND_TRI_Q = Math.random;
export function setTriPointQRandomiser(method:()=>number) {
    RND_TRI_Q = method;
}

const TRI_SAMPLE = getNewTriSample(new Vector3(), new Vector3(), new Vector3());

/**
 * Populates set of region by approximate area distribution of regions by natural logarithm of area and a given precision value of lograithm result
 * @param spawnCallback Callback method to process/add point. 
 *  Return true to indicate spawn successful, else system might repeat sample attempt.
 * @param regions List of regions
 * @param totalAmount Positive value indicates total amount to spawn. 
 *  Negative value indicates a divisor against total area of regions to determine total amount to spawn
 * @param loegMultiplier Defaults to 1. Optionally supplied custom multiplier value to determine log rating in relation to decimal precision
 * @param logPrecision Defaults to 0.1
 * @param maxAreaCap Optionally a maximum area cap for rating for a given area. Defaults to Infinity.
 * @param methodArea Defaults to getArea2DOfPolygon from area-utils, but may use get3DSurfaceAreaPolygon if you don't mind fully utilising sloped areas
 * @param methodPenaltyArea Optionally supply a method to return a penalty value to reduce area rating of region
 */
export function populateAllLog10(spawnCallback:SpawnCallback, regions:Polygon[], totalAmount:number, logMultiplier:number=1, logPrecision:number=0.1,
      maxAreaCap:number=Infinity,
      methodArea:(region:Polygon, triAreaCallback?:TriAreaCallback)=>number=getArea2DOfPolygon, 
      methodPenaltyArea:(region:Polygon)=>number=null):RegionRatingsResult {
    let allocArea:Float32Array = new Float32Array(regions.length);
    let allocAreaRatings:AllocAreaRating[] = [];
    let mapRatingToIndices = new Map<number, number>();
    let ai = 0;
    let totalAreaRegions = 0;
    let totalArea = 0;
    
    const triSample = TRI_SAMPLE;
    for (let i = 0, l=regions.length; i<l; i++) {
        let region = regions[i];
        //getAreaOfRegion()
        let areaToAdd = methodArea(region);
        if (areaToAdd < 0) areaToAdd = -areaToAdd;
        allocArea[i] = areaToAdd; // true area of region for sampling within any tris within region
        
        areaToAdd -= methodPenaltyArea !== null ? methodPenaltyArea(region) : 0;
       
        if (areaToAdd > maxAreaCap) areaToAdd = maxAreaCap;

        totalAreaRegions += areaToAdd;

        // general lorgarithm rating of area
        let tt = areaToAdd;

        areaToAdd = Math.round(Math.log((1 + areaToAdd*logMultiplier) / logPrecision)) * logPrecision; 
        
        //allocAreaRatings[i] = areaToAdd;
        if (!mapRatingToIndices.has(areaToAdd)) {
            mapRatingToIndices.set(areaToAdd, ai);
            allocAreaRatings[ai++] = {
                rating: 0,
                regionIndices: []
            }
        }
        let rating = allocAreaRatings[mapRatingToIndices.get(areaToAdd)];
        rating.rating += tt;
        
        rating.regionIndices.push(i);

        totalArea+= areaToAdd;
    }
    // array of similar allocAreaRatings, are grouped together into an array for sampling

    // * p.regionIndices.length
    let allocAreaRatingValues = allocAreaRatings.map((p) => p.rating);

    if (totalAmount < 0) totalAmount = Math.floor(totalAreaRegions / -totalAmount);
    
    const triSoup = TRI_SOUP;
    const spawnPt = SPAWNPT;
    const registerTriArea = (area:number, a:Vector3, b:Vector3, c:Vector3) => {
        triSoup[ai++] = a.x;
        triSoup[ai++] = a.y;
        triSoup[ai++] = a.z;
        triSoup[ai++] = b.x;
        triSoup[ai++] = b.y;
        triSoup[ai++] = b.z;
        triSoup[ai++] = c.x;
        triSoup[ai++] = c.y;
        triSoup[ai++] = c.z;
        triSoup[ai++] = area;
        return area;
    };

    for (let i =0; i< totalAmount; i++) {
        let sampledIndex = findSampledIndexByRatings(allocAreaRatingValues, RND_REGION(), totalAreaRegions );
        let allocAreas = allocAreaRatings[sampledIndex];
        let regionIndex = allocAreas.regionIndices[Math.floor(Math.random() * allocAreas.regionIndices.length)];
        let region = regions[regionIndex];

        ai = 0;
        let regionArea =  methodArea(region, registerTriArea);
        _sampleTriFromRegion(triSample, region, regionArea, 0, ai, RND_TRI() );
        pointOnTriangle(triSample.a, triSample.b, triSample.c, triSample.randOffset, RND_TRI_Q(), spawnPt);
        spawnCallback(spawnPt);
    }
    return {
        areas: allocArea,
        regions,
        totalAreaRating: totalAreaRegions,
        totalAreaLogRating: totalArea,
        allocAreaRatings,
        allocAreaRatingValues
    }
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
    if (totalAmount === 0) throw new Error("Total amount supplied must be non-zero value!");

    const triSoup = TRI_SOUP;
    let area;
    const spawnPt = SPAWNPT;
    let s;
    const triSample = TRI_SAMPLE;
    if (!startPolygon) {
        if (totalAmount < 0) { // just fill all areaResults[1] triangles from triSoup fully in proportion to area per tri!
            if (startPtInclude) {
                spawnPt.x = startPtInclude.x;
                spawnPt.y = startPtInclude.y;
                spawnPt.z = startPtInclude.z;
                spawnCallback(spawnPt);
            }

            for (let i = 0, l=triSoup.length; i<l; i+=10) {
                area = triSoup[i+9];
                s = Math.floor(area / -totalAmount);
                while(--s >= 0) {
                    //let tri = 
                    sampleTriWeighted(triSample, areaResults, RND_TRI);
                    //if (tri) {
                    pointOnTriangle(triSample.a, triSample.b, triSample.c, RND_TRI_P(), RND_TRI_Q(), spawnPt);
                    //}
                    spawnCallback(spawnPt);
                }
            }
        } else { // weighted sampling picks up to totalAmount required
            s = totalAmount;
            if (startPtInclude) {
                spawnPt.x = startPtInclude.x;
                spawnPt.y = startPtInclude.y;
                spawnPt.z = startPtInclude.z;
                spawnCallback(spawnPt);
                s--;
            }
            while(--s >= 0) {
                sampleRegionTriWeighted(triSample, getFillableVisitedRegions(), areaResults, RND_REGION, RND_TRI);
                pointOnTriangle(triSample.a, triSample.b, triSample.c, triSample.randOffset, RND_TRI_Q(), spawnPt);
                spawnCallback(spawnPt);
            }
        } 
    } else { // potential graph/neighborhood search re-order of polygons for Reservoir sampling  areaResults[0] regions
        if (totalAmount < 0) throw new Error('Total amount must be a positive value for');
        const graphPlus = getGraphPlus();
        const spt = SPT_PLUS;
        const search = DIJK_PLUS;
        const regionTempIndices = REGIONS_TEMP_INDICES;
        let rt = 0;
        let regions:Polygon[];
        let visitedRegions = VISITED_REGIONS;
        const edgeLine = EDGE_LINE;

        let currentPivotPt:Vector3; // currently only used in cases without navmesh pamrameter

        if (navmesh) {
            regions = navmesh.regions;
            search.source = navmesh.getNodeIndex(startPolygon);
        } else {
            regionTempIndices.clear();
            search.source = 0;
            regions = REGIONS_TEMP;
            regionTempIndices.set(startPolygon, rt);
            regions[rt++] = startPolygon;
            if (!startPtInclude) {
                startPtInclude = startPolygon.centroid;
                currentPivotPt = startPtInclude;
            }
        }
        search.target = -1;

        const reservoir:Polygon[] = [];
        let ri = 0;

        if (startPtInclude) {
            spawnPt.x = startPtInclude.x;
            spawnPt.y = startPtInclude.y;
            spawnPt.z = startPtInclude.z;
            spawnCallback(spawnPt);
            if (totalAmount > 0) totalAmount--;
        }
       
        spt.setCallback = function(index, edge) {
            let region = regions[index];
            // coming in from edge towards index
            if (!navmesh) {
                currentPivotPt = (edge as NavPtEdge).pt;
            }

            if (!visitedRegions.has(region)) {
                return false;
            }
            if (visitedRegions.get(region) > EPSILON) {
                reservoir[ri++] = region;
                 // if totalAmountDivisor > 0 || totalAmount < 0
                // spawn 1 or as many required to fill regions up to max from current pivot point
                // to closest nighbor edge approximation rStartI
                // till rSTartI >= 0
                //sampleRegionTriReservoir()
            }
            return true;
        };

        graphPlus.getEdgesOfNode = navmesh ? 
        function(index, outgoingEdges) {
            if (!visitedRegions.has(regions[index])) {
                outgoingEdges.length = 0;
                return outgoingEdges;
            }
            return navmesh.graph.getEdgesOfNode(index, outgoingEdges);
        }
        :
        function(index, outgoingEdges) {
            let region = regions[index];

            if (!visitedRegions.has(region)) {  // <- this isn't really needed (i think, since check is alread done prior to push to queue)
                outgoingEdges.length = 0;
                return outgoingEdges;
            }

            // Only push outgoing edges that lead to visitedRegions
            let edge = region.edge;
            let ci = 0;
            do {
                if (edge.twin) {
                    if (visitedRegions.has(edge.twin.polygon)) {
                        edgeLine.from = edge.prev.vertex;
                        edgeLine.to = edge.vertex;
                        edgeLine.closestPointToPoint(currentPivotPt, true, closestPoint);
                        if (!regionTempIndices.has(edge.twin.polygon)) {
                            regionTempIndices.set(edge.twin.polygon, rt);
                            regions[rt++] = edge.twin.polygon;
                        }
                        let to = regionTempIndices.get(edge.twin.polygon);
                        //  // consider pooling this in graphpoly-utils?
                        outgoingEdges[ci++] = new NavPtEdge(index, to, closestPoint, currentPivotPt);

                    }
                }
            } while (edge !== region.edge);
            
            outgoingEdges.length = ci;
    

            return outgoingEdges;
        }
    }
}


