const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { templateRepo, buildDir } = require("./consts");

const root = path.resolve(__dirname, "..");
const build = path.join(root, buildDir);
const template = path.join(build, "template");
const dev = path.join(build, "dev");
const localTemplate = path.join(root, "..", "chobble-template");

// Same as prepare-dev but WITHOUT excluding test files
const templateExcludes = [
	".git",
	".direnv",
	".envrc",
	"node_modules",
	"*.md",
	"package.json",
	"pnpm-lock.yaml",
];

const rootExcludes = [
	".git",
	"*.nix",
	"README.md",
	buildDir,
	"scripts",
	"node_modules",
	"package*.json",
	"old_site",
];

function setupImageCache() {
	const rootCache = path.join(root, ".image-cache");
	const devCache = path.join(dev, ".image-cache");

	if (!fs.existsSync(rootCache)) {
		fs.mkdirSync(rootCache, { recursive: true });
	}

	if (fs.existsSync(devCache)) {
		const stats = fs.lstatSync(devCache);
		if (!stats.isSymbolicLink()) {
			fs.rmSync(devCache, { recursive: true, force: true });
		}
	}

	if (!fs.existsSync(devCache)) {
		fs.symlinkSync(path.relative(dev, rootCache), devCache);
	}
}

function prepForTest() {
	console.log("Preparing build for testing...");
	fs.mkdirSync(build, { recursive: true });

	if (fs.existsSync(localTemplate)) {
		console.log("Using local template...");
		if (!fs.existsSync(template)) {
			fs.mkdirSync(template, { recursive: true });
		}
		const templateExcludeArgs = templateExcludes
			.map((e) => `--exclude="${e}"`)
			.join(" ");
		execSync(
			`rsync -r --delete ${templateExcludeArgs} "${localTemplate}/" "${template}/"`,
		);
	} else if (!fs.existsSync(template)) {
		console.log("Cloning template...");
		execSync(`git clone --depth 1 ${templateRepo} "${template}"`);
	} else {
		console.log("Updating template...");
		execSync("git reset --hard && git pull", { cwd: template });
	}

	execSync(`find "${dev}" -type f -name "*.md" -delete 2>/dev/null || true`);

	const templateExcludeArgs = templateExcludes
		.map((e) => `--exclude="${e}"`)
		.join(" ");

	const rootExcludeArgs = rootExcludes.map((e) => `--exclude="${e}"`).join(" ");

	execSync(`rsync -r --delete ${templateExcludeArgs} "${template}/" "${dev}/"`);
	execSync(`rsync -r ${rootExcludeArgs} "${root}/" "${dev}/src/"`);

	setupImageCache();

	if (!fs.existsSync(path.join(dev, "package.json"))) {
		console.error(
			"Error: package.json not found in dev directory after template copy!",
		);
		console.error("Template contents:", fs.readdirSync(template));
		console.error("Dev contents:", fs.readdirSync(dev));
		process.exit(1);
	}

	// Sync content files
	const excludes = rootExcludes.map((e) => `--exclude="${e}"`).join(" ");
	const cmd = [
		"rsync -ru",
		excludes,
		'--include="*/"',
		'--include="**/*.md"',
		'--include="**/*.html"',
		'--include="**/*.scss"',
		'--include="**/*.woff"',
		'--include="**/*.woff2"',
		'--exclude="*"',
		`"${root}/"`,
		`"${dev}/src/"`,
	].join(" ");
	execSync(cmd);

	console.log("Installing dependencies...");
	execSync("pnpm install", { cwd: dev, stdio: "inherit" });

	fs.rmSync(path.join(dev, "_site"), { recursive: true, force: true });
	console.log("Build ready for testing.");
}

function runTests() {
	console.log("\nRunning tests...");
	try {
		execSync("pnpm run test", { cwd: dev, stdio: "inherit" });
		console.log("\n✓ All tests passed!");
	} catch (err) {
		console.error("\n✗ Tests failed.");
		process.exit(err.status || 1);
	}
}

prepForTest();
runTests();
