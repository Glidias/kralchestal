import { createScript, ScriptTypeBase, attrib } from "../../../lib/create-script-decorator";
import CollisionBoundNode from "../../hx/altern/collisions/CollisionBoundNode";
import { NavMesh } from "../../../yuka/src/navigation/navmesh/NavMesh";
import BVHTree from "../../hx/altern/partition/js/BVHTree";
import BVH from "../../hx/bvhtree/BVH";

/**
 * Facilitates accruate lookup of all navmeshes (and pinpoint) in the world based on
 * various collision lookup approaches.
 * 
 * Also allow creation of edge wall collision profiles per navmesh.
 * 
 * This script must be placed in an entity that postInitializes strictly AFTER all navmesehes do,
 * so they should be located OUTSIDE and AFTER all navmesh entities.
 * 
 */

export type RegionResult = {navmesh?:number, zone?:number, region?:number};

@createScript("navmeshManager")
class NavmeshManager extends ScriptTypeBase {

    @attrib({type:"entity", description: "The container entity that holds all navmesh nodes (or the sole navmesh entity) itself "}) 
    holdingNode:pc.Entity;

    @attrib({type:"boolean"}) _collideEdges: boolean;

    @attrib({type:"entity", description: "Specified RecastCLI character scene entity reference to get agent radius for edge offsets"})
    recastCLIEntity:pc.Entity;

    @attrib({type:"boolean"}) // yagni: reactive
    previewEdgeWalls: boolean;

    @attrib({type:"number", default: 12, description: "The maximum amount of bounding boxes checked in linear time before building a bounding volume hierachy instead"})
    maxLinearBoundsChecks:number;

    @attrib({type:"boolean"}) _perRegionBVH: boolean; // each region has their own polysoup BVH
    @attrib({type:"boolean"}) _rootBVHRegion: boolean; // 1 global region of all polsoup bvh

    navmeshes: NavMesh[];

    // _buildEdgeWallCollisions?
    innerEdgeWalls: CollisionBoundNode[]; // per navmesh used for constraining agents typically
    // depending on which navmesh (island) the agent is located in, the edgeWalls is set accordingly for their collision
    // potential yagni
    // outerEdgeWalls: CollisionBoundNode[]; // reverse of above: good for tracing outer edge wall locations

    // ----------------------

    // _perRegionBVH?
    bvhRegions: CollisionBoundNode[]; // search can be done specific to each navmesh (island)
    bvhRegionsTriIndices: Uint32Array[]; // each navmesh region, triMeshIndices

    // _rootBVHRegion?
    // BVH by default unless (_perRegionBVH is also selected, and then rootNavCollision might become either DBVH or linear bounding box list depending on maxLinearBoundsChecks)
    rootNavCollision: CollisionBoundNode; 
    // bvh tri index leading to navmesh region index
    // 16 bits pack for each as long as each navmesh island <= 65536 regions, 
    // or consider dynamic bits ?
    navmeshIndexShift: number;
    triIndexMask: number;
    rootBVHRegionTriIndices: Uint32Array;  // might be null if rootNavCollision isn't BVH soup

    postInitialize () {
        if (!this.holdingNode) {
            console.warn("navmeshManager: Holding node not found! Nothing done!");
            return;
        }
        // collect navmeshes from holdingNode
        // this.navmeshes
        
        if (this._collideEdges) {
            this.setupEdgeWallCollisions();
        }
        if (this._perRegionBVH || this._rootBVHRegion) {
            this.setupRegions();
        }
        //this.collisionSceneUtil = !this.collisionSceneRef ? (this.app.root.script ? this.app.root.script.collisionScene : null) || (this.app.root.children.length && this.app.root.children[0].script ? this.app.root.children[0].script.collisionScene : null) : this.collisionSceneRef.script.collisionScene;
    }

    setupEdgeWallCollisions() {

    }

    setupRegions() {
        if (this._rootBVHRegion) {
            this.navmeshIndexShift = 16;
            this.triIndexMask = 0xFFFF;
        }
    }

    // -- queries

    findNavmeshRegionFromRay(result:RegionResult, pos:pc.Vec3, ray:pc.Vec3) {
        //  bvh raycast (from  root or linear list) if avialalbe else raycast all polygons within each navmesh

        // may use built-in cellspace partioning per navmesh if available (DDA ray)
    }

    findNavmeshRegionFromPoint(result:RegionResult, pos:pc.Vec3) {
        // may use built-in cellSpace partioning per navmesh if available..
    }

    findClosestNavmeshRegionFromPoint(result:RegionResult, pos:pc.Vec3, allowance?:number) {
        if (allowance === undefined) {

        }

        //  if allowance is set
        
        // may use built-in cellSpace partioning per navmesh if available?
        // Based on given allowance, more cells will be queried for potential closest finds
    }

    update () {

    }
}