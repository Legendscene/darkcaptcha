const BaseSolver = require('../core/BaseSolver');
const { transcribeAudio } = require('../utils/audioTranscriber');
const { SolverError } = require('../core/errors');

class AudioSolver extends BaseSolver {
  static type = 'audio';

  canSolve(config) {
    return config.type === 'audio' || !!config.audio;
  }

  async solve(config) {
    const merged = { ...this.options, ...config };
    const audioInput = merged.audio;

    if (!audioInput) {
      throw new SolverError('No audio file provided. Set audio path: { audio: "captcha.mp3" }', 'AudioSolver');
    }

    if (merged.service) {
      const ServiceClass = this._getServiceClass(merged.service);
      if (ServiceClass) {
        const svc = new ServiceClass(merged.apiKey);
        return svc.solve({ type: 'AudioTask', audio: audioInput });
      }
    }

    const result = await transcribeAudio(audioInput);

    if (result.text) {
      return {
        text: result.text,
        confidence: result.confidence,
        solver: 'AudioSolver',
        method: 'local',
      };
    }

    throw new SolverError(
      `Audio transcription failed: ${result.error || 'Unknown error'}\n` +
      'Tips:\n' +
      '  Windows: Works out of the box with PowerShell speech recognition\n' +
      '  Mac:    brew install ffmpeg && pip3 install speechrecognition\n' +
      '  Linux:  sudo apt install ffmpeg python3-pip && pip3 install speechrecognition\n' +
      '  Or set service + apiKey to use 2captcha/AntiCaptcha/CapSolver',
      'AudioSolver'
    );
  }

  _getServiceClass(name) {
    const map = {
      '2captcha': '../services/TwoCaptchaService',
      'anticaptcha': '../services/AntiCaptchaService',
      'capsolver': '../services/CapSolverService',
    };
    if (!name || !map[name.toLowerCase()]) return null;
    return require(map[name.toLowerCase()]);
  }
}

module.exports = AudioSolver;
