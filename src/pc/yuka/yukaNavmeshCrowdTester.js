var YukaNavmeshCrowdTester = pc.createScript('YukaNavmeshCrowdTester');
YukaNavmeshCrowdTester.attributes.add("uiGoButtonEntity", {type:"entity"});
YukaNavmeshCrowdTester.attributes.add("numAgents", {type:"number", min:0, default:10});
YukaNavmeshCrowdTester.attributes.add("teleportPlayerRegion", {type:"number", min:-1, default:-1});

// initialize code called once per entity
YukaNavmeshCrowdTester.prototype.postInitialize = function() {
    this.collisionSceneUtil = !this.collisionSceneRef ? (this.app.root.script ? this.app.root.script.collisionScene : null) || (this.app.root.children.length && this.app.root.children[0].script ? this.app.root.children[0].script.collisionScene : null) : this.collisionSceneRef.script.collisionScene;
    this.recastCLIParams = this.getRecastCLIParams();
    this.navMesh = this.app.root.findByName("navmesh").script.yukaNavmesh.navMesh;
    NavmeshMovement.navmesh = this.navMesh;
    
    NavmeshMovement.agentHeightOffset = this.recastCLIParams.agentHeight * 0.5;
    
    this.camera = this.app.root.findByName("Camera");
    this.modelRotate = this.entity.findByName("modelRotate");
    this.orbitCamera = this.camera.script.orbitCamera;
    this.navMeshGeometry = this.app.root.findByName("navmesh").script.yukaNavmesh.navMeshGeometry;
    this.raycaster = new altern.Raycaster(this.navMeshGeometry);
    NavmeshMovement.raycaster = this.raycaster;
    
    this.yukaPoint = new YUKA.Vector3();
    this.yukaPoint2 = new YUKA.Vector3();
    this.finalDestPt = new YUKA.Vector3();
    
    this.yukaAgPos = new YUKA.Vector3();
    // this.yukaAgPosEnd = new YUKA.Vector3();
    this.yukaAgClampPos = new YUKA.Vector3();
    
    this.searchF = new YUKA.Dijkstra(this.navMesh.graph);  
    this.lastRegion = null;
    
    this.flowVectorColor = new pc.Color(1,0,0);
    this.flowVectorColor2 = new pc.Color(1,0,1);
    
    this.fanVectorColor = new pc.Color(0, 0.5, 0.5);
    this.fanVectorColor2 = new pc.Color(255/255, 127/255, 80/255);
    
    
    this.flowSpinVectorColor = new pc.Color(255/255,165/255,0);
    this.flowFinalVectorColor = new pc.Color(1,0,1);
    this.flowEdgeColor = new pc.Color(1,1,0);
    
    this.navMeshField = new YUKA.NavMeshFlowField(this.navMesh);
    this.navMeshField.initPersistant(null);
    
    this.entityManager = new YUKA.EntityManager();
    this.flowFieldBehaviour = new YUKA.NavMeshFlowFieldBehavior(this.navMeshField, this.finalDestPt, this.searchF, 0.2, 0.2, this.onArrived);
    this.flowFieldBehaviour.active = false;
    this.seekBehaviour = new YUKA.SeekBehavior(this.finalDestPt);
    this.agents = [];
    
    
   	this.alignmentBehavior = new YUKA.AlignmentBehavior();
	this.cohesionBehavior = new YUKA.CohesionBehavior();
	this.separationBehavior = new YUKA.SeparationBehavior();
    this.wanderBehaviour = new YUKA.WanderBehavior();
    
    var params = {
       alignment: 0.3,
        cohesion: 0.7,
        separation: 0.5,
        seek:1
    };
    
    this.alignmentBehavior.weight = params.alignment;
    this.cohesionBehavior.weight = params.cohesion;
    this.separationBehavior.weight = params.separation;
    this.flowFieldBehaviour.weight = params.seek;
    this.wanderBehaviour.weight = 0.8;
    
    this.previewFlowEdges = null;
    
    
    this.flowHeightSignOffset = 0.51;// 0.25;
    this.flowVectorLength = 0.45;
    
    this.force = new pc.Vec3();
    
    this.markerYuka = this.app.root.findByName("markerYuka");
    
    
    // Specific app-optimization/testing settings
    //YUKA.FlowTriangulate.setDiscontinuous(true);
    YUKA.NavMeshFlowField.cacheRegionIndexLookup(this.navMesh);
    
    if (this.uiGoButtonEntity) {
        this.uiGoButtonEntity.element.on("mousedown", this.onMouseDownGo, this);
    }
    if (this.uiGoButtonEntity) this.uiGoButtonEntity.element.on("touch", this.onTouchDownGo, this);
    
    this.sampleEntity = this.getNewSampleEntity();
    
    
    this.entityManager.add( this.addAgent(this.entity, this.modelRotate) );
    this.initCrowd();
    
};

