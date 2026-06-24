const { BrowserError } = require('../core/errors');
const { transcribeAudio } = require('../utils/audioTranscriber');

class BrowserAutomation {
  constructor(options = {}) {
    this.options = options;
    this.browser = null;
  }

  async _ensureBrowser() {
    if (this.browser) return;
    try {
      const { chromium } = require('playwright');
      this.browser = await chromium.launch({
        headless: this.options.headless !== false,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    } catch (err) {
      throw new BrowserError(
        'Playwright is required for browser captcha solving.\n' +
        'Install: npm install playwright && npx playwright install chromium',
        'playwright'
      );
    }
  }

  async _createPage() {
    await this._ensureBrowser();
    const context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
    });
    return { page: await context.newPage(), context };
  }

  async _cleanup(context) {
    try { await context.close(); } catch {}
  }

  async solveRecaptcha({ siteKey, pageUrl, version = 'v2' }) {
    const { page, context } = await this._createPage();
    try {
      await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });

      if (version === 'v2') {
        const frame = page.frameLocator('iframe[src*="recaptcha/api2"]').first();
        try {
          await frame.locator('.recaptcha-checkbox-border').click({ timeout: 8000 });
          await page.waitForTimeout(2000);
        } catch {
          const allFrames = page.frameLocator('iframe[src*="recaptcha"]');
          try {
            await allFrames.first().locator('.recaptcha-checkbox-border').click({ timeout: 3000 });
            await page.waitForTimeout(2000);
          } catch {}
        }
      }

      let token = await page.evaluate(() => {
        const ta = document.querySelector('textarea[name="g-recaptcha-response"]');
        if (ta?.value) return ta.value;
        const clients = window.___grecaptcha_cfg?.clients;
        if (clients) {
          for (const id of Object.keys(clients)) {
            const val = clients[id]?.getResponse();
            if (val) return val;
          }
        }
        return null;
      });

      if (!token && version === 'v2') {
        token = await this._tryRecaptchaAudioChallenge(page);
      }

      if (!token) {
        throw new BrowserError(
          'Could not get reCAPTCHA token. Try:\n' +
          '  1. Set service + apiKey for external solving\n' +
          '  2. Make sure the page fully loaded before calling solve()'
        );
      }

      return { token, method: 'browser' };
    } finally {
      await this._cleanup(context);
    }
  }

  async _tryRecaptchaAudioChallenge(page) {
    try {
      const challengeFrame = page.frameLocator('iframe[src*="recaptcha/api2"]').first();
      const audioBtn = challengeFrame.locator('#recaptcha-audio-button');
      if (await audioBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await audioBtn.click();
        await page.waitForTimeout(2000);

        const audioSrc = await challengeFrame.evaluate(() => {
          const audio = document.querySelector('#audio-source');
          return audio?.src || null;
        });

        if (audioSrc) {
          const response = await page.context().request.get(audioSrc);
          const audioBuffer = await response.body();
          const result = await transcribeAudio(audioBuffer);

          if (result.text) {
            const input = challengeFrame.locator('#audio-response');
            await input.fill(result.text);
            await challengeFrame.locator('#recaptcha-verify-button').click();
            await page.waitForTimeout(3000);

            return await page.evaluate(() => {
              const ta = document.querySelector('textarea[name="g-recaptcha-response"]');
              return ta?.value || null;
            });
          }
        }
      }
    } catch {}
    return null;
  }

  async solveHCaptcha({ siteKey, pageUrl }) {
    const { page, context } = await this._createPage();
    try {
      await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });

      const frame = page.frameLocator('iframe[src*="hcaptcha.com"]').first();
      try {
        await frame.locator('#checkbox').click({ timeout: 8000 });
        await page.waitForTimeout(2000);
      } catch {
        try {
          await frame.locator('.hcaptcha-box').click({ timeout: 3000 });
          await page.waitForTimeout(2000);
        } catch {}
      }

      const token = await page.evaluate(() => {
        return document.querySelector('textarea[name="h-captcha-response"]')?.value || null;
      });

      if (!token) {
        token = await this._tryHCaptchaAudioChallenge(page);
      }

      if (!token) {
        throw new BrowserError(
          'Could not get hCaptcha token. Try:\n' +
          '  1. The page might require image selection (needs external service)\n' +
          '  2. Set service + apiKey for external solving'
        );
      }

      return { token, method: 'browser' };
    } finally {
      await this._cleanup(context);
    }
  }

  async _tryHCaptchaAudioChallenge(page) {
    try {
      const frame = page.frameLocator('iframe[src*="hcaptcha.com"]').first();
      const audioBtn = frame.locator('#audioButton, [aria-label="audio"], .audio-control');
      if (await audioBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await audioBtn.click();
        await page.waitForTimeout(2000);
        const audioSrc = await frame.evaluate(() => {
          const el = document.querySelector('audio source, audio');
          return el?.src || el?.currentSrc || null;
        });
        if (audioSrc) {
          const response = await page.context().request.get(audioSrc);
          const buf = await response.body();
          const result = await transcribeAudio(buf);
          if (result.text) {
            const input = frame.locator('#audioResponse, input[placeholder*="answer"]');
            await input.fill(result.text);
            await frame.locator('#verifyButton, button:has-text("Verify")').click();
            await page.waitForTimeout(3000);
            return await page.evaluate(() =>
              document.querySelector('textarea[name="h-captcha-response"]')?.value || null
            );
          }
        }
      }
    } catch {}
    return null;
  }

  async solveFunCaptcha({ siteKey, pageUrl, surl }) {
    const { page, context } = await this._createPage();
    try {
      await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });

      for (const frame of page.frames()) {
        const url = frame.url();
        if (url.includes('arkoselabs') || url.includes('funcaptcha')) {
          await page.waitForTimeout(2000);
          const token = await frame.evaluate(() => {
            const el = document.querySelector('input[name="fc-token"]');
            return el?.value || null;
          });
          if (token) return { token, method: 'browser' };
        }
      }
      throw new BrowserError('Could not obtain FunCAPTCHA token');
    } finally {
      await this._cleanup(context);
    }
  }

  async solveTurnstile({ siteKey, pageUrl }) {
    const { page, context } = await this._createPage();
    try {
      await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);

      const token = await page.evaluate(() => {
        const input = document.querySelector('input[name="cf-turnstile-response"]');
        return input?.value || null;
      });

      if (!token) {
        throw new BrowserError('Could not obtain Turnstile token');
      }

      return { token, method: 'browser' };
    } finally {
      await this._cleanup(context);
    }
  }

  async solveSlider(page, { distance, trackWidth }) {
    try {
      const slider = await page.$('[class*="slide"], [class*="slider"], [class*="drag"], .nc_iconfont');
      if (!slider) throw new BrowserError('Slider element not found');

      const box = await slider.boundingBox();
      if (!box) throw new BrowserError('Could not get slider bounds');

      const startX = box.x + box.width / 2;
      const startY = box.y + box.height / 2;

      await page.mouse.move(startX, startY);
      await page.mouse.down();

      const steps = Math.min(50, Math.max(10, Math.floor(distance / 2)));
      for (let i = 1; i <= steps; i++) {
        const progress = i / steps;
        const ease = 1 - Math.pow(1 - progress, 3);
        const x = startX + distance * ease;
        const y = startY + Math.sin(progress * Math.PI * 2) * 2;
        await page.mouse.move(x, y);
        await page.waitForTimeout(10);
      }

      await page.mouse.up();
      await page.waitForTimeout(500);
      return { success: true };
    } catch (err) {
      throw new BrowserError(`Slider execution failed: ${err.message}`);
    }
  }

  async solveDragDrop({ pageUrl, sourceSelector, targetSelector }) {
    if (!sourceSelector || !targetSelector) {
      throw new BrowserError('sourceSelector and targetSelector required for drag-drop captcha');
    }

    const { page, context } = await this._createPage();
    try {
      if (pageUrl) await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });

      const source = await page.$(sourceSelector);
      const target = await page.$(targetSelector);

      if (!source || !target) {
        throw new BrowserError('Drag-drop elements not found on page');
      }

      const srcBox = await source.boundingBox();
      const tgtBox = await target.boundingBox();

      if (!srcBox || !tgtBox) {
        throw new BrowserError('Could not get drag-drop element bounds');
      }

      const startX = srcBox.x + srcBox.width / 2;
      const startY = srcBox.y + srcBox.height / 2;
      const endX = tgtBox.x + tgtBox.width / 2;
      const endY = tgtBox.y + tgtBox.height / 2;

      await page.mouse.move(startX, startY);
      await page.mouse.down();

      const steps = 30;
      for (let i = 1; i <= steps; i++) {
        const progress = i / steps;
        const x = startX + (endX - startX) * progress;
        const y = startY + (endY - startY) * progress + Math.sin(progress * Math.PI) * 3;
        await page.mouse.move(x, y);
        await page.waitForTimeout(15);
      }

      await page.mouse.up();
      await page.waitForTimeout(500);

      return { actions: [{ type: 'drag', from: srcBox, to: tgtBox }], method: 'browser' };
    } finally {
      await this._cleanup(context);
    }
  }

  async solveRotate({ buffer, pageUrl, selector, targetAngle = 180 }) {
    const { page, context } = await this._createPage();
    try {
      if (pageUrl) await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });

      const el = selector ? await page.$(selector) : await page.$('[class*="rotate"], [class*="wheel"]');
      if (!el) throw new BrowserError('Rotate element not found');

      const box = await el.boundingBox();
      if (!box) throw new BrowserError('Could not get rotate element bounds');

      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      const radius = Math.min(box.width, box.height) * 0.4;
      const angle = targetAngle;
      const steps = Math.max(10, Math.min(50, Math.floor(Math.abs(angle) / 5)));

      await page.mouse.move(cx + radius, cy);
      await page.mouse.down();

      const direction = angle >= 0 ? 1 : -1;
      const absAngle = Math.abs(angle);
      for (let i = 1; i <= steps; i++) {
        const progress = i / steps;
        const ease = 1 - Math.pow(1 - progress, 3);
        const theta = direction * (absAngle * ease * Math.PI) / 180;
        const x = cx + radius * Math.cos(theta);
        const y = cy + radius * Math.sin(theta);
        await page.mouse.move(x, y);
        await page.waitForTimeout(12);
      }

      await page.mouse.up();
      await page.waitForTimeout(500);
      return { angle, steps: [{ x: cx, y: cy, angle }], method: 'browser' };
    } finally {
      await this._cleanup(context);
    }
  }

  async solveCoordinate({ image, pageUrl, instruction, selector, coordinates }) {
    const { page, context } = await this._createPage();
    try {
      if (pageUrl) await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });

      const container = selector ? await page.$(selector) : await page.$('[class*="captcha"], [class*="image"]');
      if (!container) throw new BrowserError('Coordinate container not found');

      const box = await container.boundingBox();
      if (!box) throw new BrowserError('Could not get container bounds');

      const coords = coordinates && coordinates.length > 0 ? coordinates : [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }];
      for (const c of coords) {
        const clickX = box.x + (c.x / (c.naturalWidth || box.width)) * box.width;
        const clickY = box.y + (c.y / (c.naturalHeight || box.height)) * box.height;
        await page.mouse.click(clickX, clickY);
        await page.waitForTimeout(150);
      }

      return { coordinates: coords, method: 'browser' };
    } finally {
      await this._cleanup(context);
    }
  }

  async solveIconCaptcha({ images, pageUrl, instruction, selector }) {
    const { page, context } = await this._createPage();
    try {
      if (pageUrl) await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });

      const container = selector ? await page.$(selector) : await page.$('[class*="captcha"], [class*="icon"]');
      if (!container) return { selections: [0], method: 'browser' };

      const icons = await container.$$('img, [class*="icon"], [class*="item"]');
      if (icons.length === 0) return { selections: [0], method: 'browser' };

      await icons[0].click();
      await page.waitForTimeout(300);
      return { selections: [0], method: 'browser' };
    } finally {
      await this._cleanup(context);
    }
  }

  async solveClickCaptcha({ pageUrl, instruction, elements, selector, count }) {
    const { page, context } = await this._createPage();
    try {
      if (pageUrl) await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });

      const container = selector ? await page.$(selector) : await page.$('[class*="captcha"], [class*="click"]');
      if (!container) throw new BrowserError('Click captcha container not found');

      const clickables = await container.$$('img, button, [class*="item"], [class*="cell"], a');
      const numClicks = count || Math.min(clickables.length, 3);

      for (let i = 0; i < numClicks; i++) {
        try {
          await clickables[i].click();
          await page.waitForTimeout(200);
        } catch {}
      }

      return { clicks: clickables.slice(0, numClicks).map((_, i) => ({ index: i, order: i })), order: [...Array(numClicks).keys()], method: 'browser' };
    } finally {
      await this._cleanup(context);
    }
  }

  async close() {
    if (this.browser) {
      try { await this.browser.close(); } catch {}
      this.browser = null;
    }
  }
}

module.exports = { BrowserAutomation };
