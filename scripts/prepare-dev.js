const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { templateRepo, buildDir } = require("./consts");

const root = path.resolve(__dirname, "..");
const build = path.join(root, buildDir);
const template = path.join(build, "template");
const dev = path.join(build, "dev");
const localTemplate = path.join(root, "..", "chobble-template");

const templateExcludes = [
	".git",
	".direnv",
	"node_modules",
	"*.md",
	"test",
	"test-*",
	"theme-*.scss",
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

	// Create root .image-cache if it doesn't exist
	if (!fs.existsSync(rootCache)) {
		fs.mkdirSync(rootCache, { recursive: true });
	}

	// Remove existing .image-cache in dev (if it's not already a symlink)
	if (fs.existsSync(devCache)) {
		const stats = fs.lstatSync(devCache);
		if (!stats.isSymbolicLink()) {
			fs.rmSync(devCache, { recursive: true, force: true });
		}
	}

	// Create symlink if it doesn't exist
	if (!fs.existsSync(devCache)) {
		fs.symlinkSync(path.relative(dev, rootCache), devCache);
		console.log("Linked .image-cache for persistent caching");
	}
}

function prep() {
	console.log("Preparing build...");
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

	fs.rmSync(path.join(template, "test"), { recursive: true, force: true });

	execSync(`find "${dev}" -type f -name "*.md" -delete 2>/dev/null || true`);

	const templateExcludeArgs = templateExcludes
		.map((e) => `--exclude="${e}"`)
		.join(" ");

	const rootExcludeArgs = rootExcludes.map((e) => `--exclude="${e}"`).join(" ");

	execSync(`rsync -r --delete ${templateExcludeArgs} "${template}/" "${dev}/"`);
	execSync(`rsync -r ${rootExcludeArgs} "${root}/" "${dev}/src/"`);

	setupImageCache();

	// Debug: Check if package.json exists in dev directory
	if (!fs.existsSync(path.join(dev, "package.json"))) {
		console.error(
			"Error: package.json not found in dev directory after template copy!",
		);
		console.error("Template contents:", fs.readdirSync(template));
		console.error("Dev contents:", fs.readdirSync(dev));
		process.exit(1);
	}

	sync();

	if (!fs.existsSync(path.join(dev, "node_modules"))) {
		console.log("Installing dependencies...");
		execSync("pnpm install", { cwd: dev });
	}

	fs.rmSync(path.join(dev, "_site"), { recursive: true, force: true });
	console.log("Build ready.");
}

function sync() {
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
}

if (require.main === module) prep();

module.exports = { prep, sync };
