const Jimp = require('jimp');
const path = require('path');
const fs = require('fs');
const BaseSolver = require('../core/BaseSolver');
const { OcrError } = require('../core/errors');

class TextSolver extends BaseSolver {
  static type = 'text';

  canSolve(config) {
    return config.type === 'text' || (
      config.image &&
      !config.siteKey &&
      !config.audio
    );
  }

  async solve(config) {
    const imageBuffer = await this._loadImage(config);
    const processed = await this._preprocess(imageBuffer);
    const text = await this._performOcr(processed.image);
    const confidence = processed.confidence;

    return {
      text,
      confidence,
      solver: 'TextSolver',
      preprocessed: processed.preprocessed,
    };
  }

  async _loadImage(config) {
    if (config.buffer) return config.buffer;
    if (config.image) {
      const imgPath = path.resolve(config.image);
      return fs.readFileSync(imgPath);
    }
    throw new OcrError('No image provided for text captcha', 0);
  }

  async _preprocess(buffer) {
    const img = await Jimp.read(buffer);
    const orig = img.clone();

    img.greyscale();
    img.contrast(0.5);
    img.normalize();

    const threshold = this._otsuThreshold(img);
    img.scan(0, 0, img.bitmap.width, img.bitmap.height, (x, y, idx) => {
      const gray = img.bitmap.data[idx];
      const val = gray > threshold ? 255 : 0;
      img.bitmap.data[idx] = val;
      img.bitmap.data[idx + 1] = val;
      img.bitmap.data[idx + 2] = val;
    });

    img.resize(img.bitmap.width * 2, img.bitmap.height * 2);

    const preprocessedBuf = await img.getBufferAsync(Jimp.MIME_PNG);
    const confidence = this._estimateImageQuality(orig);

    return { image: preprocessedBuf, confidence, preprocessed: true };
  }

  _otsuThreshold(img) {
    const histogram = new Array(256).fill(0);
    const total = img.bitmap.width * img.bitmap.height;
    for (let y = 0; y < img.bitmap.height; y++) {
      for (let x = 0; x < img.bitmap.width; x++) {
        const idx = img.getPixelIndex(x, y);
        histogram[img.bitmap.data[idx]]++;
      }
    }

    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * histogram[i];

    let sumB = 0, wB = 0, wF = 0;
    let maxVariance = 0, threshold = 0;

    for (let i = 0; i < 256; i++) {
      wB += histogram[i];
      if (wB === 0) continue;
      wF = total - wB;
      if (wF === 0) break;
      sumB += i * histogram[i];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) ** 2;
      if (between > maxVariance) {
        maxVariance = between;
        threshold = i;
      }
    }
    return threshold;
  }

  _estimateImageQuality(img) {
    img.greyscale();
    let sum = 0, count = 0;
    for (let y = 1; y < img.bitmap.height - 1; y += 3) {
      for (let x = 1; x < img.bitmap.width - 1; x += 3) {
        const c = img.bitmap.data[img.getPixelIndex(x, y)];
        const r = img.bitmap.data[img.getPixelIndex(x + 1, y)];
        const b = img.bitmap.data[img.getPixelIndex(x, y + 1)];
        sum += Math.abs(c - r) + Math.abs(c - b);
        count += 2;
      }
    }
    const avgContrast = sum / count;
    return Math.min(95, Math.max(20, avgContrast * 1.5));
  }

  async _performOcr(buffer) {
    const { createWorker } = require('tesseract.js');
    const worker = await createWorker('eng');
    try {
      const { data } = await worker.recognize(buffer);
      const text = data.text.replace(/[\s\r\n]+/g, '').trim();

      if (!text) {
        throw new OcrError('OCR returned empty text', data.confidence || 0);
      }

      return text;
    } finally {
      await worker.terminate();
    }
  }

  getConfidence() {
    return 60;
  }
}

module.exports = TextSolver;
