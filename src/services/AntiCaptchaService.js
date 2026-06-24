const axios = require('axios');
const BaseCaptchaService = require('./base');
const { ServiceError } = require('../core/errors');

class AntiCaptchaService extends BaseCaptchaService {
  constructor(apiKey, options = {}) {
    super(apiKey, options);
    this.baseUrl = 'https://api.anti-captcha.com';
    this.pollInterval = options.pollInterval || 3000;
  }

  async _createTask(taskConfig) {
    const task = this._buildTask(taskConfig);

    const { data } = await axios.post(`${this.baseUrl}/createTask`, {
      clientKey: this.apiKey,
      task,
      ...(task.type === 'NoCaptchaTaskProxyless' ? { softId: 0 } : {}),
    }, { timeout: 15000 });

    if (data.errorId !== 0) {
      throw new ServiceError(
        `Anti-Captcha create task failed: ${data.errorDescription}`,
        'AntiCaptcha',
        data.errorId
      );
    }

    return data.taskId;
  }

  async _getTaskResult(taskId) {
    const { data } = await axios.post(`${this.baseUrl}/getTaskResult`, {
      clientKey: this.apiKey,
      taskId,
    }, { timeout: 10000 });

    if (data.errorId !== 0) {
      return { status: 'error', error: data.errorDescription };
    }

    if (data.status === 'processing') {
      return { status: 'processing' };
    }

    if (data.status === 'ready') {
      return { status: 'ready', solution: data.solution };
    }

    return { status: 'error', error: 'Unknown status' };
  }

  _buildTask(config) {
    const { type, siteKey, pageUrl, ...rest } = config;

    if (config.type === 'RecaptchaV2TaskProxyless' || config.type === 'NoCaptchaTaskProxyless') {
      return {
        type: 'NoCaptchaTaskProxyless',
        websiteURL: pageUrl,
        websiteKey: siteKey,
        ...rest,
      };
    }

    if (config.type === 'RecaptchaV3TaskProxyless') {
      return {
        type: 'RecaptchaV3TaskProxyless',
        websiteURL: pageUrl,
        websiteKey: siteKey,
        minScore: rest.minScore || 0.3,
        pageAction: rest.action || 'verify',
        ...rest,
      };
    }

    if (config.type === 'HCaptchaTaskProxyless') {
      return {
        type: 'HCaptchaTaskProxyless',
        websiteURL: pageUrl,
        websiteKey: siteKey,
        ...rest,
      };
    }

    if (config.type === 'FunCaptchaTaskProxyless') {
      return {
        type: 'FunCaptchaTaskProxyless',
        websiteURL: pageUrl,
        funcaptchaApiJSURL: rest.funcaptchaApiJSURL || 'https://client-api.arkoselabs.com',
        websitePublicKey: rest.websitePublicKey || siteKey,
        ...rest,
      };
    }

    if (config.type === 'TurnstileTaskProxyless') {
      return {
        type: 'TurnstileTaskProxyless',
        websiteURL: pageUrl,
        websiteKey: siteKey,
        ...rest,
      };
    }

    return {
      type: 'NoCaptchaTaskProxyless',
      websiteURL: pageUrl,
      websiteKey: siteKey,
      ...rest,
    };
  }

  _parseResult(result) {
    return {
      token: result.solution?.gRecaptchaResponse ||
             result.solution?.token ||
             result.solution?.text ||
             result.solution,
    };
  }
}

module.exports = AntiCaptchaService;
