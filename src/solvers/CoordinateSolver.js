const fs = require('fs');
const path = require('path');
const BaseSolver = require('../core/BaseSolver');
const CLIPSolver = require('../ml/CLIPSolver');

class CoordinateSolver extends BaseSolver {
  static type = 'coordinate';

  canSolve(config) {
    return config.type === 'coordinate' || config.type === 'coordinates';
  }

  async solve(config) {
    const merged = { ...this.options, ...config };
    const imageBuffer = await this._loadImage(merged);
    const instruction = merged.instruction || merged.question || '';
    const gridSize = merged.gridSize || 3;

    if (CLIPSolver.isAvailable() && instruction) {
      try {
        const solver = new CLIPSolver();
        const matches = await solver.findCoordinateOnImage(imageBuffer, instruction, gridSize);

        return {
          coordinates: matches.map(m => ({ x: Math.round(m.x), y: Math.round(m.y), score: Math.round(m.score * 100) / 100 })),
          grid: gridSize,
          instruction,
          solver: 'CoordinateSolver (AI)',
          method: 'local-ai',
          confidence: Math.round((matches[0]?.score || 0) * 100),
        };
      } catch (err) {
        if (!merged.service) return { coordinates: [], solver: 'CoordinateSolver', error: err.message, confidence: 0 };
      }
    }

    if (merged.service) {
      const map = { '2captcha': '../services/TwoCaptchaService', 'anticaptcha': '../services/AntiCaptchaService', 'capsolver': '../services/CapSolverService' };
      const svcPath = map[merged.service?.toLowerCase()];
      if (svcPath) {
        const ServiceClass = require(svcPath);
        const svc = new ServiceClass(merged.apiKey);
        return svc.solve({ type: 'CoordinatesTask', body: imageBuffer.toString('base64'), question: instruction });
      }
    }

    return {
      coordinates: [], instruction,
      solver: 'CoordinateSolver',
      method: 'none',
      confidence: 0,
      error: instruction ? 'Install @xenova/transformers for AI: npm install @xenova/transformers' : 'Provide instruction text: { question: "click on the bus" }',
    };
  }

  async _loadImage(config) {
    if (config.buffer) return config.buffer;
    if (config.image) return fs.readFileSync(path.resolve(config.image));
    if (config.images && config.images.length > 0) return config.images[0];
    throw new Error('No image provided for coordinate captcha');
  }
}

module.exports = CoordinateSolver;
