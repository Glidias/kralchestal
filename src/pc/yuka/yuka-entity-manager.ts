import { createScript, ScriptTypeBase, attrib } from "../../../lib/create-script-decorator";
import { EntityManager } from "../../../yuka/src/core/EntityManager";
import { MovingEntity } from "../../../yuka/src/core/MovingEntity";

// pc.GraphNode reduced access
interface IPosNode {
    getPosition(): pc.Vec3;
}
interface IRotNode {
    // getRotation(): pc.Vec3;
    lookAt(x: pc.Vec3 | number, y: pc.Vec3 | number, z: number, ux?: number, uy?: number, uz?: number): void;
}

export type Agent = {
    entity?: pc.Entity,
    posNode: IPosNode
    // lastPos: Vector3,
    rotationNode?: IRotNode
    movingEnt: MovingEntity,
    heightRad: number
}

interface IYukaEntityManager {
    entityManager: EntityManager;
    addAgent(movingEnt:MovingEntity, posNode: IPosNode, rotationNode: IRotNode, height?:number, entity?: pc.Entity): void;
}


@createScript("yukaEntityManager")
class YukaEntityManager extends ScriptTypeBase implements IYukaEntityManager {
  
    entityManager: EntityManager;
    agents: Agent[];

    initialize () {
        this.entityManager = new EntityManager();
        this.agents = [];
    }

    addAgent(movingEnt:MovingEntity, posNode: IPosNode, rotationNode: IRotNode, height:number=0, entity?: pc.Entity): void {
        // todo
    }

    update(dt: number) {
        var i, agent;
        var agents = this.agents;
        var pos;
        var rot;
        var vel;
        // from physics or playcanvas-related collisions/scripts sync back(if any)
        for (i = agents.length - 1; i >= 0; i--) {
            agent = agents[i];
            pos = agent.posNode.getPosition();
            agent.movingEnt.position.x = pos.x;
            agent.movingEnt.position.y = pos.y - agent.heightRad;
            agent.movingEnt.position.z = pos.z;
            //agent.movingEnt.
            
            // match result extVelocity for surfaceMovement back given physics (if any)
            if (agent.entity && agent.entity.rigidbody ) { //&& !this.flowFieldBehaviour.active
                vel = agent.entity.rigidbody.linearVelocity;
                agent.movingEnt.velocity.x = vel.x;
                agent.movingEnt.velocity.y = vel.y;
                agent.movingEnt.velocity.z = vel.z;
            }
        }
        
        this.entityManager.update(dt);   
            

        // 
        for (i = agents.length - 1; i >= 0; i--) {
            agent = agents[i];
            let phy =  agent.entity &&  agent.entity.rigidbody;
             vel =phy ?  agent.entity.rigidbody.linearVelocity : agent.movingEnt.velocity;
           
            pos = agent.entity.getPosition();
            if (vel.x*vel.x + vel.z*vel.z > 0.00000001) {
                agent.rotationNode.lookAt(pos.x + vel.x, pos.y, pos.z + vel.z);
           }
            
            if (phy) {
                 // yagni atm... if agent is flying, force.y should be included in
                //force.y = agent.vehicle.velocity.y - vel.y;
                
                //force.x *= 2500; // arbotuary value here?
                //force.z *= 2500;
                agent.entity.rigidbody.applyForce(agent.movingEnt.velocity.x - vel.x, 0,  agent.movingEnt.velocity.z - vel.z);
            } 
            
        }
        
    }

    /*
    update(dt: number) {
        var i, agent;
        var agents = this.agents;
        var pos;
        var rot;
        var vel;
        // from physics (if any)
        for (i = agents.length - 1; i >= 0; i--) {
            agent = agents[i];
            agent.lastPos.copy(agent.movingEntity.position);
        }

        this.entityManager.update(dt);

        for (i = agents.length - 1; i >= 0; i--) {
            agent = agents[i];
            vel =   agent.movingEntity.velocity;
            pos = agent.posNode.getPosition();

            if (agent.rotationNode && vel.x*vel.x + vel.z*vel.z > 0.00000001) {
                //agent.vehicle.lookAt(agent.movingEntity.position.x +vel.x, agent.movingEntity.position.y, agent.movingEntity.position.z + vel.z);
                agent.rotationNode.lookAt(pos.x + vel.x, pos.y, pos.z + vel.z);
           }
    
    }
    */
    
}