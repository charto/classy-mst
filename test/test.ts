import { types, process, onSnapshot } from 'mobx-state-tree';
import { mst, shim, action } from '..';

const TodoData = shim(types.model({
	title: types.string,
	done: false
}));

class TodoCode extends TodoData {

	@action
	toggle() {
		this.done = !this.done;
	}

	@action
	print() {
		console.log(this.done);
	}

}

const Todo = mst(TodoCode, TodoData);

const SpecialTodoData = shim(
	Todo.props({
		count: types.optional(types.number, 0)
	}),
	Todo
);

class SpecialTodoCode extends SpecialTodoData {

	@action
	toggle() {
		console.log('Toggled ' + this.title + ' ' + (++this.count) + ' times!');
		super.toggle();
	}

}

const SpecialTodo = mst(SpecialTodoCode, SpecialTodoData);

const Store = types.model({
	todos: types.array(SpecialTodo)
});

const store = Store.create({
	todos: [
		{ title: 'Foo' },
		{ title: 'Bar' }
	]
});

onSnapshot(store, (snapshot) => {
	console.log(snapshot)
})

store.todos[0].toggle();
store.todos[1].toggle();
store.todos[1].toggle();

store.todos[0].print();
store.todos[1].print();

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
