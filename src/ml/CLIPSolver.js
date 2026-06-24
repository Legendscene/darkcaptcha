const Jimp = require('jimp');
const { getCLIP, isMLAvailable } = require('./ModelManager');

class CLIPSolver {
  async selectMatchingTiles(tiles, instruction) {
    if (!tiles || tiles.length === 0) return [];
    const classifier = await getCLIP();
    const candidates = [];

    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      const buffer = Buffer.isBuffer(tile) ? tile : await this._toBuffer(tile);
      const results = await classifier(buffer, [instruction, 'irrelevant', 'other', 'background']);
      const matchScore = results.find(r => r.label === instruction)?.score || 0;
      candidates.push({ index: i, score: matchScore });
    }

    const threshold = 0.4;
    const selected = candidates.filter(c => c.score > threshold);
    if (selected.length === 0 && candidates.length > 0) {
      const maxScore = Math.max(...candidates.map(c => c.score));
      if (maxScore > 0.25) {
        selected.push(candidates.find(c => c.score === maxScore));
      }
    }
    return selected.sort((a, b) => b.score - a.score).map(c => c.index);
  }

  async findBestAngle(imageBuffer) {
    const classifier = await getCLIP();
    const img = await Jimp.read(imageBuffer);
    const centerCrop = Math.min(img.bitmap.width, img.bitmap.height) * 0.6;
    const cx = Math.floor((img.bitmap.width - centerCrop) / 2);
    const cy = Math.floor((img.bitmap.height - centerCrop) / 2);
    const cropped = img.clone().crop(cx, cy, centerCrop, centerCrop);

    const quadrants = [0, 90, 180, 270];
    const quadScores = [];

    for (const angle of quadrants) {
      const rotated = cropped.clone().rotate(angle, false);
      const buf = await rotated.getBufferAsync(Jimp.MIME_PNG);
      const results = await classifier(buf, ['correctly oriented image', 'upright', 'straight', 'rotated image', 'tilted']);
      const score = (results.find(r => r.label === 'correctly oriented image')?.score || 0)
        + (results.find(r => r.label === 'upright')?.score || 0)
        + (results.find(r => r.label === 'straight')?.score || 0);
      quadScores.push({ angle, score });
    }

    quadScores.sort((a, b) => b.score - a.score);
    const bestQuad = quadScores[0].angle;

    const fineStep = 5;
    const fineStart = Math.max(0, bestQuad - 30);
    const fineEnd = Math.min(360, bestQuad + 30);
    const fineAngles = [];

    for (let angle = fineStart; angle <= fineEnd; angle += fineStep) {
      const rotated = cropped.clone().rotate(angle, false);
      const buf = await rotated.getBufferAsync(Jimp.MIME_PNG);
      const results = await classifier(buf, ['correctly oriented image', 'upright', 'straight', 'rotated', 'tilted']);
      const score = (results.find(r => r.label === 'correctly oriented image')?.score || 0)
        + (results.find(r => r.label === 'upright')?.score || 0)
        + (results.find(r => r.label === 'straight')?.score || 0);
      fineAngles.push({ angle, score });
    }

    fineAngles.sort((a, b) => b.score - a.score);
    return fineAngles[0]?.angle || 0;
  }

  async findCoordinateOnImage(imageBuffer, instruction, gridSize = 3) {
    const classifier = await getCLIP();
    const img = await Jimp.read(imageBuffer);
    const w = img.bitmap.width;
    const h = img.bitmap.height;
    const cellW = Math.floor(w / gridSize);
    const cellH = Math.floor(h / gridSize);
    const results = [];

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const x = col * cellW;
        const y = row * cellH;
        const cell = img.clone().crop(x, y, cellW, cellH);
        const buf = await cell.getBufferAsync(Jimp.MIME_PNG);
        const scores = await classifier(buf, [instruction, 'irrelevant', 'other']);
        const matchScore = scores.find(r => r.label === instruction)?.score || 0;
        results.push({
          index: row * gridSize + col,
          x: x + cellW / 2,
          y: y + cellH / 2,
          row, col,
          score: matchScore,
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    const threshold = 0.35;
    const selected = results.filter(r => r.score > threshold);
    return selected.length > 0 ? selected : results.slice(0, 1);
  }

  async findMatchingIcons(icons, instruction) {
    if (!icons || icons.length === 0) return [];
    const classifier = await getCLIP();
    const candidates = [];

    for (let i = 0; i < icons.length; i++) {
      const buf = Buffer.isBuffer(icons[i]) ? icons[i] : await this._toBuffer(icons[i]);
      const results = await classifier(buf, [instruction, 'not ' + instruction, 'other']);
      const score = results.find(r => r.label === instruction)?.score || 0;
      candidates.push({ index: i, score });
    }

    const threshold = 0.4;
    const selected = candidates.filter(c => c.score > threshold);
    if (selected.length === 0 && candidates.length > 0) {
      const maxScore = Math.max(...candidates.map(c => c.score));
      if (maxScore > 0.25) {
        selected.push(candidates.find(c => c.score === maxScore));
      }
    }
    return selected.sort((a, b) => b.score - a.score).map(c => c.index);
  }

  async identifyImageContent(imageBuffer) {
    const classifier = await getCLIP();
    const commonLabels = [
      'a number', 'a letter', 'a symbol', 'an animal', 'a vehicle',
      'a person', 'food', 'a building', 'nature', 'an object',
    ];
    const results = await classifier(imageBuffer, commonLabels);
    results.sort((a, b) => b.score - a.score);
    return results[0]?.label || 'unknown';
  }

  async detectNumbersOrder(imageBuffer) {
    const classifier = await getCLIP();
    const candidates = [];
    const img = await Jimp.read(imageBuffer);
    const { TextSolver } = require('../solvers/TextSolver');

    try {
      const ts = new TextSolver();
      const ocrResult = await ts.solve({ buffer: imageBuffer });
      const numbers = ocrResult.text.match(/\d+/g);
      if (numbers && numbers.length > 0) {
        return numbers.map(Number);
      }
    } catch {}

    const w = img.bitmap.width;
    const pieces = [];
    const numPieces = 4;

    for (let i = 0; i < numPieces; i++) {
      const x = Math.floor((i / numPieces) * w);
      const pw = Math.floor(w / numPieces);
      const piece = img.clone().crop(x, 0, pw, img.bitmap.height);
      const buf = await piece.getBufferAsync(Jimp.MIME_PNG);
      const results = await classifier(buf, ['1', '2', '3', '4', '5', '6', '7', '8', '9']);
      results.sort((a, b) => b.score - a.score);
      if (results[0] && results[0].score > 0.3) {
        pieces.push({ position: i, number: parseInt(results[0].label), score: results[0].score });
      }
    }

    return pieces.sort((a, b) => a.number - b.number).map(p => p.position);
  }

  async _toBuffer(input) {
    if (Buffer.isBuffer(input)) return input;
    if (typeof input === 'string') {
      if (input.startsWith('data:')) return Buffer.from(input.split(',')[1] || input, 'base64');
      if (input.startsWith('http://') || input.startsWith('https://')) {
        const axios = require('axios');
        const { data } = await axios.get(input, { responseType: 'arraybuffer' });
        return Buffer.from(data);
      }
      return require('fs').readFileSync(require('path').resolve(input));
    }
    return input;
  }

  static isAvailable() {
    return isMLAvailable();
  }
}

module.exports = CLIPSolver;
