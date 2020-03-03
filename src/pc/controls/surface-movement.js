import Vector3D from "../../hx/jeash/geom/Vector3D";
import EllipsoidCollider from "../../hx/systems/collisions/EllipsoidCollider";
import CollisionBoundNode from "../../hx/altern/collisions/CollisionBoundNode";
import CollisionEvent from "../../hx/systems/collisions/CollisionEvent";

/**
 * Simplified surface movement often relying on external supplied velocity
 * without calculating exact collision ground normal value for relatively stable movement.
 * ground movement.
 * @type {typeof pc.ScriptType & {attributes: pc.ScriptAttributes}}
 */
var SurfaceMovement = pc.createScript('surfaceMovement');

SurfaceMovement.attributes.add('gravForce', { type: 'number', default:0.5 });
SurfaceMovement.attributes.add('ellipsoidThreshold', { type: 'number', default:0.00001, min:Number.MIN_VALUE });
SurfaceMovement.attributes.add('groundNormalThreshold', { type: 'number', default:0, min:0, max:1 });

if (typeof importScripts !== 'function') {
    SurfaceMovement.SOURCE = new Vector3D();
    SurfaceMovement.DISPLACEMENT  = new Vector3D();
    SurfaceMovement.COLLIDER  =  new EllipsoidCollider(0.6, 1.8, 0.6, 0.000001, true);
}

SurfaceMovement.prototype.initialize = function() {
    this.gotGroundNormal = false;
    // Other scripts might have already initialized .posNode and .vel velocity for this component
    if (!this.posNode) this.posNode = this.entity;
    if (!this.vel) this.vel = new pc.Vec3();
};

/**
 * @param posNode {{getPosition: ()=>pc.Vec3, setPosition: (x: number, y:number, z:number)=>void}}
 * @param vel {Vector3D}
 */
SurfaceMovement.prototype.setPayload = function (posNode, vel) {
    this.posNode = posNode;
    this.vel = vel;
}

/**
 * @param scene {CollisionBoundNode}
 */
SurfaceMovement.prototype.setCollisionScene = function(scene) {
    this.collisionScene = scene;
}

// initialize code called once per entity
SurfaceMovement.prototype.postInitialize = function() {
    if (this.collisionScene) return;

    this.collisionScene = this.app.root.collisionScene || (this.app.root.children.length ? this.app.root.children[0].collisionScene : null) || ( window["Rootscene"] ? Rootscene.SCENE :  null);
    if (!this.collisionScene) alert("SurfaceMovement:: Failed to find collision scene!");
    if (this.collisionScene == null) {
        console.warn("surface-movement :: Collision scene currently empty!");
        this.collisionScene = CollisionBoundNode.create(new Transform3D());
        this.app.once('collision-scene-initialized', this.onCollisionSceneInited, this);
    }
};

SurfaceMovement.prototype.onCollisionSceneInited = function(scene) {
    this.collisionScene = scene;
};

// update code called every frame
SurfaceMovement.prototype.update = function(dt) {
    var pos = this.posNode.getPosition();

    /**
     * @type {Vector3D}
     */
    var displacement = SurfaceMovement.DISPLACEMENT;

    /**
     * @type {Vector3D}
     */
    var source = SurfaceMovement.SOURCE;

    /**
     * @type {EllipsoidCollider}
     */
    var collider = SurfaceMovement.COLLIDER;
    collider.radiusX = collider.radiusZ = this.entity.collision.radius;
    collider.radiusY = this.entity.collision.height * 0.5;

    // || (this.gotGroundNormal) &&  .maximum_ground_normal.dotProduct(this.vel) > 0)
    if ( !this.gotGroundNormal ) {
         this.vel.y -= this.gravForce;
    }

    if (this.vel.y > 0) this.vel.y = 0;

    source.x = pos.x;
    source.y = pos.y;
    source.z = pos.z;
    displacement.x = this.vel.x * dt;
    displacement.y = this.vel.y * dt;
    displacement.z = this.vel.z * dt;


    var destination = collider.calculateDestination(source, displacement, this.collisionScene);
    var gotGroundNormal = false; // this.gotGroundNormal;

   if (this.vel.x*this.vel.x + this.vel.y+this.vel.y + this.vel.z*this.vel.z !== 0) {
        this.gotGroundNormal = false;
   }

    var c = collider.collisions;
    collider.collisions = null;

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
    this.posNode.setPosition(destination.x, destination.y, destination.z);
};

export default SurfaceMovement;