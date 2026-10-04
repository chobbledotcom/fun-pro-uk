#!/usr/bin/env bash

# sharp/vips need libstdc++ for the build steps inside the precommit suite.
# shellcheck source=/dev/null
source @runtimeSetup@

exec bun run precommit "$@"
