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

nCount = 0;//Math.ceil(Math.random()*10);
function randomPoint(A, B, C) {
		nCount++;
    let res = r2(nCount);
    let ptry= randomValX(nCount);
    let qtry =randomValY(nCount);
    let perturb = 0;
    let regular =1;
    let halt =0;
    let p = Math.random()*perturb + halton(nCount, 2)*halt +  ptry*regular; //randomValX(nCount)
    let q = Math.random()*perturb +  halton(nCount, 3)*halt +  qtry *regular; //randomValY(nCount)

		//act(p0 + float(n)*vec2(0.754877669, 0.569840296))
    if (p + q > 1) {
    	//p = 1 - p
      //q = 1 - q
    }
    
    let v = Math.sqrt(q);
    let a = 1 - v;
    let b = (1 - p) * v;
	  let c = p * v;
  
    let dx = (C.x - A.x);
    let dy = (C.y - A.y);
    let d = Math.sqrt(dx*dx + dy*dy);
		let pr = Math.sqrt(p);
    // A + AB * p + BC * q
    //let x = A.x + (B.x - A.x)* q + (C.x - A.x) * p
   // let y = A.y + (B.y - A.y) *q + (C.y - A.y) *p
   
    	
   let x = a*A.x + b*B.x + c*C.x;
   let y =  a*A.y + b*B.y + c*C.y;

   return { x, y }
}

let A = { x:100, y:150 }
let B = { x:300, y:0 }
let C = { x:20, y:40 }

drawLine(A, B)
drawLine(B, C)
drawLine(A, C)
drawText('A', A.x - 10, A.y - 5)
drawText('B', B.x + 10, B.y - 5)
drawText('C', C.x - 5, C.y + 10)

for (let i = 0; i <17; i++) {
   drawDot(randomPoint(A, B, C))
}
*/


/*
On navmesh

Generate entire reservoire of polygons (but bounded).
For eac shortest path tree set that stores the edge to current polygon, also store (regarding the edge itself, the reference visitattion point for closest point on edge upon entry)

Run through entire reservoire list to get area, and determine how many max prefered point allocations per polygon.

Run through entire resourvire list again to randomly determine number of allocations for polygon, up to max prefered limit. 

If max prefered limit is reached for polgon. then mark it to be skipped and spliced from list.

In the event all polygons have been spliced out from list and there still neeeds remaining allocations, continue expanding the graph out from all node areas that have edges leading to unknown cost areas.

Fill points for given polygons respectively up to max limit, but also check if it's within distance of reference visitation point to mark the point as confirmed. For points that are too far out from vistation point or too far out from nearest confirmed point, reject. Also consider optionally for points that intersect other points (based off agent radius) to be snapped and rejected. Continue filling point up to max limit.

Add any rejected points to next polygon in resevoire list, up to max limit. Repeat process for next polygon until all required allocations has been reached.

In the event there are still rejected points left before the required allocations has been reacehed. The graph must be expanded further again. Repeat until there is no more space left in the graph. From there, log a warning exception or something and just force fit into any unused points anywhere. This case is unlikely rare unless you intend to squeeze way too many characters beyond what the navmesh supports.

..................

Alternatively, let the graph search and everytime a node has been added to shrotest path tree, add node to the rervoire and run 1 iteration through the entire reservoire, calculating the entire polygon area and area of sub-triangles (if needed) for each polygon, and then also attempt to add just 1 point into the given selected polygon, up to max prefered capacity limit, and consider that point as accepted (add to allocated success accepted count) together with the current allocated count for that polygnon (and total allocation count), and continue from there. 
*/

/*
g = 1.6180339887498948482
a1 = 1.0/g
x[n] = (0.5+a1*n) %1
*/

/*
g = 1.22074408460575947536
a1 = 1.0/g
a2 = 1.0/(g*g)
a3 = 1.0/(g*g*g)
x[n] = (0.5+a1*n) %1
y[n] = (0.5+a2*n) %1
z[n] = (0.5+a3*n) %1
*/