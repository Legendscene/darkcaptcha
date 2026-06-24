const BaseSolver = require('../core/BaseSolver');
const { ServiceError } = require('../core/errors');

class HCaptchaSolver extends BaseSolver {
  static type = 'hcaptcha';

  canSolve(config) {
    return config.type === 'hcaptcha' ||
      (config.siteKey && config.pageUrl &&
       /[a-f0-9]{40}/i.test(config.siteKey) && config.siteKey.length === 40);
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
      const result = await browser.solveHCaptcha({
        siteKey: config.siteKey,
        pageUrl: config.pageUrl,
      });

      if (!result.token) {
        throw new Error('Could not obtain hCaptcha token via browser automation');
      }

      return {
        token: result.token,
        solver: 'HCaptchaSolver',
        method: 'browser',
        confidence: 80,
      };
    } finally {
      await browser.close();
    }
  }

  async _solveViaService(config) {
    const TwoCaptchaService = require('../services/TwoCaptchaService');
    const AntiCaptchaService = require('../services/AntiCaptchaService');
    const CapSolverService = require('../services/CapSolverService');

    const serviceName = config.service;
    let ServiceClass;

    switch (serviceName?.toLowerCase()) {
      case '2captcha': ServiceClass = TwoCaptchaService; break;
      case 'anticaptcha': ServiceClass = AntiCaptchaService; break;
      case 'capsolver': ServiceClass = CapSolverService; break;
      default:
        throw new ServiceError(
          'No captcha service configured for hCaptcha. ' +
          'Install Playwright (npm install playwright) or set service + apiKey.',
          'HCaptchaSolver'
        );
    }

    const svc = new ServiceClass(config.apiKey);
    return svc.solve({
      type: 'HCaptchaTaskProxyless',
      siteKey: config.siteKey,
      pageUrl: config.pageUrl,
    });
  }
}

module.exports = HCaptchaSolver;
