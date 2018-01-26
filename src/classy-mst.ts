// This file is part of classy-mst, copyright (c) 2017 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import { IModelType, types } from 'mobx-state-tree';

/** Fake complete, generic implementation of IModelType. */

export declare const AbstractModel: new() => IModelType<any, any>;

/** Fake complete, specialized implementation of IModelType.
  * This allows interfaces to include all of its static and dynamic members. */

export declare abstract class ModelClass<S, T> extends AbstractModel implements IModelType<S, T> {}

/** Interface with all IModelType static and dynamic members,
  * callable to construct a specialized instance. */

export interface ModelInterface<S, T> extends IModelType<S, T> {
	new(): ModelClass<S, T> & T;
}

export let typeTag: string | undefined = '$';

export function setTypeTag(tag?: string) {
	typeTag = tag;
}

/** Force TypeScript to accept an MST model as a superclass.
  * @param model Model (MST tree node)
*/

export function shim<S, T>(Model: IModelType<S, T>, Parent?: any): ModelInterface<S, T> {
	function Base() {}

	if(Parent && Parent.$proto) {
		Base.prototype = Parent.$proto;
		Base.prototype = new (Base as any)();
		Base.prototype.$parent = Parent;
		if(Base.prototype.$actions) Base.prototype.$actions = {};
	}

	return(Base as any);
}

/** Decorator for actions. By default the mst function treats methods as views. */

export function action(target: { [key: string]: any }, key: string) {
	(target.$actions || (target.$actions = {}))[key] = target[key];
	target[key] = null;
}

/** Add methods from an ES6 class into an MST model.
  * @param code Class with methods to add as views (the default)
  *   and actions (if decorated).
  * @param data MST model with properties. */

export function mst<S, T, U>(Code: new() => U, Data: IModelType<S, T>, name?: string): IModelType<S, U> {
	function bindMembers(self: any, methodFlag: boolean, defs: { [name: string]: any }) {
		const result: { [name: string]: any } = {};

		for(let name of Object.getOwnPropertyNames(defs)) {
			if(name == 'constructor' || name == '$actions' || name == '$parent') continue;

			const desc = Object.getOwnPropertyDescriptor(defs, name);

			if(!desc || (desc.configurable && desc.enumerable && desc.writable && !desc.get && !desc.set)) {
				const member = (desc && desc.value) || defs[name];

				if((typeof(member) == 'function') != methodFlag) continue;

				if(methodFlag) {
					result[name] = function() {
						return(member.apply(self, arguments));
					}
				} else {
					result[name] = member;
				}
			} else {
				Object.defineProperty(result, name, desc);
			}
		}

		return(result);
	}

	if(name) Data = Data.named(name);

	const Union: any = types.late(() => types.union.apply(types, Union.$typeList));

	let Model = Data.preProcessSnapshot(
		// Instantiating a union of models requires a snapshot.
		(snap: any) => snap || {}
	).views(
		(self) => bindMembers(self, true, Code.prototype)
	).actions(
		(self) => ({
			postProcessSnapshot: (snap: any) => {
				if(name && typeTag && Code.prototype.$parent) snap[typeTag] = name;
				return(snap);
			}
		})
	).actions(
		(self) => bindMembers(self, true, Code.prototype.$actions || [])
	).volatile(
		(self) => bindMembers(self, false, new Code())
	) as any;

	Union.$typeList = [ (snap: any) =>
		(snap && typeTag && snap[typeTag] && Union.$typeTbl[snap[typeTag]]) || Model
	];
	Union.$typeTbl = {};
	Union.$proto = Code.prototype;
	Union.props = function() { return(Model.props.apply(Model, arguments)); };

	let Parent = Union;

	for(let Parent = Union; Parent; Parent = Parent.$proto.$parent) {
		const typeList = Parent.$typeList;
		const typeTbl = Parent.$typeTbl;

		if(typeList) typeList.push(Model);
		if(typeTbl && name) typeTbl[name] = Model;
	}

	return(Union);
}
