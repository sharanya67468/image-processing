const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store uploads in memory
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ─── Route: Upload & process image ────────────────────────────────────────────
app.post('/process', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    const feature = req.body.feature || 'resize';
    const imageBuffer = req.file.buffer;
    const metadata = await sharp(imageBuffer).metadata();

    let processedBuffer;
    let info = {};

    switch (feature) {
      case 'smartCropping': {
        // Simulate face-detection smart crop (centre crop like Rekognition would do)
        const size = Math.min(metadata.width, metadata.height);
        const left = Math.floor((metadata.width - size) / 2);
        const top  = Math.floor((metadata.height - size) / 2);
        processedBuffer = await sharp(imageBuffer)
          .extract({ left, top, width: size, height: size })
          .resize(400, 400)
          .jpeg({ quality: 90 })
          .toBuffer();
        info = { operation: 'Smart Crop (centre)', outputSize: '400×400' };
        break;
      }

      case 'contentModeration': {
        // Simulate Rekognition AI content moderation
        // (For this local demo, we use the filename to simulate visual detection)
        const filename = (req.file.originalname || '').toLowerCase();
        const unsafeKeywords = ['drink', 'smoke', 'cigar', 'beer', 'wine', 'alcohol', 'alco', 'cocktail', 'whiskey', 'tobacco', 'vape', 'glass'];
        const isUnsafe = unsafeKeywords.some(keyword => filename.includes(keyword));

        if (isUnsafe) {
          // Flagged as unsafe -> Blur the image
          processedBuffer = await sharp(imageBuffer)
            .blur(25)
            .jpeg({ quality: 85 })
            .toBuffer();
          info = { operation: 'Content Moderation', note: 'UNSAFE IMAGE ❌' };
        } else {
          // Safe -> Return original
          processedBuffer = await sharp(imageBuffer)
            .jpeg({ quality: 90 })
            .toBuffer();
          info = { operation: 'Content Moderation', note: 'Image is Safe ✅' };
        }
        break;
      }

      case 'resize': {
        const width  = parseInt(req.body.width)  || 800;
        const height = parseInt(req.body.height) || 600;
        processedBuffer = await sharp(imageBuffer)
          .resize(width, height, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 90 })
          .toBuffer();
        info = { operation: 'Resize', outputSize: `${width}×${height}` };
        break;
      }

      case 'grayscale': {
        processedBuffer = await sharp(imageBuffer)
          .grayscale()
          .jpeg({ quality: 90 })
          .toBuffer();
        info = { operation: 'Grayscale Conversion' };
        break;
      }

      case 'compress': {
        const quality = parseInt(req.body.quality) || 40;
        processedBuffer = await sharp(imageBuffer)
          .jpeg({ quality: quality })
          .toBuffer();
        info = { operation: 'Compress', note: `Quality set to ${quality}%` };
        break;
      }


      case 'rotate': {
        const angle = parseInt(req.body.angle) || 90;
        processedBuffer = await sharp(imageBuffer)
          .rotate(angle)
          .jpeg({ quality: 90 })
          .toBuffer();
        info = { operation: `Rotate ${angle}°` };
        break;
      }

      default:
        return res.status(400).json({ error: 'Invalid feature specified' });
    }

    const base64 = processedBuffer.toString('base64');
    const processedMeta = await sharp(processedBuffer).metadata();

    res.json({
      success: true,
      feature,
      info,
      original: {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: req.file.size,
      },
      processed: {
        width: processedMeta.width,
        height: processedMeta.height,
        format: processedMeta.format,
        size: processedBuffer.length,
      },
      image: `data:image/jpeg;base64,${base64}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Processing failed: ' + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n  🚀  Serverless Image Processor running locally`);
  console.log(`  👉  Open: http://localhost:${PORT}\n`);
});
