// This file is part of classy-mst, copyright (c) 2017 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import { IModelType } from 'mobx-state-tree';

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

/** Force TypeScript to accept an MST model as a superclass.
  * @param model Model (MST tree node)
*/

export function shim<S, T>(Model: IModelType<S, T>, Parent?: any): ModelInterface<S, T> {
	function Base() {}

	if(Parent && Parent.prototype) {
		Base.prototype = Parent.prototype;
		Base.prototype = new (Base as any)();
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

export function mst<S, T, U>(Code: new() => U, Data: IModelType<S, T>): IModelType<S, U> {
	function bindMembers(self: any, methodFlag: boolean, defs: { [name: string]: any }) {
		const result: { [name: string]: any } = {};

		for(let name of Object.getOwnPropertyNames(defs)) {
			const member = defs[name];

			if(name == 'constructor' || name == '$actions') continue;
			if((typeof(member) == 'function') != methodFlag) continue;

			if(methodFlag) {
				result[name] = function() {
					return(member.apply(self, arguments));
				}
			} else result[name] = member;
		}

		return(result);
	}

	const Model = Data.views(
		(self) => bindMembers(self, true, Code.prototype)
	).actions(
		(self) => bindMembers(self, true, Code.prototype.$actions || [])
	).volatile(
		(self) => bindMembers(self, false, new Code())
	) as any;

	Model.prototype = Code.prototype;

	return(Model);
}
