#!/usr/bin/env bash

# shellcheck source=/dev/null
source @runtimeSetup@

# Install dependencies in the background so shell entry stays fast.
(bun install && echo "Environment ready <3") &

# Repo-local executables (bin/lint, bin/profile).
export PATH="$PWD/bin:$PATH"

cat <<'EOF'

Available commands:
 serve              - Clean & start dev server with incremental builds
 build              - Clean & build the site in ./_site
 test               - Run JavaScript tests
 pc                 - Run precommit (lint/typecheck/tests) - also runs automatically on git commit
 precommit          - Alias for pc
 profile            - Profile build for performance bottlenecks
 lint               - Format code with Biome (Nix-only)
 screenshot         - Take website screenshots (Nix-only)
 customise-cms      - Interactive setup for PagesCMS collections
 generate-pages-yml - Generate .pages.yml with all collections

EOF
