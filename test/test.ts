import { IObservableArray } from 'mobx';
import { types, flow, onSnapshot, ISnapshottable, IModelType, IComplexType } from 'mobx-state-tree';
import { mst, shim, action, setTypeTag, ModelInterface } from '..';

const TodoData = types.model({
	title: types.string,
	done: false
});

class TodoCode extends shim(TodoData) {

	@action
	toggle() {
		this.done = !this.done;
	}

	@action
	print() {
		console.log(this.done);
	}

	get pending() {
		return(!this.done);
	}

	set pending(flag: boolean) {
		if(this.done == flag) this.toggle();
	}

}

const Todo = mst(TodoCode, TodoData, 'Todo');

const SpecialTodoData = Todo.props({
	count: 0
});

class SpecialTodoCode extends shim(SpecialTodoData, Todo) {

	@action
	toggle(increment = 1) {
		this.count += increment;
		console.log('Toggled ' + this.title + ' ' + this.count + ' times!');
		super.toggle();
	}

}

const SpecialTodo = mst(SpecialTodoCode, SpecialTodoData, 'SpecialTodo');
type SpecialTodoType = typeof SpecialTodo.Type;
interface SpecialTodo extends SpecialTodoType {}

const Store = types.model({
	todos: types.array(Todo)
});

setTypeTag('type');

const store = Store.create({
	todos: [
		{ title: 'Foo' },
		Todo.create({ title: 'Bar', type: 'SpecialTodo' } as any)
	]
});

onSnapshot(store, (snapshot) => {
	console.log('SNAPSHOT');
	console.log(snapshot)
})

const todo = store.todos[1] as SpecialTodo;

store.todos[0].toggle();
store.todos[1].toggle();
todo.toggle(99);

store.todos[0].print();
store.todos[1].print();

console.log(todo.pending);
todo.toggle();
console.log(todo.pending);
todo.pending = true;
console.log(todo.pending);

const VolatileData = types.model(
	{}
).volatile(
	(self) => ({ a: 1 })
);

class VolatileCode extends shim(VolatileData) {

	test() { return(this.a + this.b); }

	b = 2;

}

const Volatile = mst(VolatileCode, VolatileData);

// Prints: 3
console.log(Volatile.create().test());

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

const tree = Node.create({
	children: [
		{ children: [ { id: 'TEST' } ] }
	]
});

// Both print: TEST
console.log(tree.children![0].children![0].id);
tree.getChildIDs();
