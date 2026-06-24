const BaseSolver = require('../core/BaseSolver');

class CoordinateSolver extends BaseSolver {
  static type = 'coordinate';

  canSolve(config) {
    return config.type === 'coordinate' || config.type === 'coordinates';
  }

  async solve(config) {
    const { image, service, apiKey } = { ...this.options, ...config };

    if (service) {
      const ServiceClass = this._getServiceClass(service);
      if (ServiceClass) {
        const svc = new ServiceClass(apiKey);
        return svc.solve({ type: 'CoordinatesTask', image, question: config.question });
      }
    }

    const { BrowserAutomation } = require('../browser/BrowserAutomation');
    const browser = new BrowserAutomation(this.options);
    const result = await browser.solveCoordinate({
      image, pageUrl: config.pageUrl,
      instruction: config.instruction || config.question,
      selector: config.selector,
    });

    return {
      coordinates: result.coordinates || null,
      solver: 'CoordinateSolver',
      method: result.method || 'browser',
      confidence: 60,
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

module.exports = CoordinateSolver;
