const Jimp = require('jimp');

class Detector {
  async detect(config = {}) {
    const { image, type, siteKey, audio, pageUrl } = config;

    if (config.type && config.type !== 'auto') {
      return { type: config.type, serviceRequired: this._isServiceRequired(config.type) };
    }

    if (siteKey && pageUrl) {
      return this._detectBySiteKey(siteKey);
    }

    if (audio) {
      return { type: 'audio', serviceRequired: true };
    }

    if (!image && !config.buffer) {
      return { type: 'math', serviceRequired: false };
    }

    try {
      const buffer = image
        ? require('fs').readFileSync(image)
        : config.buffer;
      return await this._analyzeImage(buffer, config);
    } catch {
      return { type: 'generic', serviceRequired: false };
    }
  }

  _isServiceRequired(type) {
    const serviceTypes = ['recaptcha_v2', 'recaptcha_v3', 'hcaptcha', 'funcaptcha',
      'turnstile', 'image', 'audio', 'coordinate', 'icon', 'click'];
    return serviceTypes.includes(type);
  }

  _detectBySiteKey(siteKey) {
    if (/^6L[a-z0-9_]+$/i.test(siteKey)) {
      return { type: 'recaptcha_v2', serviceRequired: true };
    }
    if (/^[a-f0-9]{40}$/i.test(siteKey) && siteKey.length === 40) {
      return { type: 'hcaptcha', serviceRequired: true };
    }
    if (/^0x4[A-Fa-f0-9]{32,}$/i.test(siteKey)) {
      return { type: 'turnstile', serviceRequired: true };
    }
    if (/^[A-Z0-9]{32}$/i.test(siteKey)) {
      return { type: 'funcaptcha', serviceRequired: true };
    }
    return { type: 'recaptcha_v2', serviceRequired: true };
  }

  async _analyzeImage(buffer) {
    const img = await Jimp.read(buffer);
    const { width, height } = img.bitmap;

    if (this._isSlider(width, height)) {
      return { type: 'slider', serviceRequired: false };
    }

    const hasGrid = await this._detectGrid(img);
    if (hasGrid) {
      return { type: 'image', serviceRequired: true };
    }

    const textConfidence = await this._estimateTextConfidence(img);
    if (textConfidence > 35) {
      return { type: 'text', serviceRequired: false };
    }

    if (width > 150 && height > 150) {
      return { type: 'puzzle', serviceRequired: false };
    }

    if (Math.abs(width / height - 1) < 0.15 && width > 100) {
      return { type: 'rotate', serviceRequired: false };
    }

    return { type: 'text', serviceRequired: false };
  }

  _isSlider(w, h) {
    const ratio = w / h;
    return ratio > 2.5 && ratio < 4.5 && h < 100;
  }

  async _detectGrid(img) {
    const w = img.bitmap.width;
    const h = img.bitmap.height;

    if (w < 200 || h < 200) return false;

    const gray = img.clone().greyscale();
    let horizontalLines = 0, verticalLines = 0;

    for (let y = 1; y < h - 1; y++) {
      for (let x = 2; x < w - 2; x++) {
        const idx = gray.getPixelIndex(x, y);
        const left = gray.bitmap.data[idx - 1];
        const center = gray.bitmap.data[idx];
        const right = gray.bitmap.data[idx + 1];
        if (Math.abs(center - left) > 50 && Math.abs(center - right) > 50) {
          verticalLines++;
          break;
        }
      }
    }

    for (let x = 1; x < w - 1; x++) {
      for (let y = 2; y < h - 2; y++) {
        const idx = gray.getPixelIndex(x, y);
        const up = gray.bitmap.data[idx - w];
        const center = gray.bitmap.data[idx];
        const down = gray.bitmap.data[idx + w];
        if (Math.abs(center - up) > 50 && Math.abs(center - down) > 50) {
          horizontalLines++;
          break;
        }
      }
    }

    const gridThreshold = Math.max(2, Math.min(w, h) * 0.01);
    return horizontalLines > gridThreshold && verticalLines > gridThreshold;
  }

  async _estimateTextConfidence(img) {
    try {
      const gray = img.clone().greyscale();
      const contrast = this._measureContrast(gray);
      const edgeCount = this._countEdges(gray);
      const totalPixels = gray.bitmap.width * gray.bitmap.height;
      const edgeDensity = edgeCount / totalPixels;

      if (contrast > 40 && edgeDensity > 0.02 && edgeDensity < 0.3) {
        return 70 + Math.min(30, contrast / 2);
      }
      if (contrast > 20) {
        return 40 + Math.min(30, contrast / 3);
      }
      return 10 + contrast;
    } catch {
      return 30;
    }
  }

  _measureContrast(img) {
    const pixels = [];
    for (let y = 0; y < img.bitmap.height; y += 4) {
      for (let x = 0; x < img.bitmap.width; x += 4) {
        const idx = img.getPixelIndex(x, y);
        pixels.push(img.bitmap.data[idx]);
      }
    }
    const min = Math.min(...pixels);
    const max = Math.max(...pixels);
    return max - min;
  }

  _countEdges(img) {
    let edges = 0;
    const w = img.bitmap.width;
    const h = img.bitmap.height;
    for (let y = 1; y < h - 1; y += 2) {
      for (let x = 1; x < w - 1; x += 2) {
        const center = img.bitmap.data[img.getPixelIndex(x, y)];
        const right = img.bitmap.data[img.getPixelIndex(x + 1, y)];
        const bottom = img.bitmap.data[img.getPixelIndex(x, y + 1)];
        if (Math.abs(center - right) > 30 || Math.abs(center - bottom) > 30) {
          edges++;
        }
      }
    }
    return edges;
  }
}

module.exports = Detector;
