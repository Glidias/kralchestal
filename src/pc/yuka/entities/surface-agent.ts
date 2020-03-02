import { Vehicle } from "../../../../yuka/src/steering/Vehicle";
import EllipsoidCollider from "../../../hx/systems/collisions/EllipsoidCollider";
import CollisionBoundNode from "../../../hx/altern/collisions/CollisionBoundNode";

class SurfaceAgent extends Vehicle {
   collider:EllipsoidCollider;
   collidable:CollisionBoundNode; 
   constructor() {
        super();

    }

}