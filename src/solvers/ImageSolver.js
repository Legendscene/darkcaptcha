const fs = require('fs');
const path = require('path');
const BaseSolver = require('../core/BaseSolver');

class ImageSolver extends BaseSolver {
  static type = 'image';

  canSolve(config) {
    return config.type === 'image' ||
      (config.images && config.images.length > 0) ||
      (config.image && config.grid);
  }

  async solve(config) {
    const { images, image, grid, question, service, apiKey } =
      { ...this.options, ...config };

    const imageList = images || (image ? [image] : []);
    const questionText = question || config.text || '';

    if (service) {
      const ServiceClass = this._getServiceClass(service);
      if (ServiceClass) {
        const svc = new ServiceClass(apiKey);
        const bodies = await Promise.all(imageList.map(img => this._toBase64(img)));
        return svc.solve({
          type: 'ImageToTextTask',
          body: bodies.length === 1 ? bodies[0] : bodies,
          question: questionText,
          grid: grid || '3x3',
        });
      }
    }

    const { BrowserAutomation } = require('../browser/BrowserAutomation');
    const browser = new BrowserAutomation(this.options);
    const result = await browser.solveImageCaptcha({
      images: imageList,
      question: questionText,
      pageUrl: config.pageUrl,
    });

    return {
      selections: result.selections || [],
      question: questionText,
      solver: 'ImageSolver',
      method: result.method || 'browser',
      confidence: 65,
    };
  }

  async _toBase64(input) {
    if (Buffer.isBuffer(input)) return input.toString('base64');
    if (input.startsWith('data:')) return input.split(',')[1] || input;
    if (input.startsWith('http://') || input.startsWith('https://')) return input;
    return fs.readFileSync(path.resolve(input)).toString('base64');
  }

  _getServiceClass(name) {
    const map = {
      '2captcha': '../services/TwoCaptchaService',
      'anticaptcha': '../services/AntiCaptchaService',
      'capsolver': '../services/CapSolverService',
    };
    if (!name || !map[name.toLowerCase()]) return null;
    return require(map[name.toLowerCase()]);
  }
}

module.exports = ImageSolver;
