const BaseSolver = require('../core/BaseSolver');
const { SolverError } = require('../core/errors');

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

    throw new SolverError(
      'Audio captcha requires an external service. Configure one:\n' +
      '  new DarkCaptcha({ service: "2captcha", apiKey: "..." })\n' +
      '  OR\n' +
      '  DarkCaptcha.solve({ type: "audio", audio: "file.mp3", service: "2captcha", apiKey: "..." })',
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
