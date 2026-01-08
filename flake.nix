{
  inputs = { };

  outputs =
    { self }:
    {
      devShells.x86_64-linux.default =
        let
          pkgs = import <nixpkgs> { system = "x86_64-linux"; };
          scriptCommands = {
            serve = "bun scripts/serve.js";
            build = "bun scripts/build.js";
            "prepare-dev" = "bun scripts/prepare-dev.js";
            "sync-files" = "bun scripts/sync-files.js";
            watch = "bun scripts/watch.js";
            "update-pages" = "bun scripts/update-pages.js";
            "fetch-google-reviews" = "bun scripts/fetch-google-reviews.js";
            "optimize-images" = "./scripts/optimize-images.sh";
            clean = "rm -rf .build";
          };
          bunScripts = pkgs.symlinkJoin {
            name = "bun-scripts";
            paths = map (cmd: pkgs.writeShellScriptBin cmd scriptCommands.${cmd}) (
              builtins.attrNames scriptCommands
            );
          };
        in
        pkgs.mkShell {
          buildInputs = [
            pkgs.nodejs_24
            pkgs.bun
            bunScripts
            pkgs.pandoc
            pkgs.imagemagick
            pkgs.mozjpeg
            pkgs.biome
            pkgs.vips
            pkgs.stdenv.cc.cc.lib
          ];
          shellHook = ''
            cat <<EOF

            Available commands:
             serve               - Start development server
             build               - Build the project
             prepare-dev         - Prepare development environment
             sync-files          - Synchronize files
             watch               - Watch for changes
             update-pages        - Update pages
             fetch-google-reviews - Fetch Google Maps reviews
             optimize-images     - Optimize product images with mozjpeg
             clean               - Clean build directory

            EOF

            export LD_LIBRARY_PATH="${pkgs.stdenv.cc.cc.lib}/lib:$LD_LIBRARY_PATH"

            nix flake update
            git pull
            bun install
          '';
        };
    };
}
