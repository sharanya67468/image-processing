const sharp = require('sharp');
const { pipeline, RawImage } = require('@xenova/transformers');
const fs = require('fs');

async function test() {
  const p = await pipeline('image-classification', 'Xenova/mobilenet_v2_1.0_224');
  console.log("Pipeline loaded");
  
  // Create a red square just to test execution
  const imageBuffer = await sharp({
    create: { width: 224, height: 224, channels: 3, background: { r: 255, g: 0, b: 0 } }
  }).jpeg().toBuffer();
  
  const { data, info } = await sharp(imageBuffer)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
    
  const rawImage = new RawImage(new Uint8Array(data), info.width, info.height, 3);
  const results = await p(rawImage);
  console.log(results);
}
test().catch(console.error);
