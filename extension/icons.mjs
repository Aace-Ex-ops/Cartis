import sharp from "sharp";

const svg = new URL("./icons/icon.svg", import.meta.url).pathname;

for (const size of [16, 32, 48, 128]) {
  await sharp(svg).resize(size, size).png().toFile(`icons/icon-${size}.png`);
}
console.log("icons written");
