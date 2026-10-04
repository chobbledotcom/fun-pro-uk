{
  pkgs,
  lib,
  config,
  ...
}:

let
  runtimeSetup = pkgs.replaceVars ./scripts/devenv/library-path.sh {
    libraryPath = lib.optionalString pkgs.stdenv.isLinux (
      lib.makeLibraryPath [ pkgs.stdenv.cc.cc.lib ]
    );
  };

  precommitHook = pkgs.writeShellApplication {
    name = "fun-pro-uk-precommit-hook";
    runtimeInputs = [ pkgs.bun ];
    text = builtins.readFile (
      pkgs.replaceVars ./scripts/devenv/precommit.sh {
        inherit runtimeSetup;
      }
    );
  };

  shellSetup = pkgs.replaceVars ./scripts/devenv/shell.sh {
    inherit runtimeSetup;
  };
in
{
  # CI runs each check itself, so the commit-time Git hook must not run.
  profiles.ci.module = {
    git-hooks.enable = false;
  };

  packages = with pkgs; [
    bun
    git
    biome
    vips
    stdenv.cc.cc.lib
  ];

  scripts = {
    pc.exec = ''exec bun run precommit "$@"'';
    precommit.exec = ''exec bun run precommit "$@"'';
    serve.exec = ''exec bun run serve "$@"'';
    build.exec = ''exec bun run build "$@"'';
    test.exec = ''exec bun run test "$@"'';
    profile.exec = ''exec bun run profile "$@"'';
    lint.exec = ''exec bun run lint "$@"'';
    screenshot.exec = ''exec bun run screenshot "$@"'';
    customise-cms.exec = ''exec bun run customise-cms "$@"'';
    generate-pages-yml.exec = ''exec bun run generate-pages-yml "$@"'';
  };

  git-hooks.hooks.precommit = {
    enable = true;
    entry = "${precommitHook}/bin/fun-pro-uk-precommit-hook";
    pass_filenames = false;
  };

  # The devenv task `devenv:git-hooks:run` executes `prek run -a` — the
  # whole `bun run precommit` — on every shell entry, which takes minutes on
  # this tree. The commit-time Git hook and CI already run the precommit, so
  # shell entry never needs it. A `status` command that exits 0 tells the
  # task runner the hook run is already satisfied, so the entry task skips
  # without disabling the hooks themselves.
  tasks = lib.mkIf config.git-hooks.enable {
    "devenv:git-hooks:run".status = "exit 0";
  };

  enterShell = "source ${shellSetup}";
}
