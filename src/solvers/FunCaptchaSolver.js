const BaseSolver = require('../core/BaseSolver');

class FunCaptchaSolver extends BaseSolver {
  static type = 'funcaptcha';

  canSolve(config) {
    return config.type === 'funcaptcha' ||
      (config.siteKey && config.pageUrl && /[A-Z0-9]{32}/i.test(config.siteKey));
  }

  async solve(config) {
    const { siteKey, pageUrl, service, apiKey, publicKey, surl } = { ...this.options, ...config };
    const serviceUrl = surl || 'https://client-api.arkoselabs.com';
    const pk = publicKey || siteKey;

    if (service) {
      const ServiceClass = this._getServiceClass(service);
      if (ServiceClass) {
        const svc = new ServiceClass(apiKey);
        return svc.solve({
          type: 'FunCaptchaTaskProxyless',
          websiteURL: pageUrl,
          websitePublicKey: pk,
          funcaptchaApiJSURL: serviceUrl,
        });
      }
    }

    const { BrowserAutomation } = require('../browser/BrowserAutomation');
    const browser = new BrowserAutomation(this.options);
    const result = await browser.solveFunCaptcha({ siteKey: pk, pageUrl, surl: serviceUrl });

    return {
      token: result.token,
      solver: 'FunCaptchaSolver',
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

module.exports = FunCaptchaSolver;
