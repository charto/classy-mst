// This file is part of classy-mst, copyright (c) 2017-2018 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import { IType, IModelType, IStateTreeNode, types } from 'mobx-state-tree';

/** Fake complete, generic implementation of IModelType. */

export declare const AbstractModel: new() => IStateTreeNode & IModelType<any, any>;

/** Fake complete, specialized implementation of IModelType.
  * This allows interfaces to include all of its static and dynamic members. */

export declare abstract class ModelClass<S, T> extends AbstractModel implements IStateTreeNode, IModelType<S, T> {}

/** Interface with all IModelType static and dynamic members,
  * callable to construct a specialized instance. */

export interface ModelInterface<S, T> {
	new(): ModelClass<S, T> & T;
}

export let typeTag: string | undefined = '$';

export function setTypeTag(tag?: string) {
	typeTag = tag;
}

function BaseClass() {}

/** Force TypeScript to accept an MST model as a superclass.
  * @param model Model (MST tree node) */

export function shim<S, T>(Model: IModelType<S, T>, Parent?: any): ModelInterface<S, T> {
	if(Parent && Parent.$proto) {
		BaseClass.prototype = Parent.$proto;
		BaseClass.prototype = new (BaseClass as any)();
		BaseClass.prototype.$parent = Parent;
		if(BaseClass.prototype.$actions) BaseClass.prototype.$actions = {};
	} else {
		BaseClass.prototype = {};
	}

	return(BaseClass as any);
}

/** Decorator for actions. By default the mst function treats methods as views. */

export function action(target: { [key: string]: any }, key: string) {
	(target.$actions || (target.$actions = {}))[key] = true;
}

interface MemberSpec<MemberType> {
	name: string;
	value: MemberType;
}

interface ClassyUnion extends IModelType<any, any> {
	$proto: any;
	$typeList: (IModelType<any, any> | ((snap: any) => IModelType<any, any>))[];
	$typeTbl: { [name: string]: IModelType<any, any> };
}

/** Add methods from an ES6 class into an MST model.
  * @param code Class with methods to add as views (the default)
  *   and actions (if decorated).
  * @param data MST model with properties. */

export function mst<S, T, U>(Code: new() => U, Data: IModelType<S, T>, name?: string): IModelType<S, U> {
	const viewList: MemberSpec<Function>[] = [];
	const actionList: MemberSpec<Function>[] = [];
	const descList: MemberSpec<PropertyDescriptor>[] = [];

	const memberTbl = Code.prototype;
	const actionTbl = memberTbl.$actions;
	const volatileTbl: { [name: string]: any } = {};

	// Extract views, actions, getters and setters from the class prototype.

	for(let name of Object.getOwnPropertyNames(memberTbl)) {
		if(name == 'constructor' || name == '$actions' || name == '$parent') continue;

		const desc = Object.getOwnPropertyDescriptor && Object.getOwnPropertyDescriptor(memberTbl, name);

		if(!desc || (desc.configurable && desc.writable && !desc.get && !desc.set)) {
			const value = memberTbl[name];
			const spec: MemberSpec<any> = { name, value };

			if(actionTbl && actionTbl[name]) actionList.push(spec);
			else viewList.push(spec);
		} else {
			descList.push({ name, value: desc });
		}
	}

	// Create a sample instance and extract volatile members
	// defined in the constructor.

	const instance: { [name: string]: any } = new Code();

	for(let name of Object.getOwnPropertyNames(instance)) {
		volatileTbl[name] = instance[name];
	}

	// Apply optional name given to the model.

	if(name) Data = Data.named(name);

	// Bind views, actions and volatile state to the model.

	let Model = Data.preProcessSnapshot(
		// Instantiating a union of models requires a snapshot.
		(snap: any) => snap || {}
	).views((self) => {
		const result: { [name: string]: Function } = {};

		for(let { name, value } of viewList) {
			result[name] = function() {
				return(value.apply(self, arguments));
			}
		}

		for(let { name, value } of descList) {
			const { get, set } = value;

			if(get) value.get = () => get.call(self);
			if(set) value.set = (value: any) => set.call(self, value);

			Object.defineProperty(result, name, value);
		}

		return(result);
	}).actions((self) => {
		const result: { [name: string]: Function } = {
			postProcessSnapshot: (snap: any) => {
				if(name && typeTag && Code.prototype.$parent) snap[typeTag] = name;
				return(snap);
			}
		};

		for(let { name, value } of actionList) {
			result[name] = function() {
				return(value.apply(self, arguments));
			}
		}

		return(result);
	}).volatile((self) => volatileTbl);

	// Union of this class and all of its subclasses.
	// Late evaluation allows subclasses to add themselves to the type list
	// before any instances are created.
	const Union: ClassyUnion = types.late(() => types.union.apply(types, Union.$typeList)) as any;

	// First item in the type list is a dispatcher function
	// for parsing type tags in snapshots.
	Union.$typeList = [ (snap: any) =>
		(snap && typeTag && snap[typeTag] && Union.$typeTbl[snap[typeTag]]) || Model
	];

	Union.$typeTbl = {};
	Union.$proto = Code.prototype;

	// Copy methods from model object into returned union,
	// making it work like a regular model.

	for(let mixin: { [key: string]: any } = Model; mixin; mixin = Object.getPrototypeOf(mixin)) {
		for(let key of Object.getOwnPropertyNames(mixin)) {
			const desc = Object.getOwnPropertyDescriptor && Object.getOwnPropertyDescriptor(mixin, key);

			if(!desc || (desc.configurable && desc.writable && !desc.get && !desc.set)) {
				const value = !(key in Union) && mixin[key];

				if(typeof(value) == 'function') {
					(Union as { [key: string]: any })[key] = function() {
						return(value.apply(Model, arguments));
					};
				}
			}
		}
	}

	// Initialize union of allowed class substitutes with the class itself,
	// and augment unions of all parent classes with this subclass,
	// to allow polymorphism.

	for(let Class = Union; Class; Class = Class.$proto.$parent) {
		const typeList = Class.$typeList;
		const typeTbl = Class.$typeTbl;

		if(typeList) typeList.push(Model);
		if(typeTbl && name) typeTbl[name] = Model;
	}

	return(Union);
}
