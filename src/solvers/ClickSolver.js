const BaseSolver = require('../core/BaseSolver');

class ClickSolver extends BaseSolver {
  static type = 'click';

  canSolve(config) {
    return config.type === 'click' || config.type === 'click_order';
  }

  async solve(config) {
    const { BrowserAutomation } = require('../browser/BrowserAutomation');
    const browser = new BrowserAutomation(this.options);
    const result = await browser.solveClickCaptcha({
      image: config.image,
      pageUrl: config.pageUrl,
      instruction: config.instruction || config.question || 'Click in the correct order',
      elements: config.elements,
      selector: config.selector,
      count: config.count,
    });

    return {
      clicks: result.clicks || [],
      order: result.order || [],
      solver: 'ClickSolver',
      method: result.method || 'browser',
      confidence: 55,
    };
  }
}

module.exports = ClickSolver;
