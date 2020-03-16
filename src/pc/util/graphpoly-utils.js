// @ts-check
import { Graph } from "../../../yuka/src/graph/core/Graph";
import { Edge } from "../../../yuka/src/graph/core/Edge";
import { Vector3 } from "../../../yuka/src/math/Vector3";

class ShortestPathTree {
    constructor() {

        /**
         * @type {Map<number, Edge>}
         */
        this.map = new Map();

        /**
         * @type {(index:number, edge:Edge)=>boolean}
         */
        this.setCallback = null;
    }

    /**
     * 
     * @param {number} index 
     */
    has(index) {
        return this.map.has(index);
    }

    /**
     * 
     * @param {number} index 
     */
    get(index) {
        this.map.get(index);
    }

    clear() {
        this.map.clear();
    }


    values() {
        return this.map.values();
    }


    /**
     * 
     * @param {number} index 
     * @param {Edge} edge 
     */
    set(index, edge) {
        //this.map.set(index, edge);
        //if (this.setCallback !== null) this.setCallback(index, edge);
        if (this.setCallback === null || this.setCallback(index,edge)) this.map.set(index, edge);
    }
}

/**
 * A stateful/contextual extended graph class to hook into existing Yuka classes to minimise code duplication/direct modification
 */
class GraphPlus extends Graph {
    constructor() {
        super();
        this.callbackGotEdges = null;
    }

    /**
     * 
     * @param {number} index 
     * @param {Edge[]} outgoingEdges 
     * @return  {Edge[]}
     */
    getEdgesOfNode(index, outgoingEdges) {
        if (this.callbackGotEdges !== null ) {
            return this.callbackGotEdges(index, outgoingEdges);
        }
        return super.getEdgesOfNode(index, outgoingEdges);
    }
}

/**
 * Stateful nav edge with recorded point from edge
 */
class NavPtEdge extends Edge {

    /**
     * 
     * @param {number} from 
     * @param {number} to 
     * @param {Vector3} pointOnEdge 
     * @param {Vector3} fromPoint
     */
    constructor(from, to, pointOnEdge, fromPoint) {
        let dx = pointOnEdge.x - fromPoint.x;
        let dy = pointOnEdge.y - fromPoint.y;
        let dz = pointOnEdge.z - fromPoint.z;
        super(from, to,  Math.sqrt(dx*dx + dy*dy + dz*dz));  

        this.pt = new Vector3(pointOnEdge.x, pointOnEdge.y, pointOnEdge.z);
    }
}

export {ShortestPathTree, GraphPlus, NavPtEdge}


