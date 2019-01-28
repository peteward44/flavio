const presets = [
  ["@babel/env", {
    targets: {
      node: "0.12.0"
    },
    useBuiltIns: "usage"
  }]
];

module.exports = { presets };
