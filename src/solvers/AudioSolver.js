const BaseSolver = require('../core/BaseSolver');

class AudioSolver extends BaseSolver {
  static type = 'audio';

  canSolve(config) {
    return config.type === 'audio' || !!config.audio;
  }

  async solve(config) {
    const { audio, service, apiKey } = { ...this.options, ...config };

    if (service) {
      const ServiceClass = this._getServiceClass(service);
      if (ServiceClass) {
        const svc = new ServiceClass(apiKey);
        return svc.solve({ type: 'AudioTask', audio });
      }
    }

    const text = await this._transcribeAudio(audio);

    return {
      text,
      solver: 'AudioSolver',
      method: 'local',
      confidence: 50,
    };
  }

  async _transcribeAudio(audioPath) {
    const fs = require('fs');
    const path = require('path');
    const audioBuffer = audioPath
      ? fs.readFileSync(path.resolve(audioPath))
      : null;

    if (!audioBuffer) {
      throw new Error('Audio transcription requires external service (2captcha/anticaptcha/capsolver) or audio file');
    }

    throw new Error(
      'Audio transcription not available locally. ' +
      'Configure an external captcha service: ' +
      'new DarkCaptcha({ service: "2captcha", apiKey: "..." })'
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
