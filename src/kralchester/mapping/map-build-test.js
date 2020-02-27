import CollisionBoundNode from "../../hx/altern/collisions/CollisionBoundNode";
import Transform3D from "../../hx/components/Transform3D";
import {SVGCityReader} from "../towngen/SVGCityReader";
import {NavMeshUtils} from "../../../yuka/src/navigation/navmesh/NavMeshUtils";

var MapBuildTest = pc.createScript('mapBuildTest');
MapBuildTest.attributes.add("svg", {type:"asset", assetType:"text"});
MapBuildTest.attributes.add("_spawnMapInNode", {type:"entity"});

MapBuildTest.attributes.add("globalScale", {type:"number", default:1, description:"SVG export scale on XZ direction"});

MapBuildTest.attributes.add("wallRadius", {type:"number", default:1.0, description:"Recc Default 1! Change at yr own risk!"});
MapBuildTest.attributes.add("wallPillarRadius", {type:"number", default:1.3, description:"Recc Default 1.3 to against wallRadius 1! Change at yr own risk!"});

MapBuildTest.attributes.add("cityWallTowerTopAltitude", {type:"number", default:23.5});
MapBuildTest.attributes.add("cityWallAltitude", {type:"number", default:19});
MapBuildTest.attributes.add("cityWallTowerBaseAltitude", {type:"number", default:5});
MapBuildTest.attributes.add("highwayAltitude", {type:"number", default:12});
MapBuildTest.attributes.add("wardRoadAltitude", {type:"number", default:3});
MapBuildTest.attributes.add("outerRoadAltitude", {type:"number", default:0});
MapBuildTest.attributes.add("innerWardAltitude", {type:"number", default:0});


MapBuildTest.attributes.add("cityWallCeilThickness", {type:"number", default:1});
MapBuildTest.attributes.add("cityWallEntranceExtrudeThickness", {type:"number", default:1.4});
MapBuildTest.attributes.add("highwayExtrudeThickness", {type:"number", default:2});
MapBuildTest.attributes.add("wardRoadExtrudeThickness", {type:"number", default:0.5});
MapBuildTest.attributes.add("outerRoadExtrudeThickness", {type:"number", default:0});
MapBuildTest.attributes.add("rampedBuildingExtrudeThickness", {type:"number", default:-1});

MapBuildTest.attributes.add("buildingMinHeight", {type:"number", default:4});
MapBuildTest.attributes.add("buildingMaxHeight", {type:"number", default:7});

MapBuildTest.attributes.add("minBuildingEdges", {type:"number", default:3, min:3});
MapBuildTest.attributes.add("maxBuildingEdges", {type:"number", default:3, min:3});
MapBuildTest.attributes.add("minBuildingEdgeLength", {type:"number", default:0, min:0});
MapBuildTest.attributes.add("maxBuildingEdgeLength", {type:"number", default:0, min:0});
MapBuildTest.attributes.add("smallenBuildingEdgeLength", {type:"number", default:0, min:0});
MapBuildTest.attributes.add("smallenSqRootAreaTest", {type:"number",  precision:0, step:1, default:0, min:-1, max:1});
MapBuildTest.attributes.add("largenBuildingEdgeLength", {type:"number", default:0, min:0});
MapBuildTest.attributes.add("largenSqRootAreaTest", {type:"number",  precision:0, step:1, default:0, min:-1, max:1});


MapBuildTest.attributes.add("quadRoofChance", {type:"number",  default:1, min:0, max:1});
MapBuildTest.attributes.add("_buildingInset", {type:"number", default:0});
MapBuildTest.attributes.add("_buildingSlopedRoofs", {type:"boolean", default:true});
MapBuildTest.attributes.add("_matchFloorPlanePadded", {type:"number", default:0, min:0});


/*
// Altitude settings (in intended export 3D scale values)
		this.cityWallTowerTopAltitude = 19.5;
		this.cityWallAltitude = 16;
		this.cityWallTowerBaseAltitude = 14;
		this.highwayAltitude = 12;
		this.wardRoadAltitude = 3;
		// this.innerWardRoadAltitude = 0;
		this.innerWardAltitude = 0;

		this.cityWallCeilThickness = 1;
		// extude thickness, if negative value, will sink into ground exclude bottom base faces
		this.cityWallEntranceExtrudeThickness = 1.4;
		this.highwayExtrudeThickness = 3;
		this.wardRoadExtrudeThickness = 0.7;
		this.rampedBuildingExtrudeThickness = -1;

		// Export 3d scale settings
		this.exportScaleXZ = 4;
*/


// initialize code called once per entity
MapBuildTest.prototype.initialize = function() {
    if (this.entity.script.buildMaterials && !this.entity.script.buildMaterials.enabled) {
         this.app.autoRender = false;
    }
    if (this.svg) {
        this.setupSVGMap();
    }
};