YukaNavmeshCrowdTester.prototype.initCrowd = function() {
    var i;
    var len = this.numAgents;
    var randAngle ;
    var dx; 
    var dz;
    var randDist;
    var pos;
    var agentRadius = this.recastCLIParams.agentRadius;

    for (i =0; i<len; i++) {
        var entity = this.sampleEntity.clone();
        pos = entity.getPosition();
        randAngle = Math.random() * (Math.PI*2);
        randDist = agentRadius + Math.random() *  agentRadius*4;
        dx = Math.cos(randAngle);
        dz = Math.sin(randAngle);
        dx *= randDist;
        dx *= randDist;
        randAngle = Math.random()*360;
        
        entity.setPosition(pos.x + dx, pos.y, pos.z + dz);
        this.entityManager.add( this.addAgent(entity, entity.children[0]) );
        this.app.root.addChild(entity);
    }
};

YukaNavmeshCrowdTester.prototype.getNewSampleEntity = function() {
    var readd = false;
    if (this.camera.parent === this.entity) {
        this.entity.removeChild(this.camera);
     readd = true;   
    }

  var ent = this.entity.clone();
  if (ent.rigidbody) {
    ent.removeComponent("script");
  } else {
      ent.script.destroy("recastCLI");
      ent.script.destroy("YukaNavmeshCrowdTester");
  }
    if (readd) {
        this.entity.addChild(this.camera);
    }
  return ent;
};

YukaNavmeshCrowdTester.prototype.getRecastCLIParams = function() {
   if (this.collisionSceneUtil) return this.collisionSceneUtil.getRecastCLIParams(true, true);
    
    var scriptRef = null;
    if (this.recastCLIEntity) {
        scriptRef = this.recastCLIEntity.script.recastCli;
    }
    else {
        scriptRef = this.entity.script.recastCli;
    }
    if (!scriptRef) {
        
        return null;
    }
    this.recastCLIParams = scriptRef.getParams(true);
    return this.recastCLIParams;
};


YukaNavmeshCrowdTester.prototype.onArrived = function(vehicle) {
  //  console.log("vehicle has arrived");
};

YukaNavmeshCrowdTester.prototype.onMouseDownGo = function() {
    this.touchedDownGo = true;
};

YukaNavmeshCrowdTester.prototype.onTouchDownGo = function() {
    this.touchedDownGo = true;
};

