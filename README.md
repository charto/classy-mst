classy-mst
==========

[![npm version](https://img.shields.io/npm/v/classy-mst.svg)](https://www.npmjs.com/package/classy-mst)

This package provides an alternative syntax for [mobx-state-tree](https://github.com/mobxjs/mobx-state-tree)
(MST) based on ES6 classes. It preserves types, meaning DRY code with runtime
type information, statically typed in the compiler when using TypeScript.

Inheritance and `super` work as you would expect. The major differences
compared to ordinary ES6 classes are:

- `this instanceof Class` is false inside `Class`, because `this` refers to a MobX state tree node.
- Class properties must be declared using MST type syntax in a separate block before the class.
- MST has no static properties.

Here's how it looks:

```TypeScript
import { types } from 'mobx-state-tree';
import { mst, shim, action } from 'classy-mst';

const TodoData = shim(types.model({

	title: types.string,
	done: false

}))

class TodoCode extends TodoData {

	@action
	toggle() {
		this.done = !this.done;
	}

}

const Todo = mst(TodoCode, TodoData);
```

Afterwards, `Todo` is a regular MST type. Here, `TodoData` is an MST type
holding the properties with MobX state tracking magic, and `TodoCode` is only
a block of code with methods (views and actions) to use with the type.

The `mst` function binds the two together (producing a new type "inheriting"
`TodoData`), and the `TodoCode` class should not be used directly.

The `shim` function is a tiny wrapper that makes TypeScript accept MST types
as superclasses. You can inherit from and extend other classes wrapped in MST
types as follows:

```TypeScript
// Inherit Todo and add new count property.
const SpecialTodoData = shim(

	Todo.props({
		count: types.optional(types.number, 0)
	}),
	// Original MST type containing the wrapped methods,
	// needed for binding references to "super".
	Todo

);

class SpecialTodoCode extends SpecialTodoData {

	@action
	toggle() {
		console.log('Toggled ' + (++this.count) + ' times!');
		super.toggle();
	}

}

const SpecialTodo = mst(SpecialTodoCode, SpecialTodoData);
```

If adding new properties to the superclass, it's important to pass the
unmodified superclass as the second parameter to `shim`, to get its prototype
so that `super` points to a superclass definition with appropriate ES6 methods.

ES6 methods become views (assumed to have no side-effects) unless decorated
with `@action`, which turns them into actions.

You can look at the [tests](https://github.com/charto/classy-mst/blob/master/test/test.ts)
for a fully working example, or run them like this:

```bash
git clone https://github.com/charto/classy-mst.git
cd classy-mst
npm install
npm test
```

Asynchronous actions
--------------------

Asynchronous actions return a promise. The actual method needs to define a
generator, pass it to `process` or `flow` from `mobx-state-tree`, call the
returned function and return its result, like this:

```TypeScript
import { types, process } from 'mobx-state-tree';
import { mst, shim, action } from 'classy-mst';

const AsyncData = shim(types.model({}));

class AsyncCode extends AsyncData {

        @action
        run() {
                function* generate() {
                        yield Promise.resolve('This gets lost');
                        return('Returned value');
                }

                return(process(generate)());
        }

}

const Async = mst(AsyncCode, AsyncData);

Async.create().run().then(
        (result) => console.log(result)
);
```

Recursive types
---------------

Fully typed recursive types require some tricky syntax to avoid these TypeScript compiler errors:

- `error TS2456: Type alias 'Type' circularly references itself.`
- `error TS2502: 'member' is referenced directly or indirectly in its own type annotation.`
- `error TS2506: 'Type' is referenced directly or indirectly in its own base expression.`
- `error TS7022: 'Type' implicitly has type 'any' because it does not have a type annotation and is referenced directly or indirectly in its own initializer.`

Luckily interface types are lazier so they support recursive references. One working trick is then:

```TypeScript
import { IObservableArray } from 'mobx';
import { types, ISnapshottable, IModelType, IComplexType } from 'mobx-state-tree';
import { mst, shim, action, ModelInterface } from 'classy-mst';

export const NodeData = shim(types.model({

	// Non-recursive members go here, for example:
	id: ''

}));

export class NodeCode extends NodeData {

	// Example method. Note how all members are available and fully typed,
	// even if recursively defined.

	getChildIDs() {
		for(let child of this.children || []) {
			if(child.children) child.getChildIDs();
			if(child.id) console.log(child.id);
		}
	}

	// Recursive members go here first.
	children?: Node[];

}

export const NodeBase = mst(NodeCode, NodeData);
export type NodeBase = typeof NodeBase.Type;

// Interface trickery to avoid compiler errors when defining a recursive type.
export interface NodeObservableArray extends IObservableArray<NodeRecursive> {}

export interface NodeRecursive extends NodeBase {

	// Recursive members go here second.
	children: NodeObservableArray

}

export interface NodeArray extends IComplexType<
	(typeof NodeBase.SnapshotType & {

		// Recursive members go here third.
		children: any[]

	})[],
	NodeObservableArray
> {}

export const Node = NodeBase.props({

	// Recursive members go here fourth.
	children: types.maybe(types.array(types.late((): any => Node)) as NodeArray),

});

export type Node = typeof Node.Type;

const tree = Node.create({
	children: [
		{ children: [ { id: 'TEST' } ] }
	]
});

// Both print: TEST
console.log(tree.children![0].children![0].id);
tree.getChildIDs();
```

License
=======

[The MIT License](https://raw.githubusercontent.com/charto/classy-mst/master/LICENSE)

Copyright (c) 2017 BusFaster Ltd
