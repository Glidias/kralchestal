import { createScript, ScriptTypeBase, attrib } from "../../../lib/create-script-decorator";
import { NavMesh } from "../../../yuka/src/navigation/navmesh/NavMesh";
import { setupOBBFromAABBAndRotation, getOBBInstance } from "../util/obb";
import { Ray } from "../../../yuka/src/math/Ray";
import { AABB } from "../../../yuka/src/math/AABB";
import { HalfEdge } from "../../../yuka/src/math/HalfEdge";
import { Vector3 } from "../../../yuka/src/math/Vector3";
import { Polygon } from "../../../yuka/src/math/Polygon";

import { linkPolygons } from "../../../yuka/src/navigation/navmesh/NavMeshUtil";

const RAY = new Ray();
const BOUND_TEST = new AABB();
const POINT_TEST = new Vector3();
const AABB_BOX = new pc.BoundingBox(new pc.Vec3(0,0,0), new pc.Vec3(0.5, 0.5, 0.5));
const CONNECT_RESULTS: Polygon[] = [];

@createScript("edgeConnect")
class EdgeConnect extends ScriptTypeBase {

    @attrib({type:"entity"}) parentingEntity: pc.Entity;
    @attrib({type:"entity"}) siblingEntity: pc.Entity;
    @attrib({type:"number", default: 0, min:0}) snapDistThreshold: number;

