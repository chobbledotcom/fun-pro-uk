import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildDir, templateRepo } from "./consts.js";
import { bun, copyDir, find, fs, git, path, root } from "./utils.js";

const build = path(buildDir);
const template = path(buildDir, "template");
const dev = path(buildDir, "dev");
const localTemplate = join(root, "..", "chobble-template");

const templateExcludes = [
	".git",
	".direnv",
	"node_modules",
	"*.md",
	"test",
	"test-*",
	".image-cache",
	"landing-pages",
];
const rootExcludes = [
	".git",
	".direnv",
	"*.nix",
	"README.md",
	buildDir,
	"scripts",
	"node_modules",
	"package*.json",
	"bun.lock",
	"old_site",
	...(process.env.PLACEHOLDER_IMAGES === "1" ? ["images"] : []),
];

/**
 * Fix template's normaliseSlug to strip Eleventy-style date prefixes (YYYY-MM-DD-).
 * Without this, products with date-prefixed filenames (e.g. 2026-02-18-fast-feet.md)
 * can't be matched by slug lookup, breaking explicit product ordering in events.
 * TODO: upstream this fix to chobble-template
 */
const patchTemplate = (devDir) => {
	const slugUtils = join(devDir, "src/_lib/utils/slug-utils.js");
	if (!fs.exists(slugUtils)) return;
	const content = readFileSync(slugUtils, "utf8");
	if (content.includes("date prefix")) return; // already patched
	const patched = content.replace(
		'(filename) => filename.replace(/\\.md$/, ""),',
		`(filename) => filename.replace(/\\.md$/, ""),
    // Strip Eleventy-style date prefixes (YYYY-MM-DD-) to match fileSlug
    (slug) => slug.replace(/^\\d{4}-\\d{2}-\\d{2}-/, ""),`,
	);
	if (patched !== content) {
		writeFileSync(slugUtils, patched);
		console.log("Patched slug-utils.js: added date prefix stripping");
	}
};

export const prep = () => {
	console.log("Preparing build...");
	fs.mkdir(build);

	if (fs.exists(localTemplate)) {
		console.log("Using local template from ../chobble-template...");
		copyDir(localTemplate, template, {
			delete: true,
			exclude: templateExcludes,
		});
	} else if (!fs.exists(join(template, ".git"))) {
		console.log("Cloning template...");
		fs.rm(template);
		git.clone(templateRepo, template);
	} else {
		console.log("Updating template...");
		git.reset(template, { hard: true });
		git.pull(template);
	}

	find.deleteByExt(dev, ".md");
	copyDir(template, dev, { delete: true, exclude: templateExcludes });
	copyDir(root, join(dev, "src"), { exclude: rootExcludes });

	sync();
	patchTemplate(dev);

	if (!fs.exists(join(dev, "node_modules"))) {
		console.log("Installing dependencies...");
		bun.install(dev);
	}

	fs.rm(join(dev, "_site"));
	console.log("Build ready.");
};

export const sync = () => {
	copyDir(root, join(dev, "src"), {
		update: true,
		exclude: rootExcludes,
	});
};

if (import.meta.main) prep();
