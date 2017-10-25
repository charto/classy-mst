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

License
=======

[The MIT License](https://raw.githubusercontent.com/charto/classy-mst/master/LICENSE)

Copyright (c) 2017 BusFaster Ltd
