/*
crowd-manager: Everything to do with managing spawned entities via flyweighted crowd movement beaviours or custom-assigned ones.
----------------
- createSeekBehaviourForEntities(entities, destPt):SeekBehaviour
- createNavmeshFlowFieldBehaviourForEntities(entities, navmesh, destPt?, region?):NavmeshFlowFieldBehaviour;
- moveSeekEntities(entities, destPt):SeekBehaviour;
- moveNavmeshFLowFieldEntities(entities, navmesh, destPt?, region):NavmeshFlowFieldBehaviour;
- haltEntities(entities):void
- replaceWithOtherBehaviour(entities, behaviour):void

If (count of uniqiue behavours among entities === 1 && count of entities === matches supplied behaviour 1st when moving entity, no new behaviour needs to be created. Use existing beheaviour.

Otherwise, for every new behaviour assignment, assign usageCOount of respective beaviour and decrement usage count of existing behaviour that gets replaced for entity, Then, go through all uniquely found beheaviours that was gatehred again and ceck if usageCOunt reduces to zero, behaviour can be recached to pool. Even without the 1st optimization in the previous paragraph, the result of keeping the same set of entities sharing the same beheaviour and location, is still cycling between 2 instances in/out of the pool.

AN assumption can be made that the destination-crowd steering beaviours are at the last slot of the entity always. This means all pre-existing behaviours must be assigned first prioer to running through  crowd-manager.

In the future, Crowdmanager also works closely with the number of entities reuqesting for the entire flow graph search towards destination, and may generate limited size expanded scaled to the size of the query needed to reach destination point from where all the entities are located only rather than fillin  up entire graph with full flowfield.  Options to customise the way navmesh flowfields aree searched to be  generated (via different search approaches can be done).
*/

class CrowdManager {
	constructor() {

	}
}