const BaseSolver = require('../core/BaseSolver');
const CLIPSolver = require('../ml/CLIPSolver');

class IconSolver extends BaseSolver {
  static type = 'icon';

  canSolve(config) {
    return config.type === 'icon' || config.type === 'icons';
  }

  async solve(config) {
    const merged = { ...this.options, ...config };
    const instruction = merged.instruction || merged.question || 'Select matching icons';

    const images = this._collectImages(merged);

    if (CLIPSolver.isAvailable()) {
      try {
        const solver = new CLIPSolver();
        const matches = await solver.findMatchingIcons(images, instruction);

        return {
          selections: matches.map(i => ({ index: i })),
          instruction,
          solver: 'IconSolver (AI)',
          method: 'local-ai',
          confidence: matches.length > 0 ? 65 : 0,
        };
      } catch (err) {
        if (!merged.service) return { selections: [], solver: 'IconSolver', error: err.message, confidence: 0 };
      }
    }

    const { BrowserAutomation } = require('../browser/BrowserAutomation');
    const browser = new BrowserAutomation(this.options);
    try {
      const result = await browser.solveIconCaptcha({
        images, pageUrl: config.pageUrl, instruction, selector: config.selector,
      });
      return {
        selections: result.selections || [],
        solver: 'IconSolver', method: result.method || 'browser', confidence: 55,
      };
    } finally { await browser.close(); }
  }

  _collectImages(config) {
    if (config.images && config.images.length > 0) return config.images;
    if (config.image) return [config.image];
    if (config.buffer) return [config.buffer];
    return [];
  }
}

module.exports = IconSolver;
