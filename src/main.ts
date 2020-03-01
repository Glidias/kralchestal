/**********************************************/
/* Your code                                  */
/**********************************************/

// PLAYCANVAS
//  reusable components (comment out if you don't need 'em)
import './pc/batching/dynamic-clones';

import './pc/collision/collision-scene';
import './pc/collision/static-model-body';
import './pc/collision/recast-cli';
import './pc/collision/static-model-body';

import './pc/controls/third-person-flying';
import './pc/controls/third-person-movement';
import './pc/controls/orbit-camera';
import './pc/controls/transit-ortho';
import './pc/controls/transit-zooms';

//import './pc/debug/wireframe';

import './pc/debug/nav-wireframe.ts';
import './pc/navmesh/navmesh-create.ts';
import './pc/navmesh/edge-connect.ts';


// App
console.log("Main.js detected: runtime? "+ (typeof window === 'object' && typeof importScripts !== 'function'));