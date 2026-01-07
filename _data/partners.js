import fs from "node:fs";
import path from "node:path";

// Load partners from JSON and filter out any with missing images
export default function () {
  const dataDir = import.meta.dirname;
  const jsonPath = path.join(dataDir, "_partners-source.json");

  if (!fs.existsSync(jsonPath)) {
    return [];
  }

  const partners = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  const srcDir = path.join(dataDir, "..");

  // Filter to only partners whose images exist
  return partners.filter((partner) => {
    const imagePath = path.join(srcDir, partner.image.replace(/^\//, ""));
    return fs.existsSync(imagePath);
  });
}
