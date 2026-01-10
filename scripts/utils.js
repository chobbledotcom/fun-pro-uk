// Shared utilities for build scripts

const defaultOpts = {
	stdio: ["inherit", "inherit", "inherit"],
};

export function run(cmd, args = [], opts = {}) {
	return Bun.spawnSync([cmd, ...args], { ...defaultOpts, ...opts });
}

export function sh(command, opts = {}) {
	return Bun.spawnSync(["sh", "-c", command], { ...defaultOpts, ...opts });
}

export function git(args, opts = {}) {
	return run("git", args, opts);
}

export function gitClone(repo, dest, opts = {}) {
	return git(
		["clone", "--depth", "1", "--single-branch", "--filter=blob:none", repo, dest],
		opts,
	);
}

export function gitPull(dir) {
	git(["-C", dir, "reset", "--hard"]);
	return git(["-C", dir, "pull"]);
}
