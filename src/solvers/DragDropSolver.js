const BaseSolver = require('../core/BaseSolver');

class DragDropSolver extends BaseSolver {
  static type = 'dragdrop';

  canSolve(config) {
    return config.type === 'dragdrop' || config.type === 'drag_and_drop' || config.type === 'drag-n-drop';
  }

  async solve(config) {
    const { BrowserAutomation } = require('../browser/BrowserAutomation');
    const browser = new BrowserAutomation(this.options);
    const result = await browser.solveDragDrop({
      image: config.image,
      pageUrl: config.pageUrl,
      sourceSelector: config.sourceSelector,
      targetSelector: config.targetSelector,
      instruction: config.instruction,
    });

    return {
      actions: result.actions || [],
      solver: 'DragDropSolver',
      method: result.method || 'browser',
      confidence: 55,
    };
  }
}

module.exports = DragDropSolver;
