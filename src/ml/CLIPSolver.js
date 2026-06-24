const { getCLIP, isMLAvailable } = require('./ModelManager');

class CLIPSolver {
  async selectMatchingTiles(tiles, instruction) {
    if (!tiles || tiles.length === 0) return [];

    const classifier = await getCLIP();
    const candidates = [];

    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      const results = await classifier(tile, [instruction, 'not ' + instruction, 'other', 'background']);
      const matchScore = results.find(r => r.label === instruction)?.score || 0;
      candidates.push({ index: i, score: matchScore });
    }

    const threshold = 0.45;
    const selected = candidates
      .filter(c => c.score > threshold)
      .sort((a, b) => b.score - a.score);

    if (selected.length === 0) {
      const maxScore = Math.max(...candidates.map(c => c.score));
      if (maxScore > 0.3) {
        const best = candidates.find(c => c.score === maxScore);
        if (best) selected.push(best);
      }
    }

    return selected.map(c => c.index);
  }

  async matchImagePair(img1, img2) {
    const classifier = await getCLIP();
    const r1 = await classifier(img1, ['same image', 'different image']);
    const r2 = await classifier(img2, ['same image', 'different image']);
    const same1 = r1.find(r => r.label === 'same image')?.score || 0;
    const same2 = r2.find(r => r.label === 'same image')?.score || 0;
    return (same1 + same2) / 2;
  }

  static isAvailable() {
    return isMLAvailable();
  }
}

module.exports = CLIPSolver;
