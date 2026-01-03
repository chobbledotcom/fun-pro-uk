const { execSync } = require("child_process");
const { prep, dev } = require("./prepare-dev");

prep({ includeTests: true });

console.log("\nRunning tests...");
try {
	execSync("bun test", { cwd: dev, stdio: "inherit" });
	console.log("\n✓ All tests passed!");
} catch (err) {
	console.error("\n✗ Tests failed.");
	process.exit(err.status || 1);
}