YukaNavmeshCrowdTester.prototype.addAgent = function(entity, rotationEntity) {
    var vehicle = new YUKA.Vehicle();

    var thirdPersonMovement = entity.script && (entity.script.thirdPersonMovement || entity.script.surfaceMovement || entity.script.navmeshMovement) ? (entity.script.thirdPersonMovement || entity.script.surfaceMovement || entity.script.navmeshMovement) : null;


	vehicle.updateNeighborhood = true;
	vehicle.neighborhoodRadius = 2;
    var pos = entity.getPosition();
	vehicle.rotation.fromEuler( 0, 2 * Math.PI * Math.random(), 0 );
	vehicle.position.x = pos.x;
    vehicle.position.y = pos.y - this.recastCLIParams.agentHeight * 0.5;
	vehicle.position.z = pos.z;
	vehicle.updateWorldMatrix();
    
    vehicle.updateOrientation = false
;
    
    vehicle.maxSpeed = 4;
    
	//vehicle.setRenderComponent( vehicleMesh, sync );
		//this.forceToApply = new B2Vec2();

	//vehicle.steering.add( alignmentBehavior );
	//vehicle.steering.add( cohesionBehavior );
	//vehicle.steering.add( separationBehavior );
	//
	//vehicle.steering.add(this.seekBehaviour);
	//
	//
	//
	// if ( entity.rigidbody) {
	//var body; // Type btRigidBody
    //body = entity.rigidbody.body;
    //body.setCcdMotionThreshold(this.recastCLIParams.agentRadius*2.0);
    //body.setCcdSweptSphereRadius(this.recastCLIParams.agentRadius * 0.5);
    //}
    
	 if (thirdPersonMovement) {
         thirdPersonMovement.extVelocity = vehicle.velocity;
         thirdPersonMovement.vehicle = vehicle;
         vehicle.lastPos = new YUKA.Vector3();
     }

    
    if (this.numAgents > 0) {
        vehicle.steering.add( this.alignmentBehavior );
        vehicle.steering.add( this.cohesionBehavior );
        vehicle.steering.add( this.separationBehavior );
    }
	vehicle.steering.add( this.flowFieldBehaviour );
    vehicle.steering.add( this.wanderBehaviour );
    
    
	this.entityManager.add( vehicle );
    
    this.agents.push({entity:entity, vehicle:vehicle, controller:thirdPersonMovement, rotationEntity:rotationEntity});

    return vehicle;
};

YukaNavmeshCrowdTester.prototype.saveFlowVectors = function() {
    var i;
    var len = this.previewFlowEdges.length;
    var lastNode = -1;
    var e;
    for (i=0; i<len; i++) {
        e = this.previewFlowEdges[i];
        var curNode = this.navMesh.getNodeIndex(e.polygon);
        this.navMeshField.calcRegionFlow(lastNode, curNode, this.searchF, this.finalDestPt );
        lastNode = curNode;
    }
    

};

YukaNavmeshCrowdTester.prototype.resetAgents = function() {
    var i = this.agents.length;
    while(--i > -1) {
        this.agents[i].vehicle.agent.reset(false);
    }
};




// update code called every frame

