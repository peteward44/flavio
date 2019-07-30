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
	mode: 'development',
	target: 'node',
	entry: './cli.js',

	output: {
		filename: 'flavio.min.js', //'[name].[chunkhash].js',
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
					ignore: [ /@babel\/polyfill/ ],
				
					rootMode: "upward",
					plugins: ['syntax-dynamic-import'],

					presets: [
						[
							'@babel/preset-env',
							{
								targets: {
									'node': 'v0.10.0'
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
	optimization: {
		splitChunks: {
			// cacheGroups: {
				// vendors: {
					// priority: -10,
					// test: /[\\/]node_modules[\\/]/
				// }
			// },

			chunks: 'async',
			minChunks: 1,
			minSize: 30000,
			name: true
		}
	},

	devServer: {
		open: true
	}
};
