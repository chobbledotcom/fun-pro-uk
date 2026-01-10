import fs from "node:fs";
import path from "node:path";

import { buildDir, templateRepo } from "./consts.js";
import { gitClone, gitPull, run, sh } from "./utils.js";

const root = path.resolve(import.meta.dirname, "..");
const build = path.join(root, buildDir);
const template = path.join(build, "template");
const dev = path.join(build, "dev");

const templateExcludes = [".git", "node_modules", "*.md", "test", "test-*"];
const rootExcludes = [
	".git",
	"*.nix",
	"README.md",
	buildDir,
	"scripts",
	"node_modules",
	"package*.json",
	"bun.lock",
	"old_site",
];

export function prep() {
	console.log("Preparing build...");
	fs.mkdirSync(build, { recursive: true });

	if (!fs.existsSync(path.join(template, ".git"))) {
		console.log("Cloning template...");
		fs.rmSync(template, { recursive: true, force: true });
		gitClone(templateRepo, template);
	} else {
		console.log("Updating template...");
		gitPull(template);
	}

	sh(`find "${dev}" -type f -name "*.md" -delete 2>/dev/null || true`);

	const templateExcludeArgs = templateExcludes
		.map((e) => `--exclude="${e}"`)
		.join(" ");

	const rootExcludeArgs = rootExcludes.map((e) => `--exclude="${e}"`).join(" ");

	sh(`rsync -r --delete ${templateExcludeArgs} "${template}/" "${dev}/"`);
	sh(`rsync -r ${rootExcludeArgs} "${root}/" "${dev}/src/"`);

	sync();

	const nodeModulesPath = path.join(dev, "node_modules");
	const bunTagPath = path.join(dev, "node_modules", ".bun-tag");

	// Install if node_modules doesn't exist or wasn't created by bun
	if (!fs.existsSync(nodeModulesPath) || !fs.existsSync(bunTagPath)) {
		console.log("Installing dependencies...");
		run("bun", ["install"], { cwd: dev });
	}

	fs.rmSync(path.join(dev, "_site"), { recursive: true, force: true });
	console.log("Build ready.");
}

export function sync() {
	const excludes = rootExcludes.map((e) => `--exclude="${e}"`).join(" ");

	const cmd = [
		"rsync -ru",
		excludes,
		'--include="*/"',
		'--include="**/*.md"',
		'--include="**/*.scss"',
		'--exclude="*"',
		`"${root}/"`,
		`"${dev}/src/"`,
	].join(" ");

	sh(cmd);
}

if (import.meta.main) prep();