YukaNavmeshCrowdTester.prototype.update = function(dt) {
    var pos = this.entity.getPosition();
    this.yukaPoint.x = pos.x;
    this.yukaPoint.y = pos.y - this.recastCLIParams.agentHeight * 0.5;
    this.yukaPoint.z = pos.z; 
   

    
    var r = this.navMesh.getRegionForPoint(this.yukaPoint, 0.1);
    if (r && this.lastRegion !== r) {
         this.lastRegion = r;
        
       
        //console.log("UPdate region:"+this.navMesh.getNodeIndex(r));
        if (this.searchF.source >= 0) {
           
           this.previewFlowEdges = this.navMeshField.getFlowEdges(this.navMesh.getNodeIndex(r), (this.searchF.target >= 0 ? this.searchF.getPath() : this.searchF), true);
          
           
            this.flowFieldBehaviour.active = true;
            this.wanderBehaviour.active = false;
            // console.log(this.navMeshField._flowedFinal + " < final?" + this.previewFlowEdges.length);
            if (this.previewFlowEdges) {}
            else this.previewFlowEdges = [];
            
            if (this.previewFlowEdges) this.saveFlowVectors();

        }
    } else {
        //console.log(-1);
    }
    
    
    

    
     if (this.app.keyboard.wasPressed(pc.KEY_F) ||  this.touchedDownGo) {
          this.touchedDownGo = false;
         var ray = this.camera.forward;
         var raySrc = this.camera.getPosition();
         var rayHit;
         if ((rayHit = this.raycaster.positionAndDirection(raySrc.x, raySrc.y, raySrc.z, ray.x, ray.y, ray.z).gotHit())) {
             console.log("Got hit");
             r = this.navMesh.getRegionForPoint(this.yukaPoint.copy(rayHit));
             if (r) {
                 var nodeIndex = this.navMesh.getNodeIndex(r);
                if (nodeIndex === this.teleportPlayerRegion) {
                     if (this.entity.rigidbody)  this.entity.rigidbody.teleport(rayHit.x, rayHit.y+this.recastCLIParams.agentHeight*0.5, rayHit.z);
                        else  this.entity.setPosition(rayHit.x, rayHit.y+this.recastCLIParams.agentHeight*0.5, rayHit.z);
                    
                    this.agents[0].vehicle.agent.reset(true);
                     this.commandMode = true;
                } 
                 
                 
              this.yukaPoint.y = (-r.plane.constant - r.plane.normal.x * this.yukaPoint.x - r.plane.normal.z * this.yukaPoint.z)  / r.plane.normal.y;
     
                 
                 this.searchF.clear();
                 
                
                this.searchF.source = nodeIndex;
                 console.log("GOt region hit:"+this.searchF.source + "!!, "+this.navMesh.getNodeIndex(this.lastRegion) + " HIT:"+nodeIndex);
                 
                 //
               //  this.searchF.source =  this.navMesh.getNodeIndex(this.lastRegion);
               //  this.searchF.target = this.navMesh.getNodeIndex(r);
               // console.log("GOt region hit:"+this.searchF.source + ", "+this.searchF.target + " :"+this.lastRegion + " !");
                
                 this.searchF.search();
                 
                 this.finalDestPt.copy(this.yukaPoint);
                 if (this.markerYuka) this.markerYuka.setPosition(this.finalDestPt.x, this.finalDestPt.y, this.finalDestPt.z);
                  this.navMeshField.resetPersistant(this.searchF);
                 this.resetAgents();
                 if (this.orbitCamera) this.orbitCamera._pivotPoint.set(0,0,0);
                  this.lastRegion = null;
                
             } else {
                console.log("no region found", raySrc, ray);
             }
         } else {
            console.log("missed", raySrc, ray);
         }
     }
    
        this.updateAgents(dt);
    
    
     var regions = this.navMesh.regions;
    var i;
    var len = regions.length;

    // naively assume navmesh is NOT rotated...
    // 
    // 

    var count;
    var c;
    var color;
    var edge;
    if (!this.points) {
      
        this.points =[];
        color = new pc.Color(1,1,1);
        this.colors = [];
        
        count = 0;
      
        for (i=0;i<len;i++) {
            r = regions[i];
            edge = r.edge;
            do {
               c = count++;
               this.points[c] = new pc.Vec3(edge.vertex.x, edge.vertex.y, edge.vertex.z);
                this.colors[c] = color;

                c = count++;
                
                this.points[c] = new pc.Vec3(edge.prev.vertex.x, edge.prev.vertex.y, edge.prev.vertex.z);
                this.colors[c] = color;

                edge = edge.next;

            } while ( edge !== r.edge );

           
        }
        this.baseCount = count;
    }
    
    if(this.previewFlowEdges ) {
        count = this.baseCount;
        len = this.previewFlowEdges.length;
        var flowVector;
        var edgeField;
          for (i=0;i<len;i++) {
               edge = this.previewFlowEdges[i];
              c = count++;
              
              // base
               this.points[c] = new pc.Vec3(edge.vertex.x, edge.vertex.y+0.004, edge.vertex.z);
                this.colors[c] = this.flowEdgeColor;
                c = count++;
                this.points[c] = new pc.Vec3(edge.prev.vertex.x, edge.prev.vertex.y+0.004, edge.prev.vertex.z);
                this.colors[c] = this.flowEdgeColor;
              
              // post left
               c = count++;
               this.points[c] = new pc.Vec3(edge.vertex.x, edge.vertex.y+0.004, edge.vertex.z);
                this.colors[c] = this.flowEdgeColor;
               c = count++;
               this.points[c] = new pc.Vec3(edge.vertex.x, edge.vertex.y+0.004+this.flowHeightSignOffset, edge.vertex.z);
                this.colors[c] = this.flowEdgeColor;
              
              // post right
               c = count++;
               this.points[c] = new pc.Vec3(edge.prev.vertex.x, edge.prev.vertex.y+0.004, edge.prev.vertex.z);
                this.colors[c] = this.flowEdgeColor;
               c = count++;
               this.points[c] = new pc.Vec3(edge.prev.vertex.x, edge.prev.vertex.y+0.004+this.flowHeightSignOffset, edge.prev.vertex.z);
                this.colors[c] = this.flowEdgeColor;
              
              edgeField = this.navMeshField.edgeFieldMap.get(edge);
              // flow left
              if (edgeField) {
                   flowVector =  this.yukaPoint.copy(edgeField[0]).multiplyScalar(this.flowVectorLength);
                   c = count++;
                   this.points[c] = new pc.Vec3(edge.vertex.x, edge.vertex.y+0.004+this.flowHeightSignOffset, edge.vertex.z);
                    this.colors[c] = edgeField[0].splitNormal ? this.flowSpinVectorColor : edgeField[0].final ? this.flowFinalVectorColor :  this.flowVectorColor;
                   c = count++;
                   this.points[c] = new pc.Vec3(edge.vertex.x+flowVector.x, edge.vertex.y+0.004+this.flowHeightSignOffset, edge.vertex.z+flowVector.z);
                    this.colors[c] = edgeField[0].splitNormal ? this.flowSpinVectorColor : edgeField[0].final ? this.flowFinalVectorColor :  this.flowVectorColor;
               
                  // flow right
                   flowVector =  this.yukaPoint.copy(edgeField[1]).multiplyScalar(this.flowVectorLength);
                   c = count++;
                   this.points[c] = new pc.Vec3(edge.prev.vertex.x, edge.prev.vertex.y+0.004+this.flowHeightSignOffset, edge.prev.vertex.z);
                    this.colors[c] = edgeField[1].splitNormal ? this.flowSpinVectorColor : edgeField[1].final ? this.flowFinalVectorColor : this.flowVectorColor;
                   c = count++;
                   this.points[c] = new pc.Vec3(edge.prev.vertex.x+flowVector.x, edge.prev.vertex.y+0.004+this.flowHeightSignOffset, edge.prev.vertex.z+flowVector.z);
                    this.colors[c] = edgeField[1].splitNormal ? this.flowSpinVectorColor : edgeField[1].final ? this.flowFinalVectorColor : this.flowVectorColor;
              } else {
                  console.error("Failed to find edgeField from map exception");
                  
                    c = count++;
                   this.points[c] = new pc.Vec3(edge.prev.vertex.x, edge.prev.vertex.y+0.009, edge.prev.vertex.z);
                    this.colors[c] = this.flowEdgeColor;
                   c = count++;
                   this.points[c] = new pc.Vec3(edge.vertex.x, edge.vertex.y+0.009, edge.vertex.z.z);
                    this.colors[c] =  this.flowEdgeColor;
              }
             
              if (edge.polygon.debugTriangulation) {
                  var triangulation = edge.polygon.debugTriangulation;
                  var tri = triangulation.debugInfo || triangulation;
                    var dir;

                  var pt;
                  
                  if (tri.leftEdgeDirs) {
                       dir = tri.leftEdgeDirs ? tri.leftEdgeDirs[0] : tri.rightEdgeDirs[0];
                        pt = tri.leftEdgeDirs ? triangulation.fromPortal.prev.vertex : triangulation.fromPortal.vertex;
                       // base
                       // 

                       c = count++;
                       this.points[c] = new pc.Vec3( pt.x, pt.y+0.005, pt.z);
                        this.colors[c] = tri.leftEdgeDirs ? this.fanVectorColor2 : this.fanVectorColor;
                        c = count++;
                        this.points[c] = new pc.Vec3(pt.x+dir.x*0.5,  pt.y+0.005, pt.z+dir.z*0.5);
                        this.colors[c] =  tri.leftEdgeDirs ? this.fanVectorColor2  : this.fanVectorColor;


                       dir = tri.leftEdgeDirs ? tri.leftEdgeFlows[0][1] : tri.rightEdgeFlows[0][0];
                        pt = tri.leftEdgeDirs ? tri.leftEdgeFlows[0][1].vertex : tri.rightEdgeFlows[0][0].vertex;
                       // base
                       // 

                       c = count++;
                       this.points[c] = new pc.Vec3( pt.x, pt.y+0.005, pt.z);
                        this.colors[c] = this.fanVectorColor;
                        c = count++;
                        this.points[c] = new pc.Vec3(pt.x+dir.x*1,  pt.y+0.005, pt.z+dir.z*1);
                        this.colors[c] = this.fanVectorColor;
                    }
                  
                  if (tri.rightEdgeDirs) {
                        
                       dir = false ? tri.leftEdgeDirs[0] : tri.rightEdgeDirs[0];
                        pt = false ? triangulation.fromPortal.prev.vertex : triangulation.fromPortal.vertex;
                       // base
                       // 

                       c = count++;
                       this.points[c] = new pc.Vec3( pt.x, pt.y+0.005, pt.z);
                        this.colors[c] =this.flowVectorColor;
                        c = count++;
                        this.points[c] = new pc.Vec3(pt.x+dir.x*0.5,  pt.y+0.005, pt.z+dir.z*0.5);
                        this.colors[c] = this.flowVectorColor;


                       dir = false ? tri.leftEdgeFlows[0][1] : tri.rightEdgeFlows[0][0];
                        pt = false ? tri.leftEdgeFlows[0][1].vertex : tri.rightEdgeFlows[0][0].vertex;
                       // base
                       // 

                       c = count++;
                       this.points[c] = new pc.Vec3( pt.x, pt.y+0.005, pt.z);
                        this.colors[c] = this.fanVectorColor;
                        c = count++;
                        this.points[c] = new pc.Vec3(pt.x+dir.x*1,  pt.y+0.005, pt.z+dir.z*1);
                        this.colors[c] = this.fanVectorColor;
                   
                  }
                  
                  if (tri.diagonal) {
                      dir = tri.diagonal;
                      pt = triangulation.fromPortal.prev.vertex;
                      
                       c = count++;
                       this.points[c] = new pc.Vec3( pt.x, pt.y+0.005, pt.z);
                        this.colors[c] =this.flowVectorColor;
                        c = count++;
                        this.points[c] = new pc.Vec3(pt.x+dir.x*0.5,  pt.y+0.005, pt.z+dir.z*0.5);
                        this.colors[c] = this.flowVectorColor;
                      
                  }
     
                  
              }
              

          }
        
        this.points.length = count;
        this.colors.length = count;
        this.previewFlowEdges = null;
        
      
    }
    
    
     
    
     this.app.renderLines(this.points, this.colors);
};

