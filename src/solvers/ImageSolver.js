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
        return svc.solve({
          type: 'ImageToTextTask',
          body: imageList,
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
