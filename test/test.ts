import { types, onSnapshot } from 'mobx-state-tree';
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

const SpecialTodoData = shim(Todo);

class SpecialTodoCode extends SpecialTodoData {

	@action
	toggle() {
		console.log('Toggling!');
		super.toggle();
	}

}

const SpecialTodo = mst(SpecialTodoCode, SpecialTodoData);

const Store = types.model({
	todos: types.array(SpecialTodo)
});

const store = Store.create({ todos: [{
	title: "Get coffee"
}]});

onSnapshot(store, (snapshot) => {
	console.log(snapshot)
})

store.todos[0].print()
store.todos[0].toggle()
store.todos[0].print()