YukaNavmeshCrowdTester.prototype.updateAgents2 = function(dt) {
    var i, agent;
    var agents = this.agents;
    var pos;
    var rot;
    var heightOffset = this.recastCLIParams.agentHeight * 0.5;
    var vel;
    // from physics (if any)
    for (i = agents.length - 1; i >= 0; i--) {
		agent = agents[i];
        agent.vehicle.lastPos.copy(agent.vehicle.position);
        //pos = agent.entity.getPosition();
        //agent.vehicle.position.x = pos.x;
		//agent.vehicle.position.y = pos.y - heightOffset;
        //agent.vehicle.position.z = pos.z;
	}
    
    this.entityManager.update(dt);   

    // 
    for (i = agents.length - 1; i >= 0; i--) {
		agent = agents[i];
 
         vel =   agent.vehicle.velocity;
       
        pos = agent.entity.getPosition();
        //console.log(vel);
        //agent.rotationEntity
        if (vel.x*vel.x + vel.z*vel.z > 0.00000001) {
            
            //agent.vehicle.lookAt(agent.vehicle.position.x +vel.x, agent.vehicle.position.y, agent.vehicle.position.z + vel.z);
            agent.rotationEntity.lookAt(pos.x + vel.x, pos.y, pos.z + vel.z);
   
       }

 

	}
    
    
};

