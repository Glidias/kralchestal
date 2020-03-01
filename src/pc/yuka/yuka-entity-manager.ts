import { createScript, ScriptTypeBase, attrib } from "../../../lib/create-script-decorator";
import { EntityManager } from "../../../yuka/src/core/EntityManager";
import { MovingEntity } from "../../../yuka/src/core/MovingEntity";
import { Vector3 } from "../../../yuka/src/math/Vector3";

export type Agent = {
    entity?: pc.Entity,
    posNode: pc.GraphNode,
    lastPos: Vector3,
    rotationNode?: pc.GraphNode
    movingEnt: MovingEntity,
    heightRad: number
}

export interface IYukaEntityManager {
    // entityManager: EntityManager;
    addAgent(posNode: pc.GraphNode, rotationNode: pc.GraphNode, entity?: pc.Entity): void;
}


@createScript("yukaEntityManager")
class YukaEntityManager extends ScriptTypeBase implements IYukaEntityManager {
  
    entityManager: EntityManager;
    agents: Agent[];

    initialize () {
        this.entityManager = new EntityManager();
        this.agents = [];
    }

    addAgent(posNode: pc.GraphNode, rotationNode: pc.GraphNode, entity?: pc.Entity): void {
        throw new Error("Method not implemented.");
    }

    update(dt: number) {
        var i, agent;
        var agents = this.agents;
        var pos;
        var rot;
        var vel;
        // from physics (if any)
        for (i = agents.length - 1; i >= 0; i--) {
            agent = agents[i];
            pos = agent.posNode.getPosition();
            agent.movingEnt.position.x = pos.x;
            agent.movingEnt.position.y = pos.y - agent.heightRad * 0.5;
            agent.movingEnt.position.z = pos.z;
            //agent.movingEnt.
            
            // match result extVelocity for surfaceMovement back
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
     
             vel =  agent.entity.rigidbody ?  agent.entity.rigidbody.linearVelocity : agent.movingEnt.velocity;
           
            pos = agent.entity.getPosition();
            if (vel.x*vel.x + vel.z*vel.z > 0.00000001) {
                agent.rotationNode.lookAt(pos.x + vel.x, pos.y, pos.z + vel.z);
           }
            
            if (agent.entity.rigidbody) {
               
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