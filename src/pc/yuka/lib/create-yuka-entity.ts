import { AttributeParams } from "../../../../lib/create-script-decorator";

// dependenc injection in initialize may not be ideal for performance? But okay for prototyping and few entities
// PC attributes and YUKA entities will have duplicated copy of values
function constructEntity(cls:any, yeCon: any) {
	let proto = cls.prototype;
	proto.initialize = function() {
		this.yukaEntity = new yeCon();
		// inject attributesData values into yukaEntity // propName
		// got __resolver? call __resolver(this[propName] || this.entity);
		// if (this.$watchAttributes) add property watchers to reset entity?
		this.$entityManager.add(this.yukaEntity);
	}
	// respawn case upon re-enabled?
	// unspawn case upon disabled.
}

function createVehicleEntity(cls:any, yeCon: any) {
	constructEntity(cls, yeCon);
	// add entity manager
	// add attributes
	// add behaviours arrau
}



export function attrib<T>(params: AttributeParams & {inject?: boolean | string}):any {
    return function (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<T>):any {
        if (!target.attributesData) {
            target.attributesData = {};
		}
        target.attributesData[propertyKey] = params;
    }
};