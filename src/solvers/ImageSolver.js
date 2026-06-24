const fs = require('fs');
const path = require('path');
const BaseSolver = require('../core/BaseSolver');
const CLIPSolver = require('../ml/CLIPSolver');
const { isMLAvailable } = require('../ml/ModelManager');

class ImageSolver extends BaseSolver {
  static type = 'image';

  canSolve(config) {
    return config.type === 'image' ||
      (config.images && config.images.length > 0) ||
      (config.image && config.grid);
  }

  async solve(config) {
    const merged = { ...this.options, ...config };
    const tiles = merged.images || (merged.image ? [merged.image] : []);
    const question = merged.question || merged.text || '';

    if (tiles.length > 0 && question && CLIPSolver.isAvailable()) {
      try {
        const solver = new CLIPSolver();
        const buffers = await Promise.all(tiles.map(t => this._toBuffer(t)));
        const indices = await solver.selectMatchingTiles(buffers, question);

        return {
          selections: indices,
          question,
          solver: 'ImageSolver (AI)',
          method: 'local-ai',
          confidence: 70,
          totalTiles: tiles.length,
        };
      } catch (err) {
        if (!merged.service) {
          return {
            selections: [],
            question,
            solver: 'ImageSolver',
            method: 'local-ai',
            error: `AI solving failed: ${err.message}`,
            confidence: 0,
          };
        }
      }
    }

    if (merged.service) {
      return this._solveViaService(merged, tiles, question);
    }

    return {
      selections: [],
      question,
      solver: 'ImageSolver',
      method: 'none',
      confidence: 0,
      error: CLIPSolver.isAvailable()
        ? 'Provide images array + question text for AI solving'
        : 'Install @xenova/transformers for local AI solving: npm install @xenova/transformers',
    };
  }

  async _toBuffer(input) {
    if (Buffer.isBuffer(input)) return input;
    if (typeof input === 'string') {
      if (input.startsWith('data:')) {
        return Buffer.from(input.split(',')[1] || input, 'base64');
      }
      if (input.startsWith('http://') || input.startsWith('https://')) {
        const axios = require('axios');
        const { data } = await axios.get(input, { responseType: 'arraybuffer' });
        return Buffer.from(data);
      }
      return fs.readFileSync(path.resolve(input));
    }
    return input;
  }

  async _solveViaService(config, tiles, question) {
    const serviceName = config.service;
    const map = {
      '2captcha': '../services/TwoCaptchaService',
      'anticaptcha': '../services/AntiCaptchaService',
      'capsolver': '../services/CapSolverService',
    };
    const svcPath = map[serviceName?.toLowerCase()];
    if (!svcPath) throw new Error('No service configured');
    const ServiceClass = require(svcPath);
    const svc = new ServiceClass(config.apiKey);
    const bodies = await Promise.all(tiles.map(t => this._toBase64(t)));
    return svc.solve({
      type: 'ImageToTextTask',
      body: bodies.length === 1 ? bodies[0] : bodies,
      question,
      grid: config.grid || '3x3',
    });
  }

  async _toBase64(input) {
    if (Buffer.isBuffer(input)) return input.toString('base64');
    if (typeof input === 'string') {
      if (input.startsWith('data:')) return input.split(',')[1] || input;
      if (input.startsWith('http://') || input.startsWith('https://')) return input;
      return fs.readFileSync(path.resolve(input)).toString('base64');
    }
    return input;
  }
}

module.exports = ImageSolver;
