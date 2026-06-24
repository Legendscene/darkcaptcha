const axios = require('axios');
const BaseCaptchaService = require('./base');
const { ServiceError } = require('../core/errors');

class TwoCaptchaService extends BaseCaptchaService {
  constructor(apiKey, options = {}) {
    super(apiKey, options);
    this.baseUrl = 'https://2captcha.com';
  }

  async _createTask(taskConfig) {
    const { type, siteKey, pageUrl, ...rest } = taskConfig;
    const method = this._mapType(type);

    const params = new URLSearchParams({
      key: this.apiKey,
      method,
      ...(method === 'userrecaptcha' ? { googlekey: siteKey, pageurl: pageUrl } : {}),
      ...(method === 'hcaptcha' ? { sitekey: siteKey, pageurl: pageUrl } : {}),
      ...(method === 'funcaptcha' ? { publickey: rest.websitePublicKey || siteKey, pageurl: pageUrl } : {}),
      ...(method === 'turnstile' ? { sitekey: siteKey, pageurl: pageUrl } : {}),
      ...rest,
      json: '1',
    });

    const { data } = await axios.post(`${this.baseUrl}/in.php`, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    });

    if (data.status !== 1) {
      throw new ServiceError(
        `2captcha create task failed: ${data.request || 'Unknown error'}`,
        '2captcha',
        data.status
      );
    }

    return data.request;
  }

  async _getTaskResult(taskId) {
    const { data } = await axios.get(`${this.baseUrl}/res.php`, {
      params: {
        key: this.apiKey,
        action: 'get',
        id: taskId,
        json: '1',
      },
      timeout: 10000,
    });

    if (data.status === 0) {
      return { status: 'processing' };
    }

    if (data.status === 1) {
      return { status: 'ready', solution: { token: data.request } };
    }

    return { status: 'error', error: data.request };
  }

  _mapType(type) {
    const map = {
      'RecaptchaV2TaskProxyless': 'userrecaptcha',
      'RecaptchaV3TaskProxyless': 'recaptcha_v3',
      'HCaptchaTaskProxyless': 'hcaptcha',
      'FunCaptchaTaskProxyless': 'funcaptcha',
      'TurnstileTaskProxyless': 'turnstile',
      'ImageToTextTask': 'base64',
      'CoordinatesTask': 'coordinates',
      'AudioTask': 'audio',
      'GeeTestTaskProxyless': 'geetest',
    };
    return map[type] || 'userrecaptcha';
  }
}

module.exports = TwoCaptchaService;
