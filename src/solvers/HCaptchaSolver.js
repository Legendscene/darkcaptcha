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
    const { siteKey, pageUrl, service, apiKey } = { ...this.options, ...config };

    if (service) {
      return this._solveViaService(config, siteKey, pageUrl);
    }

    const { BrowserAutomation } = require('../browser/BrowserAutomation');
    const browser = new BrowserAutomation(this.options);
    const result = await browser.solveHCaptcha({ siteKey, pageUrl });

    return {
      token: result.token,
      solver: 'HCaptchaSolver',
      method: result.method || 'browser',
      confidence: 80,
    };
  }

  async _solveViaService(config, siteKey, pageUrl) {
    const ServiceClass = this._getServiceClass(config.service);
    if (!ServiceClass) throw new ServiceError('No captcha service configured. Set service + apiKey in config.', 'HCaptchaSolver');
    const svc = new ServiceClass(config.apiKey || this.options.apiKey);
    return svc.solve({ type: 'HCaptchaTaskProxyless', siteKey, pageUrl });
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

module.exports = HCaptchaSolver;
