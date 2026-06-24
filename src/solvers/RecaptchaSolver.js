const BaseSolver = require('../core/BaseSolver');
const { ServiceError } = require('../core/errors');

class RecaptchaSolver extends BaseSolver {
  static type = 'recaptcha_v2';
  static types = ['recaptcha_v2', 'recaptcha_v3'];

  canSolve(config) {
    return RecaptchaSolver.types.includes(config.type) ||
      (config.siteKey && config.pageUrl && /6L[e-z]/i.test(config.siteKey));
  }

  async solve(config) {
    const merged = { ...this.options, ...config };
    const version = config.type === 'recaptcha_v3' ? 'v3' : 'v2';

    if (merged.service) {
      return this._solveViaService(merged, version);
    }

    return this._solveLocal(merged, version);
  }

  async _solveLocal(config, version) {
    const { BrowserAutomation } = require('../browser/BrowserAutomation');
    const browser = new BrowserAutomation(this.options);
    try {
      const result = await browser.solveRecaptcha({
        siteKey: config.siteKey,
        pageUrl: config.pageUrl,
        version,
        action: config.action || 'verify',
        minScore: config.minScore || 0.3,
      });

      if (!result.token) {
        throw new Error('Could not obtain reCAPTCHA token via browser automation');
      }

      return {
        token: result.token,
        version,
        solver: 'RecaptchaSolver',
        method: 'browser',
        confidence: 85,
      };
    } finally {
      await browser.close();
    }
  }

  async _solveViaService(config, version) {
    const TwoCaptchaService = require('../services/TwoCaptchaService');
    const AntiCaptchaService = require('../services/AntiCaptchaService');
    const CapSolverService = require('../services/CapSolverService');

    const serviceName = config.service;

    let service;
    switch (serviceName?.toLowerCase()) {
      case '2captcha':
        service = new TwoCaptchaService(config.apiKey);
        break;
      case 'anticaptcha':
        service = new AntiCaptchaService(config.apiKey);
        break;
      case 'capsolver':
        service = new CapSolverService(config.apiKey);
        break;
      default:
        throw new ServiceError(
          'No service configured for reCAPTCHA solving. ' +
          'Either install Playwright (npm install playwright) or set service + apiKey.',
          'RecaptchaSolver'
        );
    }

    const taskParams = {
      siteKey: config.siteKey,
      pageUrl: config.pageUrl,
    };

    return service.solve({
      type: version === 'v3' ? 'RecaptchaV3TaskProxyless' : 'RecaptchaV2TaskProxyless',
      ...taskParams,
      action: config.action || 'verify',
      minScore: config.minScore || 0.3,
    });
  }
}

module.exports = RecaptchaSolver;
