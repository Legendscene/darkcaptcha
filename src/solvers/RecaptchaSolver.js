const BaseSolver = require('../core/BaseSolver');

class RecaptchaSolver extends BaseSolver {
  static type = 'recaptcha_v2';
  static types = ['recaptcha_v2', 'recaptcha_v3'];

  canSolve(config) {
    return RecaptchaSolver.types.includes(config.type) ||
      (config.siteKey && config.pageUrl &&
       /6L[e-z]/i.test(config.siteKey));
  }

  async solve(config) {
    const { siteKey, pageUrl, service, apiKey } = { ...this.options, ...config };
    const version = config.type === 'recaptcha_v3' ? 'v3' : 'v2';
    const action = config.action || 'verify';
    const minScore = config.minScore || 0.3;

    if (service) {
      const result = await this._solveViaService(config, siteKey, pageUrl, version);
      return result;
    }

    const { BrowserAutomation } = require('../browser/BrowserAutomation');
    const browser = new BrowserAutomation(this.options);
    const result = await browser.solveRecaptcha({
      siteKey,
      pageUrl,
      version,
      action,
      minScore,
    });

    return {
      token: result.token,
      version,
      solver: 'RecaptchaSolver',
      method: result.method || (service ? 'service' : 'browser'),
      confidence: 85,
    };
  }

  async _solveViaService(config, siteKey, pageUrl, version) {
    const TwoCaptchaService = require('../services/TwoCaptchaService');
    const AntiCaptchaService = require('../services/AntiCaptchaService');
    const CapSolverService = require('../services/CapSolverService');

    const merged = { ...this.options, ...config };
    const serviceName = merged.service;

    let service;
    switch (serviceName?.toLowerCase()) {
      case '2captcha':
        service = new TwoCaptchaService(config.apiKey || this.options.apiKey);
        break;
      case 'anticaptcha':
        service = new AntiCaptchaService(config.apiKey || this.options.apiKey);
        break;
      case 'capsolver':
        service = new CapSolverService(config.apiKey || this.options.apiKey);
        break;
      default:
        throw new Error(`No service configured for reCAPTCHA solving`);
    }

    return service.solve({
      type: version === 'v3' ? 'RecaptchaV3TaskProxyless' : 'RecaptchaV2TaskProxyless',
      siteKey,
      pageUrl,
      action: merged.action || 'verify',
      minScore: merged.minScore || 0.3,
    });
  }

  getConfidence() {
    return 85;
  }
}

module.exports = RecaptchaSolver;
