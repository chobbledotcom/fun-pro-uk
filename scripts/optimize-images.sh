#!/usr/bin/env bash
# Optimize product images using mozjpeg
#
# This script:
# 1. Scans all images in images/products/
# 2. Resizes images over 1800px to max 1800px (longest side)
# 3. Converts to JPEG using mozjpeg at 95% quality
# 4. Only replaces if the optimized version is smaller
#
# Usage:
#   ./scripts/optimize-images.sh              # Optimize all images
#   ./scripts/optimize-images.sh --dry-run    # Preview without changes
#   ./scripts/optimize-images.sh path/to/image.jpg  # Optimize specific image
#   ./scripts/optimize-images.sh --dry-run path/to/image.jpg

set -euo pipefail

# Size threshold: images over 1MB will be resized even if under 1800px
# A 1800px JPEG at 95% quality should be well under 1MB
SIZE_THRESHOLD=$((1 * 1024 * 1024))  # 1MB in bytes

# Find cjpeg (mozjpeg) - check PATH first, then nix store
CJPEG=$(which cjpeg 2>/dev/null || find /nix/store -path "*/mozjpeg*/bin/cjpeg" 2>/dev/null | head -1 || echo "")

if [[ -z "$CJPEG" ]]; then
  echo "Error: mozjpeg (cjpeg) not found"
  echo "Please ensure you're in the nix development shell:"
  echo "  nix develop"
  exit 1
fi

# Parse arguments
DRY_RUN=false
SPECIFIC_IMAGE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    *)
      SPECIFIC_IMAGE="$1"
      shift
      ;;
  esac
done

if [[ -n "$SPECIFIC_IMAGE" ]]; then
  # Specific image mode
  if [[ ! -f "$SPECIFIC_IMAGE" ]]; then
    echo "Error: Image not found: $SPECIFIC_IMAGE"
    exit 1
  fi
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "Optimizing image (DRY RUN): $SPECIFIC_IMAGE"
  else
    echo "Optimizing image: $SPECIFIC_IMAGE"
  fi
  IMAGE_FILES=("$SPECIFIC_IMAGE")
else
  # All images mode
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "Optimizing product images (DRY RUN)..."
  else
    echo "Optimizing product images..."
  fi

  IMAGES_DIR="images/products"

  if [[ ! -d "$IMAGES_DIR" ]]; then
    echo "Error: Images directory not found: $IMAGES_DIR"
    exit 1
  fi

  # Find all image files
  mapfile -t IMAGE_FILES < <(find "$IMAGES_DIR" -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" -o -iname "*.webp" \) | sort)
fi

TOTAL_FILES=${#IMAGE_FILES[@]}
echo "  Found $TOTAL_FILES image(s)"

PROCESSED=0
OPTIMIZED=0
REPLACED=0
KEPT_ORIGINAL=0
SKIPPED=0
ERRORS=0
TOTAL_ORIGINAL_SIZE=0
TOTAL_NEW_SIZE=0
TOTAL_SAVED=0

format_bytes() {
  local bytes=$1
  if (( bytes < 1024 )); then
    echo "${bytes} B"
  elif (( bytes < 1048576 )); then
    echo "$(awk "BEGIN {printf \"%.1f\", $bytes/1024}") KB"
  else
    echo "$(awk "BEGIN {printf \"%.1f\", $bytes/1048576}") MB"
  fi
}

for IMAGE_PATH in "${IMAGE_FILES[@]}"; do
  FILENAME=$(basename "$IMAGE_PATH")
  ORIGINAL_SIZE=$(stat -c%s "$IMAGE_PATH" 2>/dev/null || stat -f%z "$IMAGE_PATH" 2>/dev/null)
  TOTAL_ORIGINAL_SIZE=$((TOTAL_ORIGINAL_SIZE + ORIGINAL_SIZE))
  
  # Get image dimensions
  DIMS=$(identify -format "%w %h" "$IMAGE_PATH" 2>/dev/null) || {
    echo "  ✗ $FILENAME: Error reading image"
    ERRORS=$((ERRORS + 1))
    PROCESSED=$((PROCESSED + 1))
    continue
  }
  
  WIDTH=$(echo "$DIMS" | cut -d' ' -f1)
  HEIGHT=$(echo "$DIMS" | cut -d' ' -f2)
  MAX_DIM=$((WIDTH > HEIGHT ? WIDTH : HEIGHT))
  
  NEEDS_RESIZE=false
  RESIZE_REASON=""
  if (( MAX_DIM > 1800 )); then
    NEEDS_RESIZE=true
    RESIZE_REASON="dimensions ${WIDTH}x${HEIGHT}"
  elif (( ORIGINAL_SIZE > SIZE_THRESHOLD )); then
    # File is over 2MB - something's wrong, force resize to 1800px
    NEEDS_RESIZE=true
    RESIZE_REASON="file size $(format_bytes "$ORIGINAL_SIZE")"
  fi
  
  # Skip if already optimal (small enough, right dimensions, and already .jpg)
  if [[ "$NEEDS_RESIZE" == "false" && "${IMAGE_PATH##*.}" == "jpg" ]]; then
    SKIPPED=$((SKIPPED + 1))
    PROCESSED=$((PROCESSED + 1))
    continue
  fi
  
  TEMP_PATH="${IMAGE_PATH}.tmp.jpg"
  
  if [[ "$DRY_RUN" == "true" ]]; then
    if [[ "$NEEDS_RESIZE" == "true" ]]; then
      echo "  • $FILENAME: Would resize ($RESIZE_REASON) and optimize"
    else
      echo "  • $FILENAME: Would optimize"
    fi
    OPTIMIZED=$((OPTIMIZED + 1))
    PROCESSED=$((PROCESSED + 1))
    continue
  fi
  
  # Resize if needed, then pipe through mozjpeg
  # PPM is an uncompressed intermediate format that cjpeg can read
  # We convert to PPM (uncompressed) to avoid double-compression
  
  if [[ "$NEEDS_RESIZE" == "true" ]]; then
    # Resize and convert to PPM, pipe to mozjpeg
    # The ">" suffix means "only shrink, never enlarge" - prevents upscaling
    convert "$IMAGE_PATH" -resize "1800x1800>" ppm:- 2>/dev/null | \
      "$CJPEG" -quality 95 -optimize -progressive -outfile "$TEMP_PATH" 2>/dev/null || {
      echo "  ✗ $FILENAME: Error during resize/compression"
      ERRORS=$((ERRORS + 1))
      PROCESSED=$((PROCESSED + 1))
      [[ -f "$TEMP_PATH" ]] && rm "$TEMP_PATH"
      continue
    }
  else
    # Convert to PPM and pipe to mozjpeg
    convert "$IMAGE_PATH" ppm:- 2>/dev/null | \
      "$CJPEG" -quality 95 -optimize -progressive -outfile "$TEMP_PATH" 2>/dev/null || {
      echo "  ✗ $FILENAME: Error during compression"
      ERRORS=$((ERRORS + 1))
      PROCESSED=$((PROCESSED + 1))
      [[ -f "$TEMP_PATH" ]] && rm "$TEMP_PATH"
      continue
    }
  fi
  
  # Check new file size
  NEW_SIZE=$(stat -c%s "$TEMP_PATH" 2>/dev/null || stat -f%z "$TEMP_PATH" 2>/dev/null)
  
  if (( NEW_SIZE < ORIGINAL_SIZE )); then
    # Replace original
    mv "$TEMP_PATH" "$IMAGE_PATH"
    SAVED=$((ORIGINAL_SIZE - NEW_SIZE))
    TOTAL_SAVED=$((TOTAL_SAVED + SAVED))
    TOTAL_NEW_SIZE=$((TOTAL_NEW_SIZE + NEW_SIZE))
    REPLACED=$((REPLACED + 1))
    
    PERCENT=$(awk "BEGIN {printf \"%.1f\", ($SAVED / $ORIGINAL_SIZE) * 100}")
    echo "  ✓ $FILENAME: $(format_bytes "$ORIGINAL_SIZE") → $(format_bytes "$NEW_SIZE") (${PERCENT}% smaller)"
  else
    # Keep original
    rm "$TEMP_PATH"
    TOTAL_NEW_SIZE=$((TOTAL_NEW_SIZE + ORIGINAL_SIZE))
    KEPT_ORIGINAL=$((KEPT_ORIGINAL + 1))
    echo "  • $FILENAME: Kept original (optimized version was larger)"
  fi
  
  OPTIMIZED=$((OPTIMIZED + 1))
  PROCESSED=$((PROCESSED + 1))
  
  # Progress indicator
  if (( PROCESSED % 10 == 0 )); then
    echo "  Processed $PROCESSED/$TOTAL_FILES..."
  fi
done

echo ""
echo "Summary:"
echo "  Processed: $PROCESSED files"
echo "  Optimized: $OPTIMIZED files"

if [[ "$DRY_RUN" == "false" ]]; then
  echo "  Replaced: $REPLACED files"
  echo "  Kept original: $KEPT_ORIGINAL files"
  echo "  Skipped: $SKIPPED files (already optimal)"
  echo "  Errors: $ERRORS files"
  echo "  Total saved: $(format_bytes "$TOTAL_SAVED")"
  echo "  Original total: $(format_bytes "$TOTAL_ORIGINAL_SIZE")"
  echo "  New total: $(format_bytes "$TOTAL_NEW_SIZE")"
  
  if (( TOTAL_ORIGINAL_SIZE > 0 )); then
    PERCENT_SAVED=$(awk "BEGIN {printf \"%.1f\", ($TOTAL_SAVED / $TOTAL_ORIGINAL_SIZE) * 100}")
    echo "  Space saved: ${PERCENT_SAVED}%"
  fi
fi

echo ""
if [[ "$DRY_RUN" == "true" ]]; then
  echo "✓ Dry run complete (no changes made)"
else
  echo "✓ Image optimization complete!"
fi
