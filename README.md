classy-mst
==========

[![build status](https://travis-ci.org/charto/classy-mst.svg?branch=master)](http://travis-ci.org/charto/classy-mst)
[![npm version](https://img.shields.io/npm/v/classy-mst.svg)](https://www.npmjs.com/package/classy-mst)

`classy-mst` is the ultimate state management solution for TypeScript and JavaScript apps: a light wrapper around the amazing
[mobx-state-tree](https://github.com/mobxjs/mobx-state-tree) to allow standard ES6 syntax.

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

**Note**: Old versions 1.x work with mobx-state-tree 2.x.
Now the major versions are kept in sync.

Contents
========

- [Usage](#usage)
- [Inheritance](#inheritance)
- [Polymorphism](#polymorphism)
- [Getters and setters](#getters-and-setters)
- [Volatile state](#volatile-state)
- [Asynchronous actions](#asynchronous-actions)
- [Recursive types](#recursive-types)
- [License](#license)

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

const Todo = mst(TodoCode, TodoData, 'Todo');
```

ES6 methods become views (assumed to have no side-effects) unless decorated
with `@action`, which turns them into actions.

Afterwards, `Todo` is a regular MST type. Here, `TodoData` is an MST type
holding the properties with MobX state tracking magic, and `TodoCode` is only
a block of code with methods (views and actions) to use with the type.

The `mst` function binds the two together (producing a new type "inheriting"
`TodoData`), and the `TodoCode` class should not be used directly.
A third, optional parameter gives the resulting model a name.
Names are required for polymorphism to work correctly, when serializing
models to JSON containing fields with types that have further subclasses.

The `shim` function is a tiny wrapper that makes TypeScript accept MST types
as superclasses. It must be used in the `extends` clause of the ES6 class
defining the views and actions.

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

const SpecialTodo = mst(SpecialTodoCode, SpecialTodoData, 'SpecialTodo');
```

If adding new properties to the superclass, it's important to pass the
unmodified superclass as the second parameter to `shim` so that
`super` is initialized correctly.

Polymorphism
------------

Instances of subclasses can be used in place of their parent classes inside models.
Due to `mobx-state-tree` implementation internals, both classes must have been defined
before the first parent class instance has been created anywhere in the program.

Snapshots containing polymorphic types require type names in the serialized JSON,
to identify the correct subclass when applying the snapshot.
A special key `$` is automatically added in snapshots when an object in the tree
belongs to a subclass of the class actually specified in the model.

The default key `$` for types can be changed by passing a different string to the
`setTypeTag` function before creating any model instances. For example:

```TypeScript
import { getSnapshot } from 'mobx-state-tree';
import { setTypeTag } from 'classy-mst';

setTypeTag('type');

const Store = types.model({
	todos: types.array(Todo)
});

const store = Store.create({
	todos: [
		SpecialTodo.create({ title: 'Baz' })
	]
});

console.log(getSnapshot(store));
```

The above prints:

```
{ todos: [ { title: 'Baz', done: false, count: 0, type: 'SpecialTodo' } ] }
```

Getters and setters
-------------------

Class members with getters become MobX computed properties.
Setters are not considered actions themselves, so they're only allowed to
modify internal state by calling other methods decorated with `@action`.

For example:

```TypeScript
class TodoCode extends shim(TodoData) {

        @action
        toggle() {
                this.done = !this.done;
        }

        get pending() {
                return(!this.done);
        }

        set pending(flag: boolean) {
                if(this.done == flag) this.toggle();
        }

}
```

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

Note that the member must be initialized, or it gets compiled away and `classy-mst`
never sees it.

Asynchronous actions
--------------------

Asynchronous actions return a promise. The actual method needs to define a
generator, pass it to `flow` from `mobx-state-tree`, call the returned
function and return its result, like this:

```TypeScript
import { types, flow } from 'mobx-state-tree';
import { mst, shim, asyncAction } from 'classy-mst';

const AsyncData = types.model({ text: '' });

class AsyncCode extends shim(AsyncData) {

	@asyncAction
	*run() {
		const data = yield Promise.resolve('Fetched value');
		this.text = data;
		return data;
	}
}

const Async = mst(AsyncCode, AsyncData);

const run = async() => {
	const result = await Async.create().run();
	console.log(result);
};
run();
```

Recursive types
---------------

Fully typed recursive types require some tricky syntax to avoid these TypeScript compiler errors:

- `error TS2456: Type alias 'Type' circularly references itself.`
- `error TS2502: 'member' is referenced directly or indirectly in its own type annotation.`
- `error TS2506: 'Type' is referenced directly or indirectly in its own base expression.`
- `error TS7022: 'Type' implicitly has type 'any' because it does not have a type annotation and is referenced directly or indirectly in its own initializer.`

If your model has a `children` property containing an array of the same model
as their parent, the easiest solution is to add the `children` property only
in the ES6 class and use `mstWithChildren` instead of `mst` when defining the
model. It handles adding the property to the `mobx-state-tree` type.

The function `mstWithChildren` returns an object with the members:

- `Model`, the model with views, actions and a `children` property attached.
- `Children`, the correct `mobx-state-tree` type for the `children` property.

You should call it just after your class defining the views and actions
(replacing Todo with your own class name) like this:

```TypeScript
const { Model: Todo, Children } = mstWithChildren(TodoCode, TodoData, 'Todo');
```

You can use the `Children` type inside the class methods thanks to declaration
hoisting. Without the type, it's difficult to initialize an unset `children`
property correctly.

The `children` property should be declared in your class as
`(this | <class name>)[]` to allow further inheritance, like this:

```TypeScript
import { IObservableArray } from 'mobx';
import { types, isStateTreeNode, ISnapshottable, IModelType, IComplexType } from 'mobx-state-tree';
import { mst, mstWithChildren, shim, action, ModelInterface } from 'classy-mst';

export const NodeData = T.model({ value: 42 });
export class NodeCode extends shim(NodeData) {

	@action
	addChild(child: Node | typeof Node.SnapshotType) {
		if(!this.children) this.children = Children.create();
		this.children.push(isStateTreeNode(child) ? child : Node.create(child));

		return(this);
	}

	children?: (this | NodeCode)[];
}

const { Model: Node, Children } = mstWithChildren(NodeCode, NodeData, 'Node');
export type Node = typeof Node.Type;
```

If you want to use some other name than `children` for the property, easiest is
to copy, paste and customize the `mstWithChildren` function from
[classy-mst.ts](https://github.com/charto/classy-mst/blob/master/src/classy-mst.ts).
Without macro support in the TypeScript compiler, the name cannot be
parameterized while keeping the code fully typed.

License
=======

[The MIT License](https://raw.githubusercontent.com/charto/classy-mst/master/LICENSE)

Copyright (c) 2017-2018 BusFaster Ltd
