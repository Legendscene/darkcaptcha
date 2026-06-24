const axios = require('axios');
const { ServiceError } = require('../core/errors');

class BaseCaptchaService {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.options = options;
    this.baseUrl = '';
    this.pollInterval = options.pollInterval || 5000;
    this.timeout = options.timeout || 120000;
  }

  async solve(taskConfig) {
    const taskId = await this._createTask(taskConfig);
    return this._waitForResult(taskId);
  }

  async _createTask() {
    throw new ServiceError('_createTask not implemented', this.constructor.name);
  }

  async _getTaskResult() {
    throw new ServiceError('_getTaskResult not implemented', this.constructor.name);
  }

  async _waitForResult(taskId) {
    const startTime = Date.now();

    while (Date.now() - startTime < this.timeout) {
      await this._sleep(this.pollInterval);
      const result = await this._getTaskResult(taskId);

      if (result.status === 'ready') {
        return this._parseResult(result);
      }

      if (result.status === 'error' || result.error) {
        throw new ServiceError(
          `Task failed: ${result.error || 'Unknown error'}`,
          this.constructor.name
        );
      }
    }

    throw new ServiceError(
      `Task timed out after ${this.timeout}ms`,
      this.constructor.name
    );
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  _parseResult(result) {
    return { token: result.solution?.token || result.solution?.gRecaptchaResponse || result.solution?.text || result.solution };
  }
}

module.exports = BaseCaptchaService;
