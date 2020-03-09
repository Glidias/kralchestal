/**********************************************/
/* Your code                                  */
/**********************************************/

// PLAYCANVAS
//  reusable components (comment out if you don't need 'em)

// Batching
import './pc/batching/dynamic-clones';

// Collisions
import './pc/collision/collision-scene';
import './pc/collision/static-model-body';
import './pc/collision/recast-cli';

// Camera controls
import './pc/controls/third-person-flying';
import './pc/controls/third-person-movement';
import './pc/controls/orbit-camera';
import './pc/controls/transit-ortho';
import './pc/controls/transit-zooms';

//import './pc/debug/wireframe';

// Navmesh
import './pc/debug/nav-wireframe.ts';
import './pc/navmesh/navmesh-create.ts';
import './pc/navmesh/edge-connect.ts';

// Tests
import './pc/yuka/crowd/testAreaSample.ts';


// App
console.log("Main.js detected: runtime? "+ (typeof window === 'object' && typeof importScripts !== 'function'));