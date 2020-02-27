import zIndexOffsetFragCode from '../../glsl/z-index-offset.glsl';

var BuildMaterials = pc.createScript('buildMaterials');
BuildMaterials.attributes.add("zIndexCameraEntity", {type:"entity"});
BuildMaterials.attributes.add("zIndexOffset", {type:"number", min:0, default:0.0001});
BuildMaterials.attributes.add("zIndexRequiredThreshold", {type:"number", min:0, default:0});
BuildMaterials.attributes.add("enableStaticBatching", {type:"boolean", default:true});

BuildMaterials.attributes.add("highways", {type:"asset", assetType:"material"});
BuildMaterials.attributes.add("wardRoads", {type:"asset", assetType:"material"});
BuildMaterials.attributes.add("wardRoadsOuter", {type:"asset", assetType:"material"});
BuildMaterials.attributes.add("cityWall", {type:"asset", assetType:"material"});
BuildMaterials.attributes.add("cityWallWalk", {type:"asset", assetType:"material"});
BuildMaterials.attributes.add("cityWallTowerCeiling", {type:"asset", assetType:"material"});
BuildMaterials.attributes.add("cityWallTowerWall", {type:"asset", assetType:"material"});
BuildMaterials.attributes.add("rampedBuildings", {type:"asset", assetType:"material"});
BuildMaterials.attributes.add("wardBuildingWalls", {type:"asset", assetType:"material"});
BuildMaterials.attributes.add("wardBuildingRoofs", {type:"asset", assetType:"material"});

BuildMaterials.attributes.add("neighborhoodHulls", {type:"asset", assetType:"material"});


BuildMaterials.prototype.postInitialize = function() {

    var gotZIndexOffset = this.zIndexCameraEntity && this.zIndexOffset;
    if (gotZIndexOffset) {
        var arr = new Float32Array(4);
        // z = m14/(m14/z + 1/N)
        // https://www.sjbaker.org/steve/omniv/love_your_z_buffer.html
        var farClipping = this.zIndexCameraEntity.camera.farClip;
        var nearClipping = this.zIndexCameraEntity.camera.nearClip;
            //-nearClipping *
        var m14 = ( this.zIndexCameraEntity.camera.projection !== pc.PROJECTION_ORTHOGRAPHIC ?
                                    farClipping / (farClipping - nearClipping) :
                                    1 / (farClipping - nearClipping)
                              );
        arr[0] = m14;
        arr[1] = 1/(1 << 16);
        arr[2] = farClipping * nearClipping / (nearClipping - farClipping);
        arr[3] = this.zIndexOffset;
            //this.zIndexOffset;
        this.zNearVals = arr;

    }
    else {
        this.zNearVals = null;
    }

    if (this.entity.script.mapBuildTest) {
        this.setupMaterials(this.entity.script.mapBuildTest);
        if (this.enableStaticBatching) this.setupStaticBatch(this.entity.script.mapBuildTest.modelEntity);
    }

};

BuildMaterials.prototype.setupStaticBatch = function(entity) {
    var model = entity.model;
    var maxAABBSize = 9999999999999;
    var meshInstancesList = this.app.batcher.prepare(model.model.meshInstances, false, maxAABBSize);
    //this.app.batcher.addGroup("buildMaterialsBatchGroup", false, maxAABBSize )
   var i;
   var batchMeshInstances = [];
     for (i=0; i<meshInstancesList.length; i++) {
          var batch = this.app.batcher.create(meshInstancesList[i], false );

         batchMeshInstances.push(batch.meshInstance);
     }


     var layers = entity.model.layers;
    entity.model.removeModelFromLayers(entity.model.model);

    for (i=0; i<layers.length; i++) {
        this.app.scene.layers.getLayerById(layers[i]).addMeshInstances(batchMeshInstances);
    }

};

BuildMaterials.prototype.cloneZNearVals = function(offset) {
    var val = this.zNearVals.slice(0);
    val[3] = offset;
    return val;
};

