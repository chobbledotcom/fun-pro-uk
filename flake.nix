{
  inputs = { };

  outputs =
    { self }:
    {
      devShells.x86_64-linux.default =
        let
          pkgs = import <nixpkgs> { system = "x86_64-linux"; };
          scriptCommands = {
            serve = "node scripts/serve.js";
            build = "node scripts/build.js";
            "prepare-dev" = "node scripts/prepare-dev.js";
            "sync-files" = "node scripts/sync-files.js";
            watch = "node scripts/watch.js";
            "update-pages" = "node scripts/update-pages.js";
            "fetch-google-reviews" = "node scripts/fetch-google-reviews.js";
            "optimize-images" = "./scripts/optimize-images.sh";
            clean = "rm -rf .build";
          };
          bunScripts = pkgs.symlinkJoin {
            name = "bun-scripts";
            paths = map (cmd: pkgs.writeShellScriptBin cmd scriptCommands.${cmd}) (builtins.attrNames scriptCommands);
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

            nix flake update
            git pull
          '';
        };
    };
}
