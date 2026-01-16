#!/bin/bash

# Update scripts from chobble-client repo
# This copies scripts from chobbledotcom/chobble-client over our own
# without deleting any extra scripts we've added locally

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMP_DIR=$(mktemp -d)
REPO_URL="https://github.com/chobbledotcom/chobble-client.git"

echo "Fetching scripts from chobble-client..."

# Clone just the scripts directory using sparse checkout
cd "$TEMP_DIR"
git clone --depth 1 --filter=blob:none --sparse "$REPO_URL" chobble-client 2>/dev/null || {
    echo "Failed to clone repo. Trying alternative method..."
    git clone --depth 1 "$REPO_URL" chobble-client
}

cd chobble-client
git sparse-checkout set scripts 2>/dev/null || true

if [ -d "scripts" ]; then
    echo "Copying scripts..."
    # Use cp with no-clobber disabled - we want to overwrite existing files
    # but rsync is better as it preserves structure and doesn't delete extras
    rsync -av --exclude='update-scripts.sh' scripts/ "$SCRIPT_DIR/"
    echo "Scripts updated successfully!"
else
    echo "Error: scripts directory not found in chobble-client repo"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Cleanup
rm -rf "$TEMP_DIR"

echo "Done! Your local-only scripts have been preserved."
