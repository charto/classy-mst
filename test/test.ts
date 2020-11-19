import { IObservableArray } from 'mobx';
import { types, isStateTreeNode, flow, onSnapshot, IModelType, IComplexType } from 'mobx-state-tree';
import { mst, mstWithChildren, shim, action, setTypeTag, ModelInterface, asyncAction } from '..';

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


export const NodeData = types.model({

	// Non-recursive members go here, for example:
	id: ''

});

export class NodeCode extends shim(NodeData) {

	@action
	addChild(child: Node | typeof Node.SnapshotType) {
		const children = this.children || (this.children = Children.create());
		children.push(isStateTreeNode(child) ? child : Node.create(child));

		return(this);
	}

	// Example method. Note how all members are available and fully typed,
	// even if recursively defined.

	getChildIDs() {
		for(let child of this.children || []) {
			if(child.children) child.getChildIDs();
			if(child.id) console.log(child.id);
		}
	}

	// Recursive members go here first.
	children?: (this | NodeCode)[];

}

export const { Model: Node, Children } = mstWithChildren(NodeCode, NodeData, 'Todo');

export type Node = typeof Node.Type;

const tree = Node.create({
	children: [
		{ children: [ { id: 'TEST' } ] }
	]
});

// Both print: TEST
console.log(tree.children![0].children![0].id);
tree.getChildIDs();
