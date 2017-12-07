classy-mst
==========

[![npm version](https://img.shields.io/npm/v/classy-mst.svg)](https://www.npmjs.com/package/classy-mst)

`classy-mst` is the ultimate state management solution for TypeScript and
JavaScript apps: a zero performance penalty wrapper around the amazing
[mobx-state-tree](https://github.com/mobxjs/mobx-state-tree) and allowing
standard ES6 syntax.

ES6 class methods become "views" or "actions" (when decorated with `@action`
to indicate they have side effects). Then:

- Changes automatically propagate through views.
- State is protected from modification outside actions.
- State and state diffs (patches) are serializable to JSON and replayable for undo / redo.
- Redux DevTools are supported for working with the state.
  - The underlying technology is still [MobX](https://mobx.js.org/).

[mobx-state-tree](https://github.com/mobxjs/mobx-state-tree) provides the
state management, `classy-mst` adds the benefits of standard ES6 syntax:

- Less boilerplate.
- `this`, `super` and inheritance work as you would expect.
- No lock-in, easier to switch to other technology if needed.

Usage
-----

Install:

```bash
npm install --save mobx mobx-state-tree classy-mst
```

Use in your code:

```TypeScript
import { types } from 'mobx-state-tree';
import { mst, shim, action } from 'classy-mst';

const TodoData = types.model({

	title: types.string,
	done: false

});

class TodoCode extends shim(TodoData) {

	@action
	toggle() {
		this.done = !this.done;
	}

}

const Todo = mst(TodoCode, TodoData);
```

ES6 methods become views (assumed to have no side-effects) unless decorated
with `@action`, which turns them into actions.

Afterwards, `Todo` is a regular MST type. Here, `TodoData` is an MST type
holding the properties with MobX state tracking magic, and `TodoCode` is only
a block of code with methods (views and actions) to use with the type.

The `mst` function binds the two together (producing a new type "inheriting"
`TodoData`), and the `TodoCode` class should not be used directly.

The `shim` function is a tiny wrapper that makes TypeScript accept MST types
as superclasses.

The major differences compared to ordinary ES6 classes are:

- `this instanceof Class` is false inside `Class`, because `this` refers to a MobX state tree node.
- Class properties must be declared using MST type syntax in a separate block before the class.
- MST has no static properties.

You can look at the [tests](https://github.com/charto/classy-mst/blob/master/test/test.ts)
for fully working examples, or run them like this:

```bash
git clone https://github.com/charto/classy-mst.git
cd classy-mst
npm install
npm test
```

Inheritance
-----------

You can inherit from and extend other classes wrapped in MST types as follows:

```TypeScript
// Inherit Todo and add new count property.

const SpecialTodoData = Todo.props({
	count: 0
});

// Original MST type "Todo" containing the wrapped methods
// is needed by shim for binding references to "super".

class SpecialTodoCode extends shim(SpecialTodoData, Todo) {

	@action
	toggle() {
		console.log('Toggled ' + (++this.count) + ' times!');
		super.toggle();
	}

}

const SpecialTodo = mst(SpecialTodoCode, SpecialTodoData);
```

If adding new properties to the superclass, it's important to pass the
unmodified superclass as the second parameter to `shim` so that
`super` is initialized correctly.

Volatile state
--------------

You can create a model with volatile state directly using `mobx-state-tree` syntax:

```TypeScript
const VolatileData = types.model({}).volatile(
	(self) => ({ a: 1 })
);
```

Alternatively, for most types of volatile members (not functions, however)
you can define and initialize them inside the ES6 class:

```TypeScript
class VolatileCode extends shim(VolatileData) {

	b = 2;

}
```

Asynchronous actions
--------------------

Asynchronous actions return a promise. The actual method needs to define a
generator, pass it to `flow` from `mobx-state-tree`, call the returned
function and return its result, like this:

```TypeScript
import { types, process } from 'mobx-state-tree';
import { mst, shim, action } from 'classy-mst';

const AsyncData = types.model({});

class AsyncCode extends shim(AsyncData) {

	@action
	run() {
		function* generate() {
			yield Promise.resolve('This gets lost');
			return('Returned value');
		}

		return(flow(generate)());
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

Luckily interface types are lazier so they support recursive references.
First we can define the type with nice syntax, exactly as it should ideally work:

```TypeScript
import { IObservableArray } from 'mobx';
import { types, ISnapshottable, IModelType, IComplexType } from 'mobx-state-tree';
import { mst, shim, action, ModelInterface } from 'classy-mst';

export const NodeData = types.model({

	// Non-recursive members go here, for example:
	id: ''

});

export class NodeCode extends shim(NodeData) {

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
```

Then we need unfortunate boilerplate to make the compiler happy:

```TypeScript
export const NodeBase = mst(NodeCode, NodeData);
export type NodeBase = typeof NodeBase.Type;

// Interface trickery to avoid compiler errors when defining a recursive type.
export interface NodeObservableArray extends IObservableArray<NodeRecursive> {}

export interface NodeRecursive extends NodeBase {

	// Recursive members go here second.
	children: NodeObservableArray

}

export type NodeArray = IComplexType<
	(typeof NodeBase.SnapshotType & {

		// Recursive members go here third.
		children: any[]

	})[],
	NodeObservableArray
>;

export const Node = NodeBase.props({

	// Recursive members go here fourth.
	children: types.maybe(types.array(types.late((): any => Node)) as NodeArray),

});

export type Node = typeof Node.Type;
```

Finally, the new type can be used like this:

```TypeScript
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