YukaNavmeshCrowdTester.prototype.updateAgents = function(dt) {
    var i, agent;
    var agents = this.agents;
    var pos;
    var rot;
    var heightOffset = this.recastCLIParams.agentHeight * 0.5;
    var vel;
    // from physics (if any)
    for (i = agents.length - 1; i >= 0; i--) {
		agent = agents[i];
        pos = agent.entity.getPosition();
        agent.vehicle.position.x = pos.x;
		agent.vehicle.position.y = pos.y - heightOffset;
        agent.vehicle.position.z = pos.z;
        
        
        // todo: match result extVelocity for surfaceMovement back
        if (agent.entity.rigidbody && !this.flowFieldBehaviour.active) {
            vel = agent.entity.rigidbody.linearVelocity;
            agent.vehicle.velocity.x = vel.x;
           agent.vehicle.velocity.y = vel.y;
            agent.vehicle.velocity.z = vel.z;
        }
        /*
		var pos = agent.position();
		agent.vehicle.position.x = pos.x;
		agent.vehicle.position.z = -pos.y;
		var vel = agent.velocity();
		agent.vehicle.velocity.x = vel.x;
		agent.vehicle.velocity.z = vel.y;
        */
	}
    
    this.entityManager.update(dt);   
        
    var force = this.force;
    // 
    for (i = agents.length - 1; i >= 0; i--) {
		agent = agents[i];
 
         vel =   agent.entity.rigidbody ?  agent.entity.rigidbody.linearVelocity : agent.vehicle.velocity;
       
        pos = agent.entity.getPosition();
        //console.log(vel);
        //agent.rotationEntity
        if (vel.x*vel.x + vel.z*vel.z > 0.00000001) {
            
            //agent.vehicle.lookAt(agent.vehicle.position.x +vel.x, agent.vehicle.position.y, agent.vehicle.position.z + vel.z);
            agent.rotationEntity.lookAt(pos.x + vel.x, pos.y, pos.z + vel.z);
            //agent.rotationEntity.setRotation(agent.vehicle.rotation.x, agent.vehicle.rotation.y, agent.vehicle.rotation.z, agent.vehicle.rotation.w);
            
            ///agent.rotationEntity.setRotation(agent.vehicle.rotation.x, agent.vehicle.rotation.y, agent.vehicle.rotation.z, agent.vehicle.rotation.w);
            
            /*
            var rotEul = agent.rotationEntity.getEulerAngles();
            rotEul.x = 0;
            rotEul.z = 0;
            agent.rotationEntity.setEulerAngles(rotEul);
            */
       }
        
        if (agent.entity.rigidbody) {
       
       // vel = agent.entity.rigidbody.linearVelocity;
       // /*
        force.x = agent.vehicle.velocity.x - vel.x;
        //force.y = agent.vehicle.velocity.y - vel.y;
        force.z = agent.vehicle.velocity.z - vel.z;
        force.x *= 2500;
        force.z *= 2500;
        agent.entity.rigidbody.applyForce(force);
      //  */
      //  
      
        
        /*
        force.x = agent.vehicle.velocity.x;
        force.y = vel.y;
        force.z = agent.vehicle.velocity.z;
        agent.entity.rigidbody.linearVelocity = force;
        */
        
        } 
        
        
       

	}
    
    
};

// swap method called for script hot-reloading
// inherit your script state here
// YukaNavmeshCrowdTester.prototype.swap = function(old) { };

// to learn more about script anatomy, please read:
// http://developer.playcanvas.com/en/user-manual/scripting/