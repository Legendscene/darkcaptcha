const BaseSolver = require('../core/BaseSolver');
const TextSolver = require('./TextSolver');
const MathSolver = require('./MathSolver');

class GenericSolver extends BaseSolver {
  static type = 'generic';

  canSolve(config) {
    return true;
  }

  async solve(config) {
    let result = null;

    if (config.image || config.buffer) {
      result = await this._tryText(config);
      if (result) return result;
    }

    if (config.expression || config.text || config.image) {
      result = await this._tryMath(config);
      if (result) return result;
    }

    return {
      text: null,
      solver: 'GenericSolver',
      confidence: 10,
      fallback: true,
      error: 'Could not determine captcha type or solve it.',
      hint: 'Specify type explicitly: DarkCaptcha.solve({ type: "text", image: "captcha.png" }) ' +
            'or configure an external service: { service: "2captcha", apiKey: "..." }',
      supportedTypes: [
        'text', 'math', 'recaptcha_v2', 'recaptcha_v3', 'hcaptcha',
        'funcaptcha', 'turnstile', 'slider', 'puzzle', 'image',
        'audio', 'coordinate', 'rotate', 'dragdrop', 'icon', 'click',
      ],
    };
  }

  async _tryText(config) {
    try {
      const solver = new TextSolver(this.options);
      const r = await solver.solve(config);
      if (r.text && r.confidence > 20) {
        return {
          text: r.text,
          solver: 'GenericSolver (via TextSolver)',
          confidence: Math.round(r.confidence * 0.85),
          type: 'text',
        };
      }
    } catch {}
    return null;
  }

  async _tryMath(config) {
    try {
      const solver = new MathSolver(this.options);
      const r = await solver.solve(config);
      if (r.answer !== null) {
        return {
          text: r.answer,
          solver: 'GenericSolver (via MathSolver)',
          confidence: Math.round(r.confidence * 0.85),
          type: 'math',
          method: r.method,
        };
      }
    } catch {}
    return null;
  }
}

module.exports = GenericSolver;