MapBuildTest.prototype.setTransformFromAABB2D = function(aabb, scaleXZ, groundLevel) {
    var maxX = aabb.max.x*scaleXZ + this._matchFloorPlanePadded;
    var minX = aabb.min.x*scaleXZ - this._matchFloorPlanePadded;
    var maxZ = aabb.max.z*scaleXZ + this._matchFloorPlanePadded;
    var minZ = aabb.min.z*scaleXZ - this._matchFloorPlanePadded;

    this.entity.setPosition((maxX + minX)*0.5, groundLevel, (maxZ + minZ)*0.5);

    this.entity.setLocalScale(maxX - minX, 1, maxZ - minZ);
};

MapBuildTest.prototype.setupSVGMap = function() {


    if (this._spawnMapInNode) {
        this.customCSGScene = CollisionBoundNode.create(new Transform3D());
        this._spawnMapInNode.CSGCollisionScene = this.customCSGScene;

        this._spawnMapInNode._SKIP_CONVEX_CHECK = true;
    }

    var preview2D = $('<div style="position:absolute; top:0; left:0"></div>');
    $(document.body).append(preview2D);

    var svgReader = new SVGCityReader();
    this.svgReader = svgReader;


    var p;
    // around 1.12 to 1.17?
    //484.8/430
   // this.globalScale = 500/426.72;

   for (p in MapBuildTest.attributes.index) {
       if (p !== "svg" && p !== "globalScale" && p.charAt(0) !== "_") {
           svgReader[p]= this[p];
       }
   }
    svgReader.roofMethod = this._buildingSlopedRoofs ? SVGCityReader.buildBasicQuadRoofs : SVGCityReader.buildFlatRoofs;
    this.svgReader = svgReader;

    svgReader.parse(this.svg.resource, preview2D[0]);
    var svgUnits500Meters = 0.2802734375 * svgReader.svgWidth;
    var svgUnits1Meter = svgUnits500Meters / 500;
    svgReader.exportScaleXZ =  1/svgUnits1Meter * this.globalScale; //0.2802734375 * svgReader.svgWidth / 500;

    preview2D.detach();

    if (this.entity.model) {
       if (!this._matchFloorPlanePadded) {
            this.entity.setLocalScale(svgReader.exportScaleXZ*svgReader.svgWidth * 0.5, 1, svgReader.exportScaleXZ*svgReader.svgHeight * 0.5);
           this.entity.setPosition(0,svgReader.innerWardAltitude,0);
       } else {
           this.setTransformFromAABB2D(svgReader.aabb2d, svgReader.exportScaleXZ, svgReader.innerWardAltitude);
       }
    }




    // Create 3d from deployables


    var modelEntity = new pc.Entity();
    var model =  new pc.Model();
    this.modelEntity = modelEntity;

     var node = new pc.GraphNode();
    model.graph = node;
    //modelEntity.addChild(node);
    //

    this.miRampBuildings = [];

   var material = new pc.StandardMaterial();
    var deployGeom = svgReader.getNavmeshExtrudedGeometry();
    if (deployGeom.highways) {
        model.meshInstances.push(this.miHighway = this.createMeshInstance(deployGeom.highways, node, material));
    }
    if (deployGeom.wardRoads) {
        model.meshInstances.push(this.miWardRoads = this.createMeshInstance(deployGeom.wardRoads, node, material));
    }
    if (deployGeom.wardRoadsOuter) {
        model.meshInstances.push(this.miWardRoadsOuter = this.createMeshInstance(deployGeom.wardRoadsOuter, node, material));
    }


     if (deployGeom.cityWall) {
        model.meshInstances.push(this.miCityWall = this.createMeshInstance(deployGeom.cityWall, node, material));
    }
    if (deployGeom.cityWallWalk) {
        model.meshInstances.push(this.miCityWallWalk = this.createMeshInstance(deployGeom.cityWallWalk, node, material));
    }

      if (deployGeom.cityWallTowerCeiling) {
        model.meshInstances.push(this.miCityWallTowerCeiling = this.createMeshInstance(deployGeom.cityWallTowerCeiling, node, material));
    }

   if (deployGeom.cityWallTowerWall) {
        model.meshInstances.push(this.miCityWallTowerWall = this.createMeshInstance(deployGeom.cityWallTowerWall, node, material));
    }

    /*
    if (deployGeom.rampedBuildings) {
        deployGeom.rampedBuildings.forEach( function(v) {
            let v = this.createMeshInstance(v, node, material);
            this.miRampBuildings.push(v);
         model.meshInstances.push(v);
        }.bind(this));

    }
    */

    this.wardBuildings = [];
    this.wardRoofs = [];
    var wardCollectors = svgReader.getWardBuildingsGeometry(this._buildingInset);
    var wardRoofCollectors = svgReader.wardRoofCollectors;
    var i;
    var ward;
    var len;

    len = wardCollectors.length;
    for (i=0; i<len ; i++) {
        ward = wardCollectors[i];
        let v = this.createMeshInstance(ward, node, material, true);
        this.wardBuildings.push(v);
        model.meshInstances.push( v );
    }

    if (this.customCSGScene) this.customCSGScene.addChild(this.collisionNodeOf(this._spawnMapInNode.script.collisionScene.getCollidableEntryFromModel(model, null, null, -1)));

    len = wardRoofCollectors.length;
     for (i=0; i<len ; i++) {
        ward = wardRoofCollectors[i];
        let v = this.createMeshInstance(ward, node, material, true);
        this.wardRoofs.push(v);
        model.meshInstances.push( v );
    }

    //CollisionScene.prototype.getCollidableEntryFromModel = function(model, filteredIndexList, asset, alwaysUseBVHTree)


    modelEntity.addComponent("model");
    modelEntity.model.model = model;
    modelEntity.model.isStatic = true;

    (!this._spawnMapInNode ? this.app.root : this._spawnMapInNode).addChild(modelEntity);

   modelEntity.addComponent('collision');
    modelEntity.collision.type = "mesh";
   modelEntity.collision.model = model;

    if (this.entity.model && !this.entity.model.collision) {
          this.entity.addComponent('collision');
      //   this.entity.collision.type = "mesh";

        this.entity.collision.model = this.entity.model;

    }


    this.deployGeom = deployGeom;
    this.wardRoofCollectors = wardRoofCollectors;
    this.wardCollectors = wardCollectors;

};

