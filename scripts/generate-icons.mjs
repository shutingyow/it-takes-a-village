import sharp from "sharp";
import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const publicDir = join(root, "public");

/** Prefer the branded PNG source; fall back to icon.svg */
const pngSource = join(publicDir, "app-icon-source.png");
const svgSource = join(publicDir, "icon.svg");
const input = existsSync(pngSource) ? pngSource : svgSource;

const sizes = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
];

for (const { name, size } of sizes) {
  await sharp(input).resize(size, size).png().toFile(join(publicDir, name));
  console.log(`Generated ${name} from ${existsSync(pngSource) ? "app-icon-source.png" : "icon.svg"}`);
}
