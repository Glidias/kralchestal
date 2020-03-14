import { EntityManager } from "../../../../yuka/src/core/EntityManager";
import { NavMesh } from "../../../../yuka/src/navigation/navmesh/NavMesh";
import { AABB } from "../../../../yuka/src/math/AABB";
import { BoundingSphere } from "../../../../yuka/src/math/BoundingSphere";
import { ISpawn } from "../entities/ISpawn";

class CreateCrowd {
	spawners: ISpawn[];
	entityManager: EntityManager;
	area: AABB | BoundingSphere;
	spawnPoints: { x: number; y: number; z: number; };
	navmesh: NavMesh;
	spawnWeights: number[];
	spawnAmounts: number[];

	entities: any[] = [];

	constructor({ entityManager, spawners, spawnAmounts=[1], spawnWeights, navmesh, spawnPoints, area }: {
entityManager: EntityManager; spawners: ISpawn[]; spawnAmounts?: number[]; spawnWeights?: number[]; navmesh?: NavMesh; spawnPoints?: {
	x: number;
	y: number;
	z: number;
}; area?: (AABB | BoundingSphere);
}) 	{
		this.entityManager = entityManager;
		this.spawners = spawners;
		this.spawnAmounts = spawnAmounts;
		this.spawnWeights = spawnWeights;
		this.navmesh = this.navmesh;
		this.spawnPoints = spawnPoints;
		this.area = area;

		this.initiate();
	}

	initiate() {
		let ei = this.entities.length;
		for (let i = 0, l = this.spawners.length; i< l; i++) {
			let e;
			this.entities[ei++] =  e = this.spawners[i].spawn();
			// Got spawn points? position
			// check if need on navmesh? // consider quad tree spawning distribution?
			//
			// check if got area
			this.entityManager.add(e);
		}
	}

	/*
	dispose() {
		if (this.entities) {
			if (this.entityManager) {

			}
			this.entities = null;
		}
	}
	*/


}