BuildMaterials.prototype.setupMaterials = function(target) {

      var lowestAltitude = target.innerWardAltitude;
    var checkAlt =this.zIndexRequiredThreshold * this.zIndexRequiredThreshold;
    var checkVal;
    var countZ = 1;
    var mat;
      if (target.miHighway && this.highways) {
          mat = this.highways.resource;
          checkVal = target.highwayAltitude - lowestAltitude;
           checkVal *= checkVal;
           if (this.zNearVals && checkVal <= checkAlt) {
               mat = this.highways.resource.clone();
               mat.chunks.transformVS = this.getZIndexShaderCode();
               mat.setParameter("zNearVals", this.cloneZNearVals(this.zIndexOffset*countZ++));
             }


           target.miHighway.material = mat;

      }
     if (target.miWardRoads && this.wardRoads) {
          mat = this.wardRoads.resource;
         checkVal = target.wardRoadAltitude - lowestAltitude;
         checkVal *= checkVal;
       //  if (this.zNearVals && checkVal <= checkAlt) {

             mat= this.wardRoads.resource.clone();
             mat.chunks.transformVS = this.getZIndexShaderCode();
             mat.setParameter("zNearVals", this.cloneZNearVals(this.zIndexOffset*countZ++));

        // }

          target.miWardRoads.material = mat;

      }

     if (target.miWardRoadsOuter && this.wardRoadsOuter) {
          mat = this.wardRoadsOuter.resource;
         checkVal = target.outerRoadAltitude - lowestAltitude;
         checkVal *= checkVal;
         if (this.zNearVals && checkVal <= checkAlt) {

             mat= this.wardRoadsOuter.resource.clone();
             mat.chunks.transformVS = this.getZIndexShaderCode();
             mat.setParameter("zNearVals", this.cloneZNearVals(this.zIndexOffset*countZ++));

         }

          target.miWardRoadsOuter.material = mat;

      }

     if (target.miCityWall && this.cityWall) {
          mat = this.cityWall.resource;
          target.miCityWall.material = mat;
      }

     if (target.miCityWallWalk && this.cityWallWalk) {
          mat = this.cityWallWalk.resource;
          target.miCityWallWalk.material = mat;
      }

     if (target.miCityWallTowerCeiling && this.cityWallTowerCeiling) {
          mat = this.cityWallTowerCeiling.resource;
          target.miCityWallTowerCeiling.material = mat;
      }
     if (target.miCityWallTowerWall && this.cityWallTowerWall) {
          mat = this.cityWallTowerWall.resource;
          target.miCityWallTowerWall.material = mat;
      }
    if (target.miRampBuildings && this.rampedBuildings) {
        mat = this.rampedBuildings.resource;
        this.applyMaterialToInstances(mat, target.miRampBuildings);

      }

     if (target.wardRoofs && this.wardBuildingRoofs) {
         mat = this.wardBuildingRoofs.resource;
          this.applyMaterialToInstances(mat, target.wardRoofs);
      }

    if (target.wardBuildings && this.wardBuildingWalls) {
         mat = this.wardBuildingWalls.resource;
          this.applyMaterialToInstances(mat, target.wardBuildings);
      }

    if ( this.neighborhoodHulls) { // special to link
        var hullsGeom = target.svgReader.getNeighborhoodHullsGeometry();

        var meshI;


    //this.neighborhoodHulls.visible = false;
        //target.neighborhoodHulls.cull = false;

          mat = this.neighborhoodHulls.resource.clone();
         mat.chunks.transformVS = this.getZIndexShaderCode();
         mat.setParameter("zNearVals", this.cloneZNearVals(this.zIndexOffset*countZ++));
        
        target.modelEntity.model.model.meshInstances.push(meshI=  target.createMeshInstance(hullsGeom, target.modelEntity.model.model.graph, mat));

        if (!this.enableStaticBatching) {
        var i;
         var layers = this.entity.model.layers;

            for (i=0; i<layers.length; i++) {
                this.app.scene.layers.getLayerById(layers[i]).addMeshInstances([meshI]);
            }
        }

    }
};

BuildMaterials.prototype.applyMaterialToInstances = function(material, arr) {
  var len =arr.length;
    var i;
    for (i=0; i<len; i++) {
        arr[i].material = material;
    }
};


BuildMaterials.prototype.getZIndexShaderCode = function() {
    return zIndexOffsetFragCode;

};