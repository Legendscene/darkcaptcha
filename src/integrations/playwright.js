const DarkCaptcha = require('../../index');

class CaptchaWatchdog {
  constructor(page, options = {}) {
    this.page = page;
    this.options = {
      service: null,
      apiKey: null,
      autoClick: true,
      timeout: 30000,
      ...options,
    };
    this._solver = null;
    this._solved = new Set();
  }

  async start() {
    if (this.options.service && this.options.apiKey) {
      this._solver = new DarkCaptcha({
        service: this.options.service,
        apiKey: this.options.apiKey,
      });
    }

    await this._injectInterceptor();
    this._startPolling();
  }

  async _injectInterceptor() {
    await this.page.addInitScript(() => {
      const origDefine = Object.defineProperty;
      const origAppend = Node.prototype.appendChild;
      const watchFrames = new Set();

      const checkForCaptcha = (node) => {
        if (node.tagName === 'IFRAME') {
          const src = (node.src || '').toLowerCase();
          if (src.includes('recaptcha') || src.includes('hcaptcha') ||
              src.includes('arkoselabs') || src.includes('cf-turnstile') ||
              src.includes('funcaptcha')) {
            watchFrames.add(node);
            node.addEventListener('load', () => {
              window.__darkcaptcha_frames = window.__darkcaptcha_frames || [];
              window.__darkcaptcha_frames.push({
                src: node.src,
                type: src.includes('recaptcha') ? 'recaptcha' :
                      src.includes('hcaptcha') ? 'hcaptcha' :
                      src.includes('arkoselabs') || src.includes('funcaptcha') ? 'funcaptcha' :
                      src.includes('cf-turnstile') ? 'turnstile' : 'unknown',
              });
            });
          }
        }
        if (node.src && typeof node.src === 'string') {
          const s = node.src.toLowerCase();
          if (s.includes('recaptcha') || s.includes('hcaptcha') ||
              s.includes('turnstile') || s.includes('funcaptcha')) {
            window.__darkcaptcha_frames = window.__darkcaptcha_frames || [];
            window.__darkcaptcha_frames.push({ src: node.src, time: Date.now() });
          }
        }
      };

      document.addEventListener('DOMNodeInserted', (e) => {
        if (e.target) checkForCaptcha(e.target);
      });

      window.__darkcaptcha_captchaDetected = () => {
        return window.__darkcaptcha_frames && window.__darkcaptcha_frames.length > 0;
      };

      window.__darkcaptcha_getCaptchas = () => {
        return window.__darkcaptcha_frames || [];
      };

      window.__darkcaptcha_setToken = (token, type) => {
        const textarea = document.querySelector(
          type === 'hcaptcha' ? 'textarea[name="h-captcha-response"]' :
          type === 'turnstile' ? 'textarea[name="cf-turnstile-response"]' :
          'textarea[name="g-recaptcha-response"], #g-recaptcha-response'
        );
        if (textarea) {
          textarea.value = token;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const callback = type === 'hcaptcha' ? window.hcaptchaCallback :
                         window.__recaptchaCallback || window.verifyCallback;
        if (typeof callback === 'function') {
          try { callback(token); } catch {}
        }
        try {
          const entries = Object.entries(window.___grecaptcha_cfg?.clients || {});
          for (const [, client] of entries) {
            if (client && typeof client.callback === 'function') {
              client.callback(token);
            }
          }
        } catch {}
      };
    });
  }

  _startPolling() {
    this._pollTimer = setInterval(() => this._check(), 2000);
  }

  stop() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  async _check() {
    try {
      const hasCaptcha = await this.page.evaluate(() => {
        return window.__darkcaptcha_captchaDetected ? window.__darkcaptcha_captchaDetected() : false;
      });

      if (!hasCaptcha) {
        const domCheck = await this.page.evaluate(() => {
          const frames = document.querySelectorAll('iframe');
          for (const f of frames) {
            const src = (f.src || '').toLowerCase();
            if (src.includes('recaptcha') || src.includes('hcaptcha') ||
                src.includes('turnstile') || src.includes('funcaptcha') ||
                src.includes('arkoselabs')) return true;
          }
          return !!document.querySelector('textarea[name="g-recaptcha-response"], ' +
            'textarea[name="h-captcha-response"], ' +
            'textarea[name="cf-turnstile-response"]');
        });
        if (!domCheck) return;
      }

      const captchas = await this.page.evaluate(() => {
        return window.__darkcaptcha_getCaptchas ? window.__darkcaptcha_getCaptchas() : [];
      });

      const pageUrl = this.page.url();

      for (const cap of captchas) {
        const cacheKey = cap.src + '|' + pageUrl;
        if (this._solved.has(cacheKey)) continue;

        const type = this._detectType(cap.src || '');
        const siteKey = this._extractSiteKey(cap.src || '');

        if (siteKey) {
          await this._solveOne({ type, siteKey, pageUrl, cacheKey });
        }
      }

      await this._checkDomCaptchas(pageUrl);
    } catch (err) {
      if (err.message && err.message.includes('detached')) {
        this.stop();
      }
    }
  }

  async _checkDomCaptchas(pageUrl) {
    try {
      const domInfo = await this.page.evaluate(() => {
        const recaptcha = document.querySelector('textarea[name="g-recaptcha-response"]');
        const hcaptcha = document.querySelector('textarea[name="h-captcha-response"]');
        const turnstile = document.querySelector('textarea[name="cf-turnstile-response"]');
        const sitekeyEl = document.querySelector('[data-sitekey], [data-site-key]');

        return {
          hasRecaptcha: !!recaptcha,
          hasHcaptcha: !!hcaptcha,
          hasTurnstile: !!turnstile,
          sitekey: sitekeyEl?.getAttribute('data-sitekey') ||
                  sitekeyEl?.getAttribute('data-site-key') || null,
          recaptchaFilled: recaptcha?.value?.length > 0,
          hcaptchaFilled: hcaptcha?.value?.length > 0,
          turnstileFilled: turnstile?.value?.length > 0,
        };
      });

      if (domInfo.hasRecaptcha && !domInfo.recaptchaFilled && domInfo.sitekey) {
        const key = `recaptcha:${domInfo.sitekey}:${pageUrl}`;
        if (!this._solved.has(key)) {
          await this._solveOne({
            type: 'recaptcha_v2', siteKey: domInfo.sitekey,
            pageUrl, cacheKey: key,
          });
        }
      }

      if (domInfo.hasHcaptcha && !domInfo.hcaptchaFilled && domInfo.sitekey) {
        const key = `hcaptcha:${domInfo.sitekey}:${pageUrl}`;
        if (!this._solved.has(key)) {
          await this._solveOne({
            type: 'hcaptcha', siteKey: domInfo.sitekey,
            pageUrl, cacheKey: key,
          });
        }
      }

      if (domInfo.hasTurnstile && !domInfo.turnstileFilled && domInfo.sitekey) {
        const key = `turnstile:${domInfo.sitekey}:${pageUrl}`;
        if (!this._solved.has(key)) {
          await this._solveOne({
            type: 'turnstile', siteKey: domInfo.sitekey,
            pageUrl, cacheKey: key,
          });
        }
      }
    } catch {}
  }

  _detectType(src) {
    if (src.includes('recaptcha')) return 'recaptcha_v2';
    if (src.includes('hcaptcha')) return 'hcaptcha';
    if (src.includes('turnstile')) return 'turnstile';
    if (src.includes('funcaptcha') || src.includes('arkoselabs')) return 'funcaptcha';
    const lo = src.toLowerCase();
    if (lo.includes('recaptcha')) return 'recaptcha_v2';
    return 'recaptcha_v2';
  }

  _extractSiteKey(src) {
    const match = src.match(/[?&]k=([^&]+)/);
    if (match) return decodeURIComponent(match[1]);
    const match2 = src.match(/[?&]sitekey=([^&]+)/i);
    if (match2) return decodeURIComponent(match2[1]);
    const match3 = src.match(/[?&]key=([^&]+)/);
    if (match3) return decodeURIComponent(match3[1]);
    return null;
  }

  async _solveOne({ type, siteKey, pageUrl, cacheKey }) {
    try {
      let result;

      if (this._solver) {
        result = await this._solver.resolve({
          type, siteKey, pageUrl,
        });
      } else {
        result = await DarkCaptcha.solve({
          type, siteKey, pageUrl,
          ...(this.options.service ? { service: this.options.service } : {}),
          ...(this.options.apiKey ? { apiKey: this.options.apiKey } : {}),
        });
      }

      if (result.token || result.text) {
        const token = result.token || result.text;
        await this.page.evaluate(({ t, tp }) => {
          if (window.__darkcaptcha_setToken) {
            window.__darkcaptcha_setToken(t, tp);
          }
        }, { t: token, tp: type });

        this._solved.add(cacheKey);

        if (this.options.autoClick) {
          await this.page.waitForTimeout(1000);
          const btn = await this.page.$('button[type="submit"], input[type="submit"], ' +
            'button:has-text("Continue"), button:has-text("Verify"), ' +
            'button:has-text("Submit"), [class*="submit"], [class*="continue"]');
          if (btn) {
            try { await btn.click(); } catch {}
          }
        }
      }
    } catch (err) {
      this._solved.add(cacheKey);
    }
  }
}

async function autoSolve(page, options = {}) {
  const watchdog = new CaptchaWatchdog(page, options);
  await watchdog.start();
  return watchdog;
}

module.exports = { CaptchaWatchdog, autoSolve };
