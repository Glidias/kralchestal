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

/*
let canvas = document.querySelector('canvas')
let ctx = canvas.getContext('2d')

ctx.translate(20, 400)
ctx.scale(2, -2)

function drawLine(A, B, color = 'black') {
	ctx.strokeStyle = color
  ctx.lineWidth = .75
  ctx.beginPath()
  ctx.moveTo(A.x, A.y)
  ctx.lineTo(B.x, B.y)
	ctx.stroke()
}

function drawDot(p, r = 1) {
	ctx.fillStyle = 'black'
  ctx.beginPath()

  ctx.arc(p.x, p.y, r, 0, 2 * Math.PI)
	ctx.fill()
}
function drawText(text, x, y) {
  ctx.scale(1, -1)
  ctx.fillText(text, x, -y)
  ctx.scale(1, -1)
}

function halton (index, base) {
  let fraction = 1;
  let result = 0;
  while (index > 0) {
    fraction /= base;
    result += fraction * (index % base);
    index = Math.floor(index / base); // floor division
  }
  return result;
}

function r2(n) {
  var g = 1.32471795724474602596
  var a1 = 1.0/g
  var a2 = 1.0/(g*g);
  return { x: (0.5+a1*n) %1, y:  (0.5+a2*n) %1};
}

var nCount = 0;
function randomValX(n){
  return (n * 0.754877669 % 1)
}
function randomValY(n){
  return  (n * 0.569840296 % 1)
}

 function golden (i) {
    return 0.618033988749894848 * i % 1;
  }

function randomPoint(A, B, C) {
		nCount++;
    let res = r2(nCount);
    let ptry= res.x; //randomValX(nCount);
    let qtry =res.y;// randomValY(nCount);
    let p = Math.random()*0.01 + halton(nCount, 2)*0.0 +  ptry*0.99; //randomValX(nCount)
    let q = Math.random()*0.01 +  halton(nCount, 3)*0.0 +  qtry *0.99; //randomValY(nCount)

		//act(p0 + float(n)*vec2(0.754877669, 0.569840296))
    if (p + q > 1) {
    	p = 1 - p
      q = 1 - q
    }

    let dx = (C.x - A.x);
    let dy = (C.y - A.y);
    let d = Math.sqrt(dx*dx + dy*dy);
		let pr = Math.sqrt(p);
    // A + AB * p + BC * q
    let x = A.x + (B.x - A.x)* q + (C.x - A.x) * p
    let y = A.y + (B.y - A.y) *q + (C.y - A.y) *p



    return { x, y }
}

let A = { x:20, y:40 }
let B = { x:300, y:0 }
let C = { x:100, y:150 }

drawLine(A, B)
drawLine(B, C)
drawLine(A, C)
drawText('A', A.x - 10, A.y - 5)
drawText('B', B.x + 10, B.y - 5)
drawText('C', C.x - 5, C.y + 10)

for (let i = 0; i < 444; i++) {
	drawDot(randomPoint(A, B, C))
}
*/