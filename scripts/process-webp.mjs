import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const inputRoot = path.resolve("hinhanh");
const outputRoot = path.resolve("public/images/hinhanh-webp");

if (!fs.existsSync(outputRoot)) {
  fs.mkdirSync(outputRoot, { recursive: true });
}

function getAllImageFiles(dir, baseDir = dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;

  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllImageFiles(fullPath, baseDir));
    } else if (/\.(jpe?g|png|webp|avif)$/i.test(file)) {
      const relDir = path.relative(baseDir, dir);
      results.push({ fullPath, relDir, fileName: file });
    }
  }
  return results;
}

async function convertImage(inputPath, outputPath) {
  if (fs.existsSync(outputPath)) {
    const inStat = fs.statSync(inputPath);
    const outStat = fs.statSync(outputPath);
    if (outStat.mtimeMs >= inStat.mtimeMs && outStat.size > 0) {
      return false; // skip
    }
  }

  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const image = sharp(inputPath);
  const meta = await image.metadata();

  let pipeline = image.rotate(); // auto-rotate based on EXIF
  const maxDim = 1920;
  if ((meta.width && meta.width > maxDim) || (meta.height && meta.height > maxDim)) {
    pipeline = pipeline.resize({
      width: meta.width && meta.width >= meta.height ? maxDim : undefined,
      height: meta.height && meta.height > meta.width ? maxDim : undefined,
      withoutEnlargement: true,
      fit: "inside",
    });
  }

  await pipeline.webp({ quality: 82, effort: 4 }).toFile(outputPath);
  return true;
}

async function convertAll() {
  if (!fs.existsSync(inputRoot)) {
    console.log("No hinhanh directory found.");
    return;
  }

  const files = getAllImageFiles(inputRoot);
  console.log(`Found ${files.length} images across hinhanh/ folders. Converting to WebP...`);

  let convertedCount = 0;
  for (let i = 0; i < files.length; i++) {
    const item = files[i];
    const baseName = path.parse(item.fileName).name;

    // 1. Save in structured category subfolder: public/images/hinhanh-webp/<category>/<name>.webp
    const catOutputDir = path.join(outputRoot, item.relDir);
    const catOutputPath = path.join(catOutputDir, `${baseName}.webp`);

    try {
      const convertedCat = await convertImage(item.fullPath, catOutputPath);

      // 2. Also ensure a copy exists in root outputRoot/<name>.webp for backwards compatibility
      const rootOutputPath = path.join(outputRoot, `${baseName}.webp`);
      await convertImage(item.fullPath, rootOutputPath);

      if (convertedCat) {
        convertedCount++;
      }

      if ((i + 1) % 15 === 0 || i === files.length - 1) {
        console.log(`Processed ${i + 1}/${files.length} images...`);
      }
    } catch (err) {
      console.error(`Failed to convert ${item.fileName}:`, err.message);
    }
  }

  console.log(`Processing complete! Converted ${convertedCount} new/updated WebP images.`);
}

convertAll();
