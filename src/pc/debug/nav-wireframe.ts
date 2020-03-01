import { createScript, ScriptTypeBase, attrib } from "../../../lib/create-script-decorator";
import { NavMesh } from "../../../yuka/src/navigation/navmesh/NavMesh";
import { HalfEdge } from "../../../yuka/src/math/HalfEdge";

@createScript("navWireframe")
class NavWireframe extends ScriptTypeBase {
    @attrib({type: "rgba"}) color:pc.Color;
    
    colorBuffer:pc.Color[];
    pointsBuffer:pc.Vec3[];

    postInitialize () {
        let navmesh = (this.entity as any).navmesh as NavMesh;
        if (!navmesh) {
            console.warn("NavWireframe no navmesh found on entity!")
            return;
        }
       
        let map = new Map();
        let regions = navmesh.regions;
        let lineCount = 0;
        for (let i = 0, l = regions.length; i<l; i++) {
            let region = regions[i];
            let edge: HalfEdge = region.edge;
            do {
                if (!map.has(edge.vertex)) {
                    map.set(edge.vertex, new pc.Vec3(edge.vertex.x, edge.vertex.y, edge.vertex.z));
                }
                lineCount++;
                edge = edge.next;
            } while( edge !== region.edge)
        }

        this.pointsBuffer = new Array(lineCount*2);
        this.colorBuffer = new Array(lineCount*2);

        let pi = 0;
        for (let i = 0, l = regions.length; i<l; i++) {
            let region = regions[i];
            let edge: HalfEdge = region.edge;
            do {
                map.get(edge.prev.vertex);

               this.pointsBuffer[pi] = map.get(edge.prev.vertex);
                this.colorBuffer[pi] = this.color;
                pi++;

               this.pointsBuffer[pi] = map.get(edge.vertex);
               this.colorBuffer[pi] = this.color;

                pi++;
                edge = edge.next;
            } while( edge !== region.edge)
        }
    }

    update() {
        this.app.renderLines(this.pointsBuffer, this.colorBuffer);
    }
}