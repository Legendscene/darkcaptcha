const { DarkCaptchaError } = require('./errors');

class BaseSolver {
  constructor(options = {}) {
    this.options = options;
    this.name = this.constructor.name;
  }

  canSolve(captchaConfig) {
    throw new DarkCaptchaError(
      `canSolve() not implemented in ${this.name}`,
      'NOT_IMPLEMENTED'
    );
  }

  async solve(captchaConfig) {
    throw new DarkCaptchaError(
      `solve() not implemented in ${this.name}`,
      'NOT_IMPLEMENTED'
    );
  }

  getConfidence() {
    return 0;
  }
}

module.exports = BaseSolver;
