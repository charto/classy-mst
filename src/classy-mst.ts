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
	new(): ModelClass<S, T> & T
}

/** Force TypeScript to accept an MST model as a superclass.
  * @param model Model (MST tree node)
*/

export function shim<S, T>(model: IModelType<S, T>, parent?: any): ModelInterface<S, T> {
	if(parent && parent.prototype) (model as any).prototype = parent.prototype;
	return(model as any);
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

export function mst<S, T, U>(code: new() => U, data: IModelType<S, T>): IModelType<S, U> {
	function bindMethods(self: any, defs: { [name: string]: any }) {
		const result: { [name: string]: any } = {};

		for(let name of Object.keys(defs)) {
			const method = defs[name];
			if(method && name != 'constructor' && name != '$actions') {
				result[name] = function() {
					return(method.apply(self, arguments));
				}
			}
		}

		return(result);
	}

	const model = data.views(
		(self) => bindMethods(self, code.prototype)
	).actions(
		(self) => bindMethods(self, code.prototype.$actions || [])
	) as any;

	model.prototype = code.prototype;

	return(model);
}
