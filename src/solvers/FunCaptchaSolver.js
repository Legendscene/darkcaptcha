const BaseSolver = require('../core/BaseSolver');

class FunCaptchaSolver extends BaseSolver {
  static type = 'funcaptcha';

  canSolve(config) {
    return config.type === 'funcaptcha';
  }

  async solve(config) {
    const merged = { ...this.options, ...config };

    if (merged.service) {
      return this._solveViaService(merged);
    }

    return this._solveLocal(merged);
  }

  async _solveLocal(config) {
    const { BrowserAutomation } = require('../browser/BrowserAutomation');
    const browser = new BrowserAutomation(this.options);
    try {
      const result = await browser.solveFunCaptcha({
        siteKey: config.siteKey,
        pageUrl: config.pageUrl,
        surl: config.surl,
      });

      return {
        token: result.token,
        solver: 'FunCaptchaSolver',
        method: 'browser',
        confidence: 75,
      };
    } finally {
      await browser.close();
    }
  }

  async _solveViaService(config) {
    const serviceName = config.service;
    const map = {
      '2captcha': '../services/TwoCaptchaService',
      'anticaptcha': '../services/AntiCaptchaService',
      'capsolver': '../services/CapSolverService',
    };
    const path = map[serviceName?.toLowerCase()];
    if (!path) throw new Error('No service configured for FunCAPTCHA');
    const ServiceClass = require(path);
    const svc = new ServiceClass(config.apiKey);
    return svc.solve({
      type: 'FunCaptchaTaskProxyless',
      websiteURL: config.pageUrl,
      websitePublicKey: config.siteKey,
      funcaptchaApiJSURL: config.surl || 'https://client-api.arkoselabs.com',
    });
  }
}

module.exports = FunCaptchaSolver;
