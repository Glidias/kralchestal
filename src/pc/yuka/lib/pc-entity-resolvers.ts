import EllipsoidCollider from "../../../hx/systems/collisions/EllipsoidCollider";
import CollisionBoundNode from "../../../hx/altern/collisions/CollisionBoundNode";

// resolve non-primitives and non-pc types based off a reference playcanvas entity

var DEFAULT_COLLIDER_THRESHOLD = 0.00001;
export function _setDefaultColliderThreshold(val: number) {
	DEFAULT_COLLIDER_THRESHOLD = val;
}

export function collider(entity:pc.Entity):EllipsoidCollider {
	return null;
}

export function collidable(entity:pc.Entity):CollisionBoundNode {
	return null;
}