import { createScript, ScriptTypeBase, attrib } from "../../../../lib/create-script-decorator";
import {getRequiredTilesFromTile, DEBUG_CONTOURS} from "../../util/area-utils"
import { NavMesh } from "../../../../yuka/src/navigation/navmesh/NavMesh";
import { Vector3 } from "../../../../yuka/src/math/Vector3";
import { CellSpacePartitioning } from "../../../../yuka/src/partitioning/CellSpacePartitioning";
import BoundBox from "../../../hx/components/BoundBox";
@createScript("testAreaSample")
class TestAreaSample extends ScriptTypeBase  {

	@attrib({type: "entity"}) navmeshEntity:pc.Entity;
	@attrib({type: "number", default:10}) tileSizeRadius:number;

	navmesh: NavMesh;
	ptSample: Vector3;
	pointsBuffer: pc.Vec3[];
	colorBuffer: pc.Color[];
	color: pc.Color;

	postInitialize () {
		this.navmesh = (this.navmeshEntity as any).navmesh;
		if (!this.navmesh) throw new Error("need navmesh dependency from navmesh entity");

		this.ptSample = new Vector3();

		this.pointsBuffer = [];
		this.colorBuffer = [];
		this.color = new pc.Color(1, 0.3, 0);


		if (!this.navmesh.spatialIndex) {
			let aabb:BoundBox = (this.navmeshEntity as any).navmeshAABB;

			this.navmesh.spatialIndex = new CellSpacePartitioning((aabb.maxX - aabb.minX), (aabb.maxY - aabb.minY), (aabb.maxZ - aabb.minZ), 60, 1, 60);
			this.navmesh.updateSpatialIndex();
		}

	}

	update () {
		let pos = this.entity.getPosition();
		this.ptSample.x = pos.x;
		this.ptSample.y = pos.y - this.entity.collision.height * 0.5;
		this.ptSample.z = pos.z;

		let region = this.navmesh.getRegionForPoint(this.ptSample, 0.16);
		if (region) {
			let area = getRequiredTilesFromTile(region, this.ptSample, this.tileSizeRadius, this.tileSizeRadius);
			// console.log("got area:" + area);
		}

		let pi = 0;
		for (let i = 0, l = DEBUG_CONTOURS.length; i< l; i++) {
			let pts = DEBUG_CONTOURS[i];
			let pLen = pts.length;
			let p =0;
			for (p =0; p< pLen; p+=3) {
				this.pointsBuffer[pi] = new pc.Vec3(pts[p], pts[p+1]+0.001, pts[p+2]);
				this.colorBuffer[pi] = this.color;
				pi++;
			}
		}

		this.pointsBuffer.length = pi;
		this.colorBuffer.length = pi;
		this.app.renderLines(this.pointsBuffer, this.colorBuffer);
	}
}