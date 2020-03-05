import { GameEntity } from "../../../../yuka/src/core/GameEntity";

export interface ISpawn {
	spawn(): GameEntity;
}