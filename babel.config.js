const presets = [
  ["@babel/env", {
    targets: {
      node: "6.0.0"
    }
  }]
];
const plugins = [
	[ "@babel/plugin-proposal-decorators", { legacy: true } ]
];

module.exports = { presets, plugins };
