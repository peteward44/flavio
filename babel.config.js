const presets = [
  ["@babel/env", {
    targets: {
      node: "0.12.0"
    },
    useBuiltIns: "usage",
	corejs: 3
  }]
];

module.exports = { presets };
