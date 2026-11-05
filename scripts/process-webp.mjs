import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const inputDir = path.resolve("hinhanh");
const outputDir = path.resolve("public/images/hinhanh-webp");

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function convertAll() {
  if (!fs.existsSync(inputDir)) {
    console.log("No hinhanh directory found.");
    return;
  }

  const files = fs.readdirSync(inputDir).filter((f) =>
    /\.(jpe?g|png|webp|avif)$/i.test(f)
  );

  console.log(`Found ${files.length} images in hinhanh/. Converting to WebP...`);

  let count = 0;
  for (const file of files) {
    const inputPath = path.join(inputDir, file);
    const basename = path.parse(file).name;
    const outputPath = path.join(outputDir, `${basename}.webp`);

    // Only convert if output doesn't exist or input is newer
    if (fs.existsSync(outputPath)) {
      const inStat = fs.statSync(inputPath);
      const outStat = fs.statSync(outputPath);
      if (outStat.mtimeMs >= inStat.mtimeMs) {
        continue;
      }
    }

    try {
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
      count++;
      if (count % 10 === 0 || count === files.length) {
        console.log(`Converted ${count}/${files.length} images...`);
      }
    } catch (err) {
      console.error(`Failed to convert ${file}:`, err.message);
    }
  }

  console.log(`Processing complete! Processed ${count} WebP images in public/images/hinhanh-webp.`);
}

convertAll();