MapBuildTest.prototype.collisionNodeOf = function(collidable) {
    var node = CollisionBoundNode.create(new Transform3D());
    node.collidable = collidable;
    return node;
};

MapBuildTest.prototype.createMeshInstance = function(data, node, material, culling) {

   var mesh = pc.createMesh(
    this.app.graphicsDevice,
    data.vertices,
    {
        normals: data.normals,
        // uvs: treeUvs,
        indices: data.indices
    });

    var meshInstance =  new pc.MeshInstance(node, mesh, material);
    meshInstance.cull = culling !== undefined ? culling : false;

    return meshInstance;
};

MapBuildTest.prototype.update = function(dt) {
    this.agentRadius = 0.5;
    this.svgReader.agentHeight = 2.25;

    var inset = this.agentRadius;

    var minChamferDist = this.agentRadius / 2;
    if (this.app.keyboard.wasPressed(pc.KEY_0)) {
        SVGCityReader.saveWavefrontObj(this.deployGeom, 'cityframe.obj');
    }   else  if (this.app.keyboard.wasPressed(pc.KEY_9)) {
          SVGCityReader.saveWavefrontObj(this.wardRoofCollectors, 'building-roofs.obj', false);
    } else   if (this.app.keyboard.wasPressed(pc.KEY_8)) {
         SVGCityReader.saveWavefrontObj(this.wardCollectors, 'building-walls.obj', false);
    }  else   if (this.app.keyboard.wasPressed(pc.KEY_5)) {
         SVGCityReader.saveWavefrontObj(this.svgReader.buildBuildingRoofsNavmeshes(inset, minChamferDist, true), 'nav_building-roofs.obj', false);
    }
     else if (this.app.keyboard.wasPressed(pc.KEY_6)) {
         SVGCityReader.saveWavefrontObj(this.svgReader.buildCityWallWalkNavmesh(inset, minChamferDist, true), 'nav_citywall-walk.obj', false);
    } else if (this.app.keyboard.wasPressed(pc.KEY_7)) {

         SVGCityReader.saveWavefrontObj(this.svgReader.buildCityTowerRoofNavmesh(inset, minChamferDist, true), 'nav_tower-roofs.obj', false);
    }
    else if (this.app.keyboard.wasPressed(pc.KEY_1) || this.app.keyboard.wasPressed(pc.KEY_2)) {

         //SVGCityReader.saveWavefrontObj(this.wardCollectors, 'building-walls.obj');
         //  console.log(inset, minChamferDist, this.svgReader.exportScaleXZ);
       // inset /= this.svgReader.exportScaleXZ;
        //minChamferDist /= this.svgReader.exportScaleXZ;
       // this.svgReader.exportScaleXZ = 1;

         var groundNavmeshes = this.svgReader.buildGroundNavmesh(inset, minChamferDist);

            if (this.app.keyboard.wasPressed(pc.KEY_1)) {
                SVGCityReader.saveWavefrontObj(NavMeshUtils.collectPlainNavmeshGeometry(null, groundNavmeshes.floor.regions), 'nav_floor.obj', false);
            } else {
                 SVGCityReader.saveWavefrontObj(NavMeshUtils.collectPlainNavmeshGeometry(null, groundNavmeshes.highways.regions), 'nav_highways.obj', false);
            }
    } else if (this.app.keyboard.wasPressed(pc.KEY_ADD)) {
          this.app.autoRender = false;
          var demo = this.app.root.findByName("CharacterDemo");
        if (demo) demo.enabled = false;

    }
};


// swap method called for script hot-reloading
// inherit your script state here
// MapBuildTest.prototype.swap = function(old) { };

// to learn more about script anatomy, please read:
// http://developer.playcanvas.com/en/user-manual/scripting/