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

Here's how it looks:

```TypeScript
import { types } from 'mobx-state-tree';
import { mst, shim, action } from './classy-mst';

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

The `mst` function binds the two together, and the `TodoCode` class should
not be used directly.

The `shim` function is a tiny wrapper that makes TypeScript accept MST types
as superclasses. You can inherit from other classes wrapped in MST types as
follows:

```TypeScript
const SpecialTodoData = shim(Todo.props({
	count: types.optional(types.number, 0)
}), Todo);

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

License
=======

[The MIT License](https://raw.githubusercontent.com/charto/classy-mst/master/LICENSE)

Copyright (c) 2017 BusFaster Ltd
