import { createScript, ScriptTypeBase, attrib } from "../../../lib/create-script-decorator";
import { EntityManager } from "../../../yuka/src/core/EntityManager";

@createScript("yukaEntityManager")
class YukaEntityManager extends ScriptTypeBase  {

    entityManager: EntityManager;

    initialize () {
        this.entityManager = new EntityManager();
    }

    update(dt: number) {
        this.entityManager.update(dt);
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