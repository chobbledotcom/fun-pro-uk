import fs from "node:fs";
import path from "node:path";

// Load homepage images from JSON and filter out any with missing files
export default function () {
  const dataDir = import.meta.dirname;
  const jsonPath = path.join(dataDir, "_homepage-images.json");

  if (!fs.existsSync(jsonPath)) {
    return {};
  }

  const images = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  const srcDir = path.join(dataDir, "..");

  // Filter to only images that exist using functional pattern
  return Object.fromEntries(
    Object.entries(images).filter(([, imagePath]) => {
      const fullPath = path.join(srcDir, imagePath.replace(/^\//, ""));
      return fs.existsSync(fullPath);
    }),
  );
}
