const path = require('path');
const webpack = require('webpack');

/*
 * SplitChunksPlugin is enabled by default and replaced
 * deprecated CommonsChunkPlugin. It automatically identifies modules which
 * should be splitted of chunk by heuristics using module duplication count and
 * module category (i. e. node_modules). And splits the chunks…
 *
 * It is safe to remove "splitChunks" from the generated configuration
 * and was added as an educational example.
 *
 * https://webpack.js.org/plugins/split-chunks-plugin/
 *
 */

module.exports = {
	target: 'node',
	entry: './cli.js',

	output: {
		filename: 'flavio.min.js',
		path: path.resolve(__dirname, 'dist')
	},

	plugins: [new webpack.ProgressPlugin()],

	module: {
		rules: [
			{
				test: /.(js|jsx)$/,
				loader: 'babel-loader',
				exclude: [],

				options: {
					presets: [
						[
							'@babel/preset-env',
							{
								targets: {
									'node': 'v6.0.0'
								},
								modules: false
							}
						]
					]
				}
			}
		]
	},
	node: {
		__filename: false,
		__dirname: false
	},
	devServer: {
		open: true
	}
};
