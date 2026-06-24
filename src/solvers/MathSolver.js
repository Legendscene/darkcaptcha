const BaseSolver = require('../core/BaseSolver');

class MathSolver extends BaseSolver {
  static type = 'math';

  canSolve(config) {
    return config.type === 'math' || (
      !config.image &&
      !config.siteKey &&
      typeof config.expression === 'string'
    );
  }

  async solve(config) {
    let expression = config.expression || config.text || '';

    if (!expression && config.image) {
      const TextSolver = require('./TextSolver');
      const ts = new TextSolver(this.options);
      const result = await ts.solve(config);
      expression = result.text;
    }

    if (!expression) {
      return {
        answer: null,
        solver: 'MathSolver',
        error: 'No expression found',
        confidence: 0,
      };
    }

    expression = expression
      .replace(/[×xX]/g, '*')
      .replace(/[÷]/g, '/')
      .replace(/[=]/g, '')
      .replace(/\?/g, '')
      .trim();

    const operators = ['+', '-', '*', '/', '%'];
    let result = null;
    let method = null;

    for (const op of operators) {
      const parts = expression.split(op).map(s => s.trim());
      if (parts.length === 2) {
        const a = parseFloat(parts[0]);
        const b = parseFloat(parts[1]);
        if (!isNaN(a) && !isNaN(b)) {
          switch (op) {
            case '+': result = a + b; break;
            case '-': result = a - b; break;
            case '*': result = a * b; break;
            case '/': result = b !== 0 ? a / b : null; break;
            case '%': result = a % b; break;
          }
          if (result !== null) {
            method = op;
            break;
          }
        }
      }
    }

    if (result === null) {
      const wordMap = {
        plus: '+', minus: '-', times: '*', multiplied: '*',
        divided: '/', 'added to': '+', 'subtract': '-',
      };
      for (const [word, op] of Object.entries(wordMap)) {
        if (expression.toLowerCase().includes(word)) {
          const cleaned = expression.toLowerCase().replace(word, op);
          const parts = cleaned.split(op).map(s => s.trim());
          if (parts.length === 2) {
            const a = parseFloat(parts[0].replace(/[^0-9.-]/g, ''));
            const b = parseFloat(parts[1].replace(/[^0-9.-]/g, ''));
            if (!isNaN(a) && !isNaN(b)) {
              switch (op) {
                case '+': result = a + b; break;
                case '-': result = a - b; break;
                case '*': result = a * b; break;
                case '/': result = b !== 0 ? a / b : null; break;
              }
              if (result !== null) { method = op; break; }
            }
          }
        }
      }
    }

    if (result === null) {
      const numbers = expression.match(/\d+/g);
      if (numbers && numbers.length >= 2) {
        const nums = numbers.map(Number).sort((a, b) => b - a);
        result = nums[0] + nums[1];
        method = '+';
      }
    }

    const answer = Number.isInteger(result) ? result : Math.round(result * 100) / 100;

    return {
      answer: answer !== null ? String(answer) : null,
      method,
      expression: config.expression || expression,
      solver: 'MathSolver',
      confidence: result !== null ? 90 : 10,
    };
  }

  getConfidence() {
    return 90;
  }
}

module.exports = MathSolver;
