const BaseSolver = require('../core/BaseSolver');

class PuzzleSolver extends BaseSolver {
  static type = 'puzzle';

  canSolve(config) {
    return config.type === 'puzzle' || (
      config.image && !config.siteKey
    );
  }

  async solve(config) {
    const { BrowserAutomation } = require('../browser/BrowserAutomation');
    const browser = new BrowserAutomation(this.options);
    const result = await browser.solvePuzzle({
      image: config.image,
      buffer: config.buffer,
      pageUrl: config.pageUrl,
      selector: config.selector || '.puzzle-captcha',
    });

    return {
      solution: result.solution || result.coordinates,
      solver: 'PuzzleSolver',
      method: result.method || 'browser',
      confidence: 70,
    };
  }
}

module.exports = PuzzleSolver;
