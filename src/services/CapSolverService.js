const axios = require('axios');
const BaseCaptchaService = require('./base');
const { ServiceError } = require('../core/errors');

class CapSolverService extends BaseCaptchaService {
  constructor(apiKey, options = {}) {
    super(apiKey, options);
    this.baseUrl = 'https://api.capsolver.com';
    this.pollInterval = options.pollInterval || 3000;
  }

  async _createTask(taskConfig) {
    const task = this._buildTask(taskConfig);

    const { data } = await axios.post(`${this.baseUrl}/createTask`, {
      clientKey: this.apiKey,
      task,
    }, { timeout: 15000 });

    if (data.errorId !== 0 && data.errorId !== undefined) {
      throw new ServiceError(
        `CapSolver create task failed: ${data.errorDescription || data.errorMessage || 'Unknown error'}`,
        'CapSolver',
        data.errorId
      );
    }

    if (data.errorCode) {
      throw new ServiceError(
        `CapSolver create task failed: ${data.errorDescription || data.errorCode}`,
        'CapSolver'
      );
    }

    return data.taskId;
  }

  async _getTaskResult(taskId) {
    const { data } = await axios.post(`${this.baseUrl}/getTaskResult`, {
      clientKey: this.apiKey,
      taskId,
    }, { timeout: 10000 });

    if (data.status === 'processing') {
      return { status: 'processing' };
    }

    if (data.status === 'ready') {
      return { status: 'ready', solution: data.solution };
    }

    if (data.errorId || data.errorCode) {
      return {
        status: 'error',
        error: data.errorDescription || data.errorCode || 'Unknown error',
      };
    }

    return { status: 'processing' };
  }

  _buildTask(config) {
    const { type, siteKey, pageUrl, ...rest } = config;

    if (type === 'RecaptchaV2TaskProxyless' || type === 'ReCaptchaV2TaskProxyless') {
      return {
        type: 'ReCaptchaV2TaskProxyless',
        websiteURL: pageUrl,
        websiteKey: siteKey,
        ...rest,
      };
    }

    if (type === 'RecaptchaV3TaskProxyless' || type === 'ReCaptchaV3TaskProxyless') {
      return {
        type: 'ReCaptchaV3TaskProxyless',
        websiteURL: pageUrl,
        websiteKey: siteKey,
        pageAction: rest.action || 'verify',
        minScore: rest.minScore || 0.3,
        ...rest,
      };
    }

    return {
      type: type || 'ReCaptchaV2TaskProxyless',
      websiteURL: pageUrl,
      websiteKey: siteKey,
      ...rest,
    };
  }

  _parseResult(result) {
    return {
      token: result.solution?.gRecaptchaResponse ||
             result.solution?.token ||
             result.solution?.captchaKey ||
             result.solution?.text ||
             result.solution,
    };
  }
}

module.exports = CapSolverService;
