const pkg = require('./package.json');

module.exports = {
	input: pkg.module,
	external: [
		'mobx-state-tree'
	],
	output: [
		{
			file: pkg.main,
			format: 'cjs'
		}, {
			file: pkg.browser,
			name: pkg.name,
			globals: {
				'mobx-state-tree': 'mobxStateTree'
			},
			format: 'umd'
		}
	]
};
