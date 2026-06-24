const BaseSolver = require('../core/BaseSolver');
const CLIPSolver = require('../ml/CLIPSolver');

class ClickSolver extends BaseSolver {
  static type = 'click';

  canSolve(config) {
    return config.type === 'click' || config.type === 'click_order';
  }

  async solve(config) {
    const merged = { ...this.options, ...config };
    const instruction = merged.instruction || merged.question || '';
    const elements = this._collectElements(merged);

    if (elements.length === 0) {
      return { clicks: [], order: [], solver: 'ClickSolver', error: 'No elements provided', confidence: 0 };
    }

    if (CLIPSolver.isAvailable()) {
      try {
        const solver = new CLIPSolver();
        const result = await this._solveWithAI(solver, elements, instruction);
        if (result) return result;
      } catch (err) {
        if (!merged.service) return { clicks: [], order: [], solver: 'ClickSolver', error: err.message, confidence: 0 };
      }
    }

    if (merged.service) {
      const map = { '2captcha': '../services/TwoCaptchaService', 'anticaptcha': '../services/AntiCaptchaService', 'capsolver': '../services/CapSolverService' };
      const svcPath = map[merged.service?.toLowerCase()];
      if (svcPath) {
        const ServiceClass = require(svcPath);
        const svc = new ServiceClass(merged.apiKey);
        return svc.solve({ type: 'ClickCaptchaTask', objects: elements.map(e => e.image || e.buffer), instruction });
      }
    }

    return { clicks: [], order: [], solver: 'ClickSolver', method: 'none', confidence: 0, error: 'Install @xenova/transformers for AI solving or provide count/config' };
  }

  async _solveWithAI(solver, elements, instruction) {
    const images = elements.map(e => e.image || e.buffer || e);
    const hasNumbers = instruction.toLowerCase().includes('number') || instruction.toLowerCase().includes('order');

    if (hasNumbers) {
      const { TextSolver } = require('./TextSolver');
      const ts = new TextSolver();
      const numbered = [];

      for (let i = 0; i < images.length; i++) {
        let number = null;
        try {
          const buf = Buffer.isBuffer(images[i]) ? images[i] : null;
          if (buf) {
            const ocr = await ts.solve({ buffer: buf });
            const match = ocr.text.match(/\d+/);
            number = match ? parseInt(match[0]) : null;
          }
        } catch {}
        numbered.push({ index: i, number, image: images[i] });
      }

      const hasAnyNumbers = numbered.some(n => n.number !== null);
      if (hasAnyNumbers) {
        const sorted = numbered.filter(n => n.number !== null).sort((a, b) => a.number - b.number);
        const rest = numbered.filter(n => n.number === null);

        for (const item of rest) {
          try {
            const buf = Buffer.isBuffer(item.image) ? item.image : null;
            if (buf) {
              const label = await solver.identifyImageContent(buf);
              for (let n = 1; n <= 9; n++) {
                if (label.toLowerCase().includes(n.toString())) { item.number = n; break; }
              }
            }
          } catch {}
        }
        rest.sort((a, b) => (a.number || 99) - (b.number || 99));
        const clicks = [...sorted, ...rest].map(item => elementToClick(item.index, elements[item.index]));

        return {
          clicks,
          order: clicks.map(c => c.index),
          solver: 'ClickSolver (AI+OCR)',
          method: 'local-ai',
          confidence: 70,
        };
      }
    }

    if (instruction) {
      const parts = instruction.split(',').map(s => s.trim()).filter(Boolean);
      if (parts.length > 1) {
        const orders = [];
        for (const part of parts) {
          const matches = await solver.findMatchingIcons(images, part);
          if (matches.length > 0) orders.push(matches[0]);
        }
        if (orders.length > 0) {
          const clicks = orders.map((index, order) => elementToClick(index, elements[index], order));
          return { clicks, order: clicks.map(c => c.index), solver: 'ClickSolver (AI)', method: 'local-ai', confidence: 60 };
        }
      }

      const matches = await solver.findMatchingIcons(images, instruction);
      if (matches.length > 0) {
        const clicks = matches.map((index, order) => elementToClick(index, elements[index], order));
        return { clicks, order: clicks.map(c => c.index), solver: 'ClickSolver (AI)', method: 'local-ai', confidence: 65 };
      }
    }

    return null;
  }

  _collectElements(config) {
    if (config.elements && config.elements.length > 0) return config.elements;
    if (config.images) return config.images.map(img => ({ image: img }));
    if (config.image) return [{ image: config.image }];
    if (config.buffer) return [{ buffer: config.buffer }];
    return [];
  }
}

function elementToClick(index, el, order = 0) {
  return {
    index,
    order,
    x: el?.x || el?.cx || 0,
    y: el?.y || el?.cy || 0,
    selector: el?.selector || '',
  };
}

module.exports = ClickSolver;
