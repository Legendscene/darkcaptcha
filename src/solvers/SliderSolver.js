const Jimp = require('jimp');
const path = require('path');
const fs = require('fs');
const BaseSolver = require('../core/BaseSolver');

class SliderSolver extends BaseSolver {
  static type = 'slider';

  canSolve(config) {
    return config.type === 'slider' || (
      config.image && !config.siteKey
    );
  }

  async solve(config) {
    const buffer = await this._loadImage(config);
    const gapPosition = await this._findGap(buffer);
    const trackWidth = config.trackWidth || 300;
    const distance = gapPosition ? gapPosition.x : trackWidth / 2;
    const steps = this._generateSmoothCurve(distance, trackWidth);

    return {
      distance,
      steps,
      trackWidth,
      solver: 'SliderSolver',
      confidence: gapPosition ? 75 : 40,
      details: { gapPosition },
    };
  }

  async _loadImage(config) {
    if (config.buffer) return config.buffer;
    if (config.image) return fs.readFileSync(path.resolve(config.image));
    throw new Error('No image provided for slider captcha');
  }

  async _findGap(buffer) {
    try {
      const img = await Jimp.read(buffer);
      const w = img.bitmap.width;
      const h = img.bitmap.height;

      const bgColor = this._getDominantEdgeColor(img, w, h);
      let bestX = -1, bestDiff = 0;

      for (let x = 10; x < w - 10; x++) {
        let diffSum = 0;
        const sampleY = Math.floor(h * 0.4);
        for (let y = sampleY; y < Math.min(sampleY + 30, h); y++) {
          const idx = img.getPixelIndex(x, y);
          const r = img.bitmap.data[idx];
          const g = img.bitmap.data[idx + 1];
          const b = img.bitmap.data[idx + 2];
          diffSum += Math.abs(r - bgColor.r) + Math.abs(g - bgColor.g) + Math.abs(b - bgColor.b);
        }
        const avgDiff = diffSum / Math.min(30, h - sampleY);

        if (avgDiff > bestDiff) {
          bestDiff = avgDiff;
          bestX = x;
        }
      }

      if (bestX < 0) return null;
      return { x: bestX, y: Math.floor(h * 0.4), diff: bestDiff };
    } catch {
      return null;
    }
  }

  _getDominantEdgeColor(img, w, h) {
    let r = 0, g = 0, b = 0, count = 0;
    const edges = [
      { x: 0, y: 0, w: 5, h },
      { x: w - 5, y: 0, w: 5, h },
      { x: 0, y: 0, w, h: 5 },
      { x: 0, y: h - 5, w, h: 5 },
    ];
    for (const e of edges) {
      for (let y = e.y; y < Math.min(e.y + e.h, h); y++) {
        for (let x = e.x; x < Math.min(e.x + e.w, w); x++) {
          const idx = img.getPixelIndex(x, y);
          r += img.bitmap.data[idx];
          g += img.bitmap.data[idx + 1];
          b += img.bitmap.data[idx + 2];
          count++;
        }
      }
    }
    return { r: r / count, g: g / count, b: b / count };
  }

  _generateSmoothCurve(distance, trackWidth) {
    const steps = [];
    const totalSteps = Math.min(50, Math.max(15, Math.floor(distance / 3)));
    let current = 0, velocity = 0;
    const target = distance;
    const midPoint = target * 0.7;

    for (let i = 0; i < totalSteps; i++) {
      const progress = i / totalSteps;
      const easing = progress < 0.7
        ? 1 - Math.pow(1 - progress / 0.7, 3)
        : 1 - Math.pow(1 - progress, 2);

      const targetPos = target * easing;
      velocity += (targetPos - current) * 0.2;
      velocity *= 0.85;
      current += velocity;

      if (current > 0) {
        steps.push({ x: Math.round(Math.min(current, trackWidth)), y: 0, t: i * 10 });
      }
    }

    if (steps.length > 0) {
      const last = steps[steps.length - 1];
      if (last.x < target) {
        steps.push({ x: Math.round(target), y: 0, t: (steps.length + 1) * 10 });
      }
    }

    return steps;
  }
}

module.exports = SliderSolver;
