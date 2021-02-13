const presets = [
  ["@babel/env", {
    targets: {
      node: "6.0.0"
    },
    useBuiltIns: "usage",
	corejs: 3
  }]
];

module.exports = { presets };