    initialize () {
        if (!this.parentingEntity) this.parentingEntity = this.entity.parent as pc.Entity;
        
        if (!this.parentingEntity || !this.siblingEntity) {
            console.warn("edgeConnect:: attrib entity references not supplied! " + [this.parentingEntity, this.siblingEntity]);
            return;
        }
        if (!(this.parentingEntity as any).navmesh || !(this.siblingEntity as any).navmesh ) {
            console.warn("edgeConnect:: attrib entity navmesh references not supplied!", !(this.parentingEntity as any).navmesh, !(this.siblingEntity as any).navmesh);
            return;
        }
        if (!this.entity.model) throw new Error("No model supplied to determine connection!");
        // this.fromEntity.translate
        //this.entity.getWorldTransform();
        let obb = getOBBInstance();
        let myAABB = this.entity.model.meshInstances[0].aabb;
        let myAABBMin = myAABB.getMin();
        let myAABBMax = myAABB.getMax();
        let myRotation = this.entity.getRotation();
        
        let totalScale = this.entity.getLocalScale().clone();

        let pos = this.entity.getPosition();
        let pNode = this.entity.parent;
        while(pNode) {
            totalScale.mul(pNode.getLocalScale());
            pNode = pNode.parent;
        }
        //console.log("total scale:", totalScale);
        AABB_BOX.center.x = pos.x;
        AABB_BOX.center.y = pos.y;
        AABB_BOX.center.z = pos.z;
        AABB_BOX.halfExtents.x = 0.5 * totalScale.x;
        AABB_BOX.halfExtents.y = 0.5 * totalScale.y;
        AABB_BOX.halfExtents.z = 0.5 * totalScale.z;
        setupOBBFromAABBAndRotation(obb, AABB_BOX, myRotation);

        let intersectsMyAABB = (edge: HalfEdge) => {
            let aabb = this.aabbOfLine(BOUND_TEST, edge.prev.vertex, edge.vertex);
            return !(aabb.max.x < myAABBMin.x || aabb.min.x > myAABBMax.x ||
                aabb.max.y < myAABBMin.y || aabb.min.y > myAABBMax.y ||
                aabb.max.z < myAABBMin.z || aabb.min.z > myAABBMax.z )
        };
        // push new polygon connection from edge fromEntity to edge from toEntity
        let fromNavmesh: NavMesh = (this.siblingEntity as any).navmesh;
        let fromNavmeshEdges: HalfEdge[] = fromNavmesh._borderEdges.filter(intersectsMyAABB);
        let toNavmesh: NavMesh = (this.parentingEntity as any).navmesh;
        let toNavmeshEdges: HalfEdge[] = toNavmesh._borderEdges.filter(intersectsMyAABB);
        
       const ray = RAY;
       const point = POINT_TEST;

       let fromEdge: HalfEdge = null;
       let toEdge: HalfEdge = null;
       for (let i = 0, len=fromNavmeshEdges.length; i< len; i++) {
            let edge = fromNavmeshEdges[i];
            ray.origin.x = edge.prev.vertex.x;  
            ray.origin.y = edge.prev.vertex.y;  
            ray.origin.z = edge.prev.vertex.z;
            ray.direction.x = edge.vertex.x - edge.prev.vertex.x;
            ray.direction.y = edge.vertex.y - edge.prev.vertex.y;
            ray.direction.z = edge.vertex.z - edge.prev.vertex.z;
            ray.direction.normalize();
            if (ray.intersectOBB(obb, point) ) {
                fromEdge = edge;
                break;
            }
       }

       for (let i = 0, len=toNavmeshEdges.length; i< len; i++) {
            let edge = toNavmeshEdges[i];
            ray.origin.x = edge.prev.vertex.x;  
            ray.origin.y = edge.prev.vertex.y;  
            ray.origin.z = edge.prev.vertex.z;
            ray.direction.x = edge.vertex.x - edge.prev.vertex.x;
            ray.direction.y = edge.vertex.y - edge.prev.vertex.y;
            ray.direction.z = edge.vertex.z - edge.prev.vertex.z;
            ray.direction.normalize();
            if (ray.intersectOBB(obb, point) ) {
                toEdge = edge;
                break;
            }
       }

       if (toEdge === null || fromEdge === null) {
           console.error("Edge connect attempt failed from entity:"+this.entity.name);
           console.log(fromEdge, toEdge);
           //let ls = this.entity.getLocalScale();
          // this.entity.setLocalScale(ls.x, ls.y*1000, ls.z);
           return;
       }
      

        // create connecting polygon
        let poly: Polygon = null;
        let results = linkPolygons(fromEdge, toEdge, null, this.snapDistThreshold, CONNECT_RESULTS);
        if (results) {
            if (Array.isArray(results)) {
                poly = results[0];
            }
        } else {
            console.error("Edges connect linkPolygons failed with snap threshold:" + this.snapDistThreshold + " for: " +this.entity.name);
            return;
        }

        // splice borderEdge of toNavmesh  and fromNavmesh
        toNavmesh._borderEdges.splice(toNavmesh._borderEdges.indexOf(toEdge), 1);
        fromNavmesh._borderEdges.splice(fromNavmesh._borderEdges.indexOf(fromEdge), 1);

        if (poly !== null) {
             // add new connecting polygon to ultimagonte ultimate Adam grandparent toNavmesh (parentnigEntity);
            let adam:pc.GraphNode = this.parentingEntity;
            if (adam.parent && (adam.parent as any).navmesh) {
                do {
                    adam = adam.parent;
                } while(adam.parent && (adam.parent as any).navmesh)
            }
            let adamNavmesh:NavMesh = (adam as any).navmesh;
            adamNavmesh.regions.push(poly)
        }

        this.entity.parent.removeChild(this.entity);

        // new Ray().intersectAABB(m)
        // go through all edges fromEntity, toEntity.navmesh
        //fromNavmesh.spatialIndex;
    }

    
    aabbOfLine(boundBox:AABB, a:Vector3, b:Vector3) {
        boundBox.min.x = a.x < b.x ? a.x : b.x;
        boundBox.min.y = a.y < b.y ? a.y : b.y;
        boundBox.min.z = a.z < b.z ? a.z : b.z;
        boundBox.max.x = a.x >= b.x ? a.x : b.x;
        boundBox.max.y = a.y >= b.y ? a.y : b.y;
        boundBox.max.z = a.z >= b.z ? a.z : b.z;
        return boundBox;
    }

    
}