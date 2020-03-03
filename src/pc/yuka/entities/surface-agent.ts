import { Vehicle } from "../../../../yuka/src/steering/Vehicle";
import EllipsoidCollider from "../../../hx/systems/collisions/EllipsoidCollider";
import CollisionBoundNode from "../../../hx/altern/collisions/CollisionBoundNode";
import Vector3D from "../../../hx/jeash/geom/Vector3D";
import CollisionEvent from "../../../hx/systems/collisions/CollisionEvent";

import { attrib } from "../lib/create-yuka-entity"

var DISPLACEMENT = new Vector3D(0);
var SOURCE = new Vector3D(0);

class SurfaceAgent extends Vehicle {
   @attrib({type:"entity", inject:true}) collider: EllipsoidCollider;
   @attrib({type:"entity", inject:true}) collidable: CollisionBoundNode;

   @attrib({type:"number"}) groundNormalThreshold: number;
   @attrib({type:"number"}) gravForce: number;

   gotGroundNormal: boolean = false;

   constructor(collider: EllipsoidCollider=null, collidable: CollisionBoundNode=null, groundNormalThreshold: number=0.57) {
        super();
        this.collidable = collidable;
        this.collider = collider;
        this.groundNormalThreshold = groundNormalThreshold;
    }

    update(dt: number): SurfaceAgent {
        // reupdate last position in case other systems change it?

        super.update(dt);

        var displacement = DISPLACEMENT;
        var source = SOURCE;

        // || (this.gotGroundNormal) &&  .maximum_ground_normal.dotProduct(this.vel) > 0)
        if ( !this.gotGroundNormal ) {
             this.velocity.y -= this.gravForce;
        }

        if (this.velocity.y > 0) this.velocity.y = 0;

        source.x = this.position.x;
        source.y = this.position.y;
        source.z = this.position.z;
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
        this.position.y = destination.y;
        this.position.z = destination.z;

        return this;
    }

}