const BaseSolver = require('../core/BaseSolver');

class TurnstileSolver extends BaseSolver {
  static type = 'turnstile';

  canSolve(config) {
    return config.type === 'turnstile' ||
      (config.siteKey && /0x4[A-Fa-f0-9]{32,}/i.test(config.siteKey));
  }

  async solve(config) {
    const { siteKey, pageUrl, service, apiKey, action, cData, chlPageData } =
      { ...this.options, ...config };

    if (service) {
      const ServiceClass = this._getServiceClass(service);
      if (ServiceClass) {
        const svc = new ServiceClass(apiKey);
        return svc.solve({
          type: 'TurnstileTaskProxyless',
          websiteURL: pageUrl,
          websiteKey: siteKey,
          action: action || '',
          cData: cData || '',
          chlPageData: chlPageData || '',
        });
      }
    }

    const { BrowserAutomation } = require('../browser/BrowserAutomation');
    const browser = new BrowserAutomation(this.options);
    const result = await browser.solveTurnstile({ siteKey, pageUrl });

    return {
      token: result.token,
      solver: 'TurnstileSolver',
      method: result.method || 'browser',
      confidence: 75,
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

module.exports = TurnstileSolver;
