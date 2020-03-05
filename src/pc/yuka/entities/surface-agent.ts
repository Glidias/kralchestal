import { Vehicle } from "../../../../yuka/src/steering/Vehicle";
import EllipsoidCollider from "../../../hx/systems/collisions/EllipsoidCollider";
import CollisionBoundNode from "../../../hx/altern/collisions/CollisionBoundNode";
import Vector3D from "../../../hx/jeash/geom/Vector3D";
import CollisionEvent from "../../../hx/systems/collisions/CollisionEvent";

const DISPLACEMENT = new Vector3D(0);
const SOURCE = new Vector3D(0);
//const TARGET_DIRECTION = new Vector3();

class SurfaceAgent extends Vehicle {
   collider: EllipsoidCollider;
   collidable: CollisionBoundNode;

   groundNormalThreshold: number;
   gravForce: number;

   gotGroundNormal: boolean = false;


   constructor({ collider, collidable, groundNormalThreshold = 0.57 }: { collider: EllipsoidCollider; collidable: CollisionBoundNode; groundNormalThreshold?: number; }) {
        super();
        this.collidable = collidable;
        this.collider = collider;
        this.groundNormalThreshold = groundNormalThreshold;
    }

    /*
	lookAt( target: Vector3 ): SurfaceAgent {
        let td = TARGET_DIRECTION;
        td.x = target.x - this.position.x;
        td.z =  target.z - this.position.y;
        let d = 1/Math.sqrt(td.x * td.x * td.z * td.z);
        td.x *= d;
        td.z *= d;
		this.rotation.lookAt( this.forward, td, this.up );
		return this;
    }
    */


    update(dt: number): SurfaceAgent {

        var displacement = DISPLACEMENT;
        var source = SOURCE;

        source.x = this.position.x;
        source.y = this.position.y + this.collider.radiusY;
        source.z = this.position.z;

        super.update(dt);

        // || (this.gotGroundNormal) &&  .maximum_ground_normal.dotProduct(this.vel) > 0)
        if ( !this.gotGroundNormal ) {
            this.velocity.y -= this.gravForce;
        }
        if (this.velocity.y > 0) this.velocity.y = 0;

        displacement.x = this.velocity.x * dt;
        displacement.y = this.velocity.y * dt;
        displacement.z = this.velocity.z * dt;

        var destination = this.collider.calculateDestination(source, displacement, this.collidable);
        var gotGroundNormal = false;

       if (this.velocity.x*this.velocity.x + this.velocity.y+this.velocity.y + this.velocity.z*this.velocity.z !== 0) {
            this.gotGroundNormal = false;
       }

        var c = this.collider.collisions;
        this.collider.collisions = null;

        var nextEvent;
        while (c != null) {
            nextEvent = c.next;
            if (!gotGroundNormal && c.normal.y >= this.groundNormalThreshold ) {
               gotGroundNormal = true;
               // break;
            }
            c.next = CollisionEvent.COLLECTOR;
            CollisionEvent.COLLECTOR = c;
            c = nextEvent;
        }
        this.gotGroundNormal = gotGroundNormal;

        this.position.x = destination.x;
        this.position.y = destination.y - this.collider.radiusY;
        this.position.z = destination.z;

        return this;
    }

}