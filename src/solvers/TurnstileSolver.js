const BaseSolver = require('../core/BaseSolver');

class TurnstileSolver extends BaseSolver {
  static type = 'turnstile';

  canSolve(config) {
    return config.type === 'turnstile' ||
      (config.siteKey && /0x4[A-Fa-f0-9]{32,}/i.test(config.siteKey));
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
      const result = await browser.solveTurnstile({
        siteKey: config.siteKey,
        pageUrl: config.pageUrl,
      });

      return {
        token: result.token,
        solver: 'TurnstileSolver',
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
    if (!path) throw new Error('No service configured for Turnstile');
    const ServiceClass = require(path);
    const svc = new ServiceClass(config.apiKey);
    return svc.solve({
      type: 'TurnstileTaskProxyless',
      websiteURL: config.pageUrl,
      websiteKey: config.siteKey,
    });
  }
}

module.exports = TurnstileSolver;
