const fs = require("fs");
const path = require("path");
const { sync } = require("./prepare-dev");

const root = path.resolve(__dirname, "..");

fs.watch(root, { recursive: true }, (event, file) => {
	if (
		file &&
		!file.startsWith(".build") &&
		!file.startsWith("node_modules") &&
		!file.startsWith(".git")
	) {
		sync();
	}
});
