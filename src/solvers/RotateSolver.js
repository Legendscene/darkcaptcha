const BaseSolver = require('../core/BaseSolver');

class RotateSolver extends BaseSolver {
  static type = 'rotate';

  canSolve(config) {
    return config.type === 'rotate' || config.type === 'rotation';
  }

  async solve(config) {
    const { BrowserAutomation } = require('../browser/BrowserAutomation');
    const browser = new BrowserAutomation(this.options);
    const result = await browser.solveRotate({
      image: config.image,
      buffer: config.buffer,
      pageUrl: config.pageUrl,
      selector: config.selector || '.rotate-captcha',
    });

    return {
      angle: result.angle || 0,
      steps: result.steps || [],
      solver: 'RotateSolver',
      method: result.method || 'browser',
      confidence: 60,
    };
  }
}

module.exports = RotateSolver;
