const fs = require('fs');
const path = require('path');
const BaseSolver = require('../core/BaseSolver');
const CLIPSolver = require('../ml/CLIPSolver');

class RotateSolver extends BaseSolver {
  static type = 'rotate';

  canSolve(config) {
    return config.type === 'rotate' || config.type === 'rotation';
  }

  async solve(config) {
    const merged = { ...this.options, ...config };
    const imageBuffer = await this._loadImage(merged);

    if (CLIPSolver.isAvailable()) {
      try {
        const solver = new CLIPSolver();
        const angle = await solver.findBestAngle(imageBuffer);
        const steps = this._generateRotationSteps(angle);

        return {
          angle,
          steps,
          solver: 'RotateSolver (AI)',
          method: 'local-ai',
          confidence: angle > 0 ? 65 : 85,
        };
      } catch (err) {
        if (!merged.service) return { angle: 0, steps: [], solver: 'RotateSolver', error: err.message, confidence: 0 };
      }
    }

    const { BrowserAutomation } = require('../browser/BrowserAutomation');
    const browser = new BrowserAutomation(this.options);
    try {
      const result = await browser.solveRotate({
        buffer: imageBuffer, pageUrl: config.pageUrl, selector: config.selector,
      });
      return {
        angle: result.angle || 0, steps: result.steps || [],
        solver: 'RotateSolver', method: result.method || 'browser', confidence: 60,
      };
    } finally { await browser.close(); }
  }

  async _loadImage(config) {
    if (config.buffer) return config.buffer;
    if (config.image) return fs.readFileSync(path.resolve(config.image));
    throw new Error('No image provided for rotate captcha');
  }

  _generateRotationSteps(angle) {
    if (angle === 0) return [];
    const steps = [];
    const totalSteps = Math.min(30, Math.max(5, Math.floor(angle / 5)));
    for (let i = 1; i <= totalSteps; i++) {
      const progress = 1 - Math.pow(1 - i / totalSteps, 3);
      steps.push({ angle: Math.round(angle * progress), t: i * 50 });
    }
    return steps;
  }
}

module.exports = RotateSolver;
