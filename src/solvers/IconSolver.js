const BaseSolver = require('../core/BaseSolver');

class IconSolver extends BaseSolver {
  static type = 'icon';

  canSolve(config) {
    return config.type === 'icon' || config.type === 'icons';
  }

  async solve(config) {
    const { BrowserAutomation } = require('../browser/BrowserAutomation');
    const browser = new BrowserAutomation(this.options);
    const result = await browser.solveIconCaptcha({
      images: config.images,
      image: config.image,
      pageUrl: config.pageUrl,
      instruction: config.instruction || config.question || 'Select matching icons',
      selector: config.selector,
    });

    return {
      selections: result.selections || [],
      solver: 'IconSolver',
      method: result.method || 'browser',
      confidence: 55,
    };
  }
}

module.exports = IconSolver;
