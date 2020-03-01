import { createScript, ScriptTypeBase, attrib } from "../../../lib/create-script-decorator";
import { NavMesh } from "../../../yuka/src/navigation/navmesh/NavMesh";
import { setupOBBFromAABBAndRotation, getOBBInstance } from "../util/obb";
import { Ray } from "../../../yuka/src/math/Ray";
import { AABB } from "../../../yuka/src/math/AABB";

@createScript("edgeConnect")
class EdgeConnect extends ScriptTypeBase {

    @attrib({type:"entity"}) parentingEntity: pc.Entity;
    @attrib({type:"entity"}) siblingEntity: pc.Entity;

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
        let myRotation = this.entity.getRotation();
        setupOBBFromAABBAndRotation(obb, myAABB, myRotation);

        // push new polygon connection from edge fromEntity to edge from toEntity
        let fromNavmesh: NavMesh = (this.siblingEntity as any).navmesh;
        let toNavmesh: NavMesh = (this.parentingEntity as any).navmesh;

        // splice borderEdge of toNavmesh  and fromNavmesh

        // add new connecting polygon to ultimagonte ultimate Adam grandparent toNavmesh (parentnigEntity);
        // push borderEdges assosiated with new connecting poly to adam borderEdges

        // later during postinitialize for navmeshCreates, all borderEdges under non-root navmeshes is added ro root adam navmeshes


        this.entity.parent.removeChild(this.entity);

       // new Ray().intersectAABB(m)
        // go through all edges fromEntity, toEntity.navmesh
        //fromNavmesh.spatialIndex;
    }

}