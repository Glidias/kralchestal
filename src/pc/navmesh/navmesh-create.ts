import { createScript, ScriptTypeBase, attrib } from "../../../lib/create-script-decorator";
import { NavMesh } from "../../../yuka/src/navigation/navmesh/NavMesh";
import { CellSpacePartitioning } from "../../../yuka/src/partitioning/CellSpacePartitioning";
import BoundBox from "../../hx/components/BoundBox";
import { getAltGeometryFromModel, weldGeometry } from "../util/mesh-utils";
import { Vector3 } from "../../../yuka/src/math/Vector3";
import { Polygon } from "../../../yuka/src/math/Polygon";
import AABBUtils from "../../hx/util/geom/AABBUtils";

/**
 * Prepares a navmesh's set of polygons during initialize() from it's underlying 3D model,
 * and navmesh graph (if attemptBuildGraph= true) and potential spatial index (if useSpatialIndex = true) on post-initialize.
 */
@createScript("navmeshCreate")
class NavmeshCreate extends ScriptTypeBase {
    @attrib({type:"boolean", default: true}) preweldGeometry: boolean;
    @attrib({type:"boolean", default: true}) attemptMergePolies: boolean;

    // if !rootCreate (ie. this is root)
    //@attrib({type:"boolean"}) calculateIslands: boolean;
    @attrib({type:"boolean", default: true}) attemptBuildGraph: boolean;
    @attrib({type:"boolean"}) useSpatialIndex: boolean;
    @attrib({type:"number", min: 1, step:1, default:10}) cellsX: number;
    @attrib({type:"number", min: 1, step:1, default:1}) cellsY: number;
    @attrib({type:"number", min: 1, step:1, default:10}) cellsZ: number;

    @attrib({type:"boolean", default:true}) hideModelAfterBuild: boolean;

    aabb: BoundBox;
    navmesh: NavMesh;

    rootCreate: NavmeshCreate;

    initialize() {
        if (!this.entity.model) {
            throw new Error("navmeshCreate:: No model supplied for navmesh!");
            //console.warn("navmeshCreate:: No model supplied for navmesh!");
            //return;
        }
        this.setupNavmesh();

        let parentEnt = this.entity.parent as pc.Entity;
        if (parentEnt.script && (parentEnt.script as any).navmeshCreate) {
            while ((parentEnt.parent as pc.Entity).script && ((parentEnt.parent as pc.Entity).script as any).navmeshCreate) {
                parentEnt = parentEnt.parent as pc.Entity;
            }
            this.rootCreate = (parentEnt.script as any).navmeshCreate as NavmeshCreate;
        }

        if (this.rootCreate) {
            let rootPolygons = this.rootCreate.navmesh.regions;
            for (let i=0, l=this.navmesh.regions.length; i < l; i++) {
                rootPolygons.push(this.navmesh.regions[i]);
            }
        }

        if (this.hideModelAfterBuild) this.entity.model.enabled = false;
    }

    setupNavmesh() { // assumed model is preloaded. May not be the case in general case but
        let totalAABB = new BoundBox();

        let geometry = getAltGeometryFromModel(this.entity.model.model, null, totalAABB, true);
        if (this.preweldGeometry) {
            weldGeometry(geometry);
        }

        var vertices = [];
        var polygons = [];

        // vertices

        var position = geometry.vertices;
        var index = geometry.indices;
        var x;
        var y;
        var z;

        // do a naive position+scale pre-transform for geometry mesh for simplciity
        for (let i=0, l = position.length; i < l; i += 3 ) {
            x = position[ i + 0 ];
            y = position[ i + 1 ];
            z = position[ i + 2 ];
            position[ i + 0 ] = x;
            position[ i + 1 ] = y;
            position[ i + 2 ] = z;
        }

        var i = 0;
        for (let i=0, l = position.length; i < l; i += 3 ) {
            let v = new Vector3(position[ i + 0 ], position[ i + 1 ], position[ i + 2 ]);
            vertices.push( v );
        }

        for (let i = 0, l = index.length; i < l; i += 3 ) {
            var a = index[ i + 0 ];
            var b = index[ i + 1 ];
            var c = index[ i + 2 ];

            var contour = [ vertices[ a ], vertices[ b ], vertices[ c ] ];

            var polygon = new Polygon().fromContour( contour );
            polygons.push( polygon );
        }
        // check if regions should be added to ultimost parent or this is the ultimost parent

        this.navmesh = new NavMesh();
        this.navmesh.attemptBuildGraph = false;
        this.navmesh.attemptMergePolies = this.attemptMergePolies;
        this.aabb = totalAABB;

        // polygons= polygons.filter((p)=>p.plane.normal.y > 0);
        this.navmesh.fromPolygons(polygons);
        (this.entity as any).navmesh = this.navmesh;
        (this.entity as any).navmeshAABB = this.aabb;
    }

    postInitialize() {
        if (!this.rootCreate) { // no root reference, so assumed this entity is the root navmesh-create!
            this.postSetupNavmesh();
        } else {
            // push pre-processed borders from current navmesh to root, add AABB to root
            let rootBorderEdges = this.rootCreate.navmesh._borderEdges;
            for (let i=0, l=this.navmesh._borderEdges.length; i < l; i++) {
                rootBorderEdges.push(this.navmesh._borderEdges[i]);
                AABBUtils.expand2(this.rootCreate.aabb, this.aabb);
            }

            // comment this away if purging isnt really needed
            this.navmesh = null;
            (this.entity as any).navmesh = null;
            (this.entity as any).navmeshAABB = null;
        }
    }

    postSetupNavmesh() {
        /*
        if (this.calculateIslands) { // a case of yagni?
            // re-arrange order of polygons and borderEdges based on islands distribution
            // record polygon navmesh region index ranges and borderEdge regions to their assosiaed islands
            // If polygon sampled and destination polygon sampled lies on different islands, search can be omitted
            // OR alternative search approaches can be done instead
        }
        */
        if (this.attemptBuildGraph) { // assumed from polygons of given navmesh
            this.navmesh._buildGraph();
        }
        if (this.useSpatialIndex) { // assumed from polygons of given navmesh
            let aabb = this.aabb;
            this.navmesh.spatialIndex = new CellSpacePartitioning(aabb.maxX - aabb.minX, aabb.maxY - aabb.minY, aabb.maxZ - aabb.minZ,
                this.cellsX, this.cellsY, this.cellsZ );
            this.navmesh.updateSpatialIndex();
        }
    }

}