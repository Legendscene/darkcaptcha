const DarkCaptcha = require('../../index');

class CaptchaWatchdog {
  constructor(page, options = {}) {
    this.page = page;
    this.options = {
      autoClick: true,
      timeout: 60000,
      useAI: true,
      ...options,
    };
    this._solver = null;
    this._solved = new Set();
  }

  async start() {
    await this._injectInterceptor();
    this._startPolling();
  }

  async _injectInterceptor() {
    await this.page.addInitScript(() => {
      window.__darkcaptcha_frames = [];

      const origAppend = Node.prototype.appendChild;
      Node.prototype.appendChild = function (node) {
        if (node.tagName === 'IFRAME') {
          const src = (node.src || '').toLowerCase();
          if (['recaptcha', 'hcaptcha', 'arkoselabs', 'funcaptcha', 'turnstile'].some(s => src.includes(s))) {
            window.__darkcaptcha_frames.push({ src: node.src, time: Date.now() });
          }
        }
        return origAppend.call(this, node);
      };

      document.addEventListener('DOMNodeInserted', (e) => {
        if (e.target?.tagName === 'IFRAME') {
          const src = (e.target.src || '').toLowerCase();
          if (['recaptcha', 'hcaptcha', 'arkoselabs', 'funcaptcha', 'turnstile'].some(s => src.includes(s))) {
            window.__darkcaptcha_frames.push({ src: e.target.src, time: Date.now() });
          }
        }
      });

      window.__darkcaptcha_setToken = (token, type) => {
        const sel = type === 'hcaptcha'
          ? 'textarea[name="h-captcha-response"]'
          : type === 'turnstile'
          ? 'textarea[name="cf-turnstile-response"]'
          : 'textarea[name="g-recaptcha-response"], #g-recaptcha-response';

        const ta = document.querySelector(sel);
        if (ta) {
          ta.value = token;
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          ta.dispatchEvent(new Event('change', { bubbles: true }));
        }

        try {
          const entries = Object.entries(window.___grecaptcha_cfg?.clients || {});
          for (const [, client] of entries) {
            if (client && typeof client.callback === 'function') client.callback(token);
          }
        } catch {}

        if (typeof window.verifyCallback === 'function') window.verifyCallback(token);
      };
    });
  }

  _startPolling() {
    this._pollTimer = setInterval(() => this._check(), 1500);
  }

  stop() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  async _check() {
    try {
      const pageUrl = this.page.url();
      await this._handleTokenBased(pageUrl);
      await this._handleHCaptchaChallenge(pageUrl);
      await this._handleRecaptchaChallenge(pageUrl);
    } catch (err) {
      if (err.message?.includes('detached') || err.message?.includes('Target closed')) {
        this.stop();
      }
    }
  }

  async _handleTokenBased(pageUrl) {
    const info = await this.page.evaluate(() => {
      const els = {
        recaptcha: document.querySelector('textarea[name="g-recaptcha-response"]'),
        hcaptcha: document.querySelector('textarea[name="h-captcha-response"]'),
        turnstile: document.querySelector('textarea[name="cf-turnstile-response"]'),
      };
      const sk = document.querySelector('[data-sitekey], [data-site-key]');
      return {
        recaptchaToken: els.recaptcha?.value || null,
        hcaptchaToken: els.hcaptcha?.value || null,
        turnstileToken: els.turnstile?.value || null,
        sitekey: sk?.getAttribute('data-sitekey') || sk?.getAttribute('data-site-key') || null,
      };
    });

    const checks = [
      { type: 'recaptcha_v2', token: info.recaptchaToken },
      { type: 'hcaptcha', token: info.hcaptchaToken },
      { type: 'turnstile', token: info.turnstileToken },
    ];

    for (const c of checks) {
      if (c.token === '') {
        const key = `${c.type}:${info.sitekey}:${pageUrl}`;
        if (!this._solved.has(key) && info.sitekey) {
          await this._solveToken(c.type, info.sitekey, pageUrl, key);
        }
      }
    }
  }

  async _handleHCaptchaChallenge(pageUrl) {
    const challenge = await this._getHCaptchaChallenge();
    if (!challenge) return;

    const key = `hcaptcha-challenge:${pageUrl}:${challenge.prompt}`;
    if (this._solved.has(key)) return;

    console.error('[DarkCaptcha] hCaptcha image challenge detected. Solving with AI...');

    const tiles = challenge.tiles.filter(t => t != null);
    if (tiles.length === 0) return;

    const result = await DarkCaptcha.solve({
      type: 'image',
      images: tiles,
      question: challenge.prompt,
      useAI: true,
    });

    if (result.selections && result.selections.length > 0) {
      await this._clickTiles('hcaptcha', result.selections, challenge.challengeId);
      this._solved.add(key);

      const token = await this._waitForToken('hcaptcha');
      if (token && this.options.autoClick) {
        await this._clickSubmit();
      }
    }
  }

  async _handleRecaptchaChallenge(pageUrl) {
    const challenge = await this._getRecaptchaChallenge();
    if (!challenge) return;

    const key = `recaptcha-challenge:${pageUrl}:${challenge.prompt}`;
    if (this._solved.has(key)) return;

    console.error('[DarkCaptcha] reCAPTCHA image challenge detected. Solving with AI...');

    const tiles = challenge.tiles.filter(t => t != null);
    if (tiles.length === 0) return;

    const result = await DarkCaptcha.solve({
      type: 'image',
      images: tiles,
      question: challenge.prompt,
      useAI: true,
    });

    if (result.selections && result.selections.length > 0) {
      await this._clickTiles('recaptcha', result.selections, challenge.challengeId);
      this._solved.add(key);

      const verified = await this._waitForChallengeComplete('recaptcha');
      if (verified && this.options.autoClick) {
        await this._clickSubmit();
      }
    }
  }

  async _getHCaptchaChallenge() {
    try {
      for (const f of this.page.frames()) {
        if (f.url().includes('hcaptcha.com')) {
          const data = await f.evaluate(() => {
            const promptEl = document.querySelector('.challenge-container .prompt, .task-description, [class*="prompt"]');
            const prompt = promptEl?.textContent?.trim() || '';
            const tiles = [];
            document.querySelectorAll('.image-grid img, .image-grid canvas, .challenge-img, [class*="image"] img')
              .forEach(el => {
                const src = el.src || el.toDataURL?.();
                if (src) tiles.push(src);
              });
            const challengeId = document.querySelector('[name="challengeKey"]')?.value ||
                                document.querySelector('input[name="c"]')?.value || '';
            return { prompt, tiles, challengeId };
          });
          if (data.tiles.length > 0 && data.prompt) return data;
        }
      }
    } catch {}
    return null;
  }

  async _getRecaptchaChallenge() {
    try {
      for (const f of this.page.frames()) {
        if (f.url().includes('recaptcha/api2')) {
          const data = await f.evaluate(() => {
            const promptEl = document.querySelector('.rc-imageselect-desc, .rc-imageselect-instructions, [class*="rc-imageselect"] strong');
            const prompt = promptEl?.textContent?.trim() || '';
            const tiles = [];
            document.querySelectorAll('.rc-image-tile-wrapper img, .rc-image-tile-wrapper canvas')
              .forEach(el => {
                const src = el.src || el.toDataURL?.();
                if (src) tiles.push(src);
              });
            const challengeId = document.querySelector('[name="c"]')?.value || '';
            return { prompt, tiles, challengeId };
          });
          if (data.tiles.length > 0 && data.prompt) return data;
        }
      }
    } catch {}
    return null;
  }

  async _clickTiles(type, indices, challengeId) {
    try {
      const hostFrame = type === 'hcaptcha'
        ? this.page.frameLocator('iframe[src*="hcaptcha.com"]').first()
        : this.page.frameLocator('iframe[src*="recaptcha/api2"]').first();

      for (const idx of indices) {
        const tile = hostFrame.locator('.image-grid img, .challenge-img, .rc-image-tile-wrapper img').nth(idx);
        if (await tile.isVisible().catch(() => false)) {
          await tile.click();
          await this.page.waitForTimeout(300);
        }
      }

      await this.page.waitForTimeout(500);

      const submitBtn = type === 'hcaptcha'
        ? hostFrame.locator('button[type="submit"], button:has-text("Verify"), #verifyButton')
        : hostFrame.locator('#recaptcha-verify-button, button:has-text("Verify")');

      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click();
      }
    } catch (err) {
      console.error('[DarkCaptcha] Failed to click tiles:', err.message);
    }
  }

  async _waitForToken(type) {
    const sel = type === 'hcaptcha'
      ? 'textarea[name="h-captcha-response"]'
      : type === 'turnstile'
      ? 'textarea[name="cf-turnstile-response"]'
      : 'textarea[name="g-recaptcha-response"]';

    for (let i = 0; i < 15; i++) {
      const val = await this.page.evaluate((s) => document.querySelector(s)?.value, sel);
      if (val && val.length > 10) return val;
      await new Promise(r => setTimeout(r, 1000));
    }
    return null;
  }

  async _waitForChallengeComplete(type) {
    for (let i = 0; i < 15; i++) {
      const val = await this.page.evaluate(() => {
        return document.querySelector('textarea[name="g-recaptcha-response"]')?.value || null;
      });
      if (val && val.length > 10) return true;
      await new Promise(r => setTimeout(r, 1000));
    }
    return false;
  }

  async _solveToken(type, siteKey, pageUrl, cacheKey) {
    try {
      const result = await DarkCaptcha.solve({ type, siteKey, pageUrl });

      if (result.token) {
        await this.page.evaluate(({ t, tp }) => {
          if (window.__darkcaptcha_setToken) window.__darkcaptcha_setToken(t, tp);
        }, { t: result.token, tp: type });

        this._solved.add(cacheKey);

        if (this.options.autoClick) {
          await this.page.waitForTimeout(800);
          await this._clickSubmit();
        }
      }
    } catch (err) {
      this._solved.add(cacheKey);
    }
  }

  async _clickSubmit() {
    try {
      const btn = await this.page.$(
        'button[type="submit"], input[type="submit"], ' +
        'button:has-text("Continue"), button:has-text("Verify"), ' +
        'button:has-text("Submit"), button:has-text("Register"), ' +
        'button:has-text("Sign Up"), [class*="submit"], [class*="continue"]'
      );
      if (btn) await btn.click();
    } catch {}
  }
}

async function autoSolve(page, options = {}) {
  const watchdog = new CaptchaWatchdog(page, options);
  await watchdog.start();
  return watchdog;
}

module.exports = { CaptchaWatchdog, autoSolve };
