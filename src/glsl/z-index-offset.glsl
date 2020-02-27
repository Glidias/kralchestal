mat4 getModelMatrix() {
        #ifdef DYNAMICBATCH
            return getBoneMatrix(vertex_boneIndices);
        #elif defined(SKIN)
            return matrix_model * (getBoneMatrix(vertex_boneIndices.x) * vertex_boneWeights.x +
                   getBoneMatrix(vertex_boneIndices.y) * vertex_boneWeights.y +
                   getBoneMatrix(vertex_boneIndices.z) * vertex_boneWeights.z +
                   getBoneMatrix(vertex_boneIndices.w) * vertex_boneWeights.w);
        #elif defined(INSTANCING)
            return mat4(instance_line1, instance_line2, instance_line3, instance_line4);
        #else
            return matrix_model;
        #endif
    }

    uniform vec4 zNearVals;

    vec4 getPosition() {
        dModelMatrix = getModelMatrix();
        vec3 localPos = vertex_position;

        vec4 pos = dModelMatrix * vec4(localPos, 1.0);
        dPositionW = pos.xyz;
        vec4 screenPos = matrix_viewProjection * pos;
        screenPos.z -= zNearVals.y * (zNearVals.x+zNearVals.z/pos.z) * zNearVals.w;
        return screenPos;
    }

    vec3 getWorldPosition() {
        return dPositionW;
    }