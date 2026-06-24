const { BrowserError } = require('../core/errors');

class BrowserAutomation {
  constructor(options = {}) {
    this.options = options;
    this.browser = null;
    this._playwright = null;
  }

  async _ensureBrowser() {
    if (this.browser) return;
    try {
      const { chromium } = require('playwright');
      this._playwright = chromium;
      this.browser = await chromium.launch({
        headless: this.options.headless !== false,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    } catch (err) {
      throw new BrowserError(
        'Playwright is required for browser-based captcha solving. ' +
        'Install it: npm install playwright && npx playwright install chromium. ' +
        'Alternatively, configure an external service: new DarkCaptcha({ service: "2captcha", apiKey: "..." })',
        'playwright'
      );
    }
  }

  async solveRecaptcha({ siteKey, pageUrl, version = 'v2', action = 'verify', minScore = 0.3 }) {
    await this._ensureBrowser();
    const context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    try {
      await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });

      if (version === 'v2') {
        const frame = page.frameLocator('iframe[src*="recaptcha"]').first();
        await frame.locator('.recaptcha-checkbox-border').click({ timeout: 10000 });
        await page.waitForTimeout(3000);
      }

      const token = await page.evaluate(() => {
        return document.querySelector('textarea[name="g-recaptcha-response"]')?.value ||
               document.querySelector('#g-recaptcha-response')?.value ||
               (window.___grecaptcha_cfg && window.___grecaptcha_cfg.clients &&
                Object.values(window.___grecaptcha_cfg.clients)[0]?.getResponse());
      });

      if (!token) {
        throw new BrowserError('Could not obtain reCAPTCHA token automatically. ' +
          'Try using an external service like 2captcha.');
      }

      return { token, method: 'browser' };
    } finally {
      await page.close();
      await context.close();
    }
  }

  async solveHCaptcha({ siteKey, pageUrl }) {
    await this._ensureBrowser();
    const context = await this.browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });
      const frame = page.frameLocator('iframe[src*="hcaptcha"]').first();
      await frame.locator('#checkbox').click({ timeout: 10000 });
      await page.waitForTimeout(3000);

      const token = await page.evaluate(() => {
        return document.querySelector('textarea[name="h-captcha-response"]')?.value;
      });

      if (!token) {
        throw new BrowserError('Could not obtain hCaptcha token automatically.');
      }

      return { token, method: 'browser' };
    } finally {
      await page.close();
      await context.close();
    }
  }

  async solveFunCaptcha({ siteKey, pageUrl, surl }) {
    await this._ensureBrowser();
    const context = await this.browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });

      const frames = page.frames();
      for (const frame of frames) {
        if (frame.url().includes('arkoselabs') || frame.url().includes('funcaptcha')) {
          const token = await frame.evaluate(() => {
            return document.querySelector('input[name="fc-token"]')?.value;
          });
          if (token) return { token, method: 'browser' };
        }
      }

      throw new BrowserError('Could not obtain FunCAPTCHA token automatically.');
    } finally {
      await page.close();
      await context.close();
    }
  }

  async solveTurnstile({ siteKey, pageUrl }) {
    await this._ensureBrowser();
    const context = await this.browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });

      const token = await page.evaluate(() => {
        const input = document.querySelector('input[name="cf-turnstile-response"]');
        return input?.value;
      });

      if (!token) {
        throw new BrowserError('Could not obtain Turnstile token automatically.');
      }

      return { token, method: 'browser' };
    } finally {
      await page.close();
      await context.close();
    }
  }

  async solveImageCaptcha({ images, question, pageUrl }) {
    await this._ensureBrowser();
    const context = await this.browser.newContext();
    const page = await context.newPage();

    try {
      if (pageUrl) await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });

      const selections = await page.evaluate((q) => {
        const tiles = document.querySelectorAll('[class*="image"], [class*="tile"], [class*="grid"] img');
        return Array.from(tiles).slice(0, 9).map((_, i) => i);
      }, question);

      return { selections, method: 'browser' };
    } finally {
      await page.close();
      await context.close();
    }
  }

  async solvePuzzle({ image, buffer, pageUrl, selector }) {
    await this._ensureBrowser();
    const context = await this.browser.newContext();
    const page = await context.newPage();

    try {
      if (pageUrl) await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });

      const handle = await page.$(selector);
      if (!handle) throw new BrowserError(`Puzzle element not found: ${selector}`);

      const box = await handle.boundingBox();
      if (!box) throw new BrowserError('Could not get puzzle element bounds');

      return { coordinates: { x: box.x + box.width / 2, y: box.y + box.height / 2 }, method: 'browser' };
    } finally {
      await page.close();
      await context.close();
    }
  }

  async solveCoordinate({ image, pageUrl, instruction, selector }) {
    await this._ensureBrowser();
    const context = await this.browser.newContext();
    const page = await context.newPage();

    try {
      if (pageUrl) await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);

      return { coordinates: null, method: 'browser', note: 'Coordinate captcha requires external service for automatic solving' };
    } finally {
      await page.close();
      await context.close();
    }
  }

  async solveRotate({ image, buffer, pageUrl, selector }) {
    await this._ensureBrowser();
    const context = await this.browser.newContext();
    const page = await context.newPage();

    try {
      if (pageUrl) await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });
      return { angle: 0, steps: [], method: 'browser', note: 'Rotate captcha requires manual or AI-based angle detection' };
    } finally {
      await page.close();
      await context.close();
    }
  }

  async solveDragDrop({ image, pageUrl, sourceSelector, targetSelector, instruction }) {
    await this._ensureBrowser();
    const context = await this.browser.newContext();
    const page = await context.newPage();

    try {
      if (pageUrl) await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });

      const source = sourceSelector ? await page.$(sourceSelector) : null;
      const target = targetSelector ? await page.$(targetSelector) : null;

      if (source && target) {
        const srcBox = await source.boundingBox();
        const tgtBox = await target.boundingBox();
        if (srcBox && tgtBox) {
          await page.mouse.move(srcBox.x + srcBox.width / 2, srcBox.y + srcBox.height / 2);
          await page.mouse.down();
          await page.mouse.move(tgtBox.x + tgtBox.width / 2, tgtBox.y + tgtBox.height / 2, { steps: 30 });
          await page.mouse.up();
          return { actions: [{ type: 'drag', from: srcBox, to: tgtBox }], method: 'browser' };
        }
      }
      return { actions: [], method: 'browser', note: 'Could not find drag/drop elements' };
    } finally {
      await page.close();
      await context.close();
    }
  }

  async solveIconCaptcha({ images, image, pageUrl, instruction, selector }) {
    await this._ensureBrowser();
    const context = await this.browser.newContext();
    const page = await context.newPage();

    try {
      if (pageUrl) await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });
      return { selections: [], method: 'browser', note: 'Icon captcha requires external service or AI for solving' };
    } finally {
      await page.close();
      await context.close();
    }
  }

  async solveClickCaptcha({ image, pageUrl, instruction, elements, selector, count }) {
    await this._ensureBrowser();
    const context = await this.browser.newContext();
    const page = await context.newPage();

    try {
      if (pageUrl) await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });
      return { clicks: [], order: [], method: 'browser', note: 'Click captcha requires external service or AI for solving' };
    } finally {
      await page.close();
      await context.close();
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = { BrowserAutomation };
