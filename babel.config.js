const presets = [
  ["@babel/env", {
    targets: {
		"node": "current"
    },
    useBuiltIns: "usage",
	corejs: 3
  }]
];

module.exports = { presets };
