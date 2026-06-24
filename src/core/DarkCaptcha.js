const Detector = require('../detectors/Detector');
const TextSolver = require('../solvers/TextSolver');
const MathSolver = require('../solvers/MathSolver');
const RecaptchaSolver = require('../solvers/RecaptchaSolver');
const HCaptchaSolver = require('../solvers/HCaptchaSolver');
const FunCaptchaSolver = require('../solvers/FunCaptchaSolver');
const TurnstileSolver = require('../solvers/TurnstileSolver');
const SliderSolver = require('../solvers/SliderSolver');
const ImageSolver = require('../solvers/ImageSolver');
const AudioSolver = require('../solvers/AudioSolver');
const PuzzleSolver = require('../solvers/PuzzleSolver');
const CoordinateSolver = require('../solvers/CoordinateSolver');
const RotateSolver = require('../solvers/RotateSolver');
const DragDropSolver = require('../solvers/DragDropSolver');
const IconSolver = require('../solvers/IconSolver');
const ClickSolver = require('../solvers/ClickSolver');
const GenericSolver = require('../solvers/GenericSolver');
const TwoCaptchaService = require('../services/TwoCaptchaService');
const AntiCaptchaService = require('../services/AntiCaptchaService');
const CapSolverService = require('../services/CapSolverService');
const { DarkCaptchaError, UnsupportedCaptchaError, SolverError } = require('./errors');

class DarkCaptcha {
  static CAPTCHA_TYPES = [
    'auto', 'text', 'math', 'recaptcha_v2', 'recaptcha_v3',
    'hcaptcha', 'funcaptcha', 'turnstile', 'slider', 'puzzle',
    'image', 'audio', 'coordinate', 'rotate', 'dragdrop',
    'icon', 'click', 'generic',
  ];

  constructor(options = {}) {
    this.options = {
      service: null,
      apiKey: null,
      defaultType: 'auto',
      timeout: 60000,
      ...options,
    };

    this._solvers = new Map();
    this._service = null;
    this._registerSolvers();
    this._initService();
  }

  _registerSolvers() {
    const solvers = [
      new TextSolver(this.options),
      new MathSolver(this.options),
      new SliderSolver(this.options),
      new PuzzleSolver(this.options),
      new ImageSolver(this.options),
      new AudioSolver(this.options),
      new CoordinateSolver(this.options),
      new RotateSolver(this.options),
      new DragDropSolver(this.options),
      new IconSolver(this.options),
      new ClickSolver(this.options),
      new GenericSolver(this.options),
      new RecaptchaSolver(this.options),
      new HCaptchaSolver(this.options),
      new FunCaptchaSolver(this.options),
      new TurnstileSolver(this.options),
    ];

    for (const solver of solvers) {
      const type = solver.constructor.type;
      this._solvers.set(type, solver);
      if (solver.constructor.types) {
        for (const alias of solver.constructor.types) {
          if (alias !== type) this._solvers.set(alias, solver);
        }
      }
    }
  }

  _initService() {
    const { service, apiKey } = this.options;
    if (!service) return;

    switch (service.toLowerCase()) {
      case '2captcha':
        this._service = new TwoCaptchaService(apiKey, this.options);
        break;
      case 'anticaptcha':
        this._service = new AntiCaptchaService(apiKey, this.options);
        break;
      case 'capsolver':
        this._service = new CapSolverService(apiKey, this.options);
        break;
      default:
        throw new DarkCaptchaError(`Unknown service: ${service}`, 'INVALID_SERVICE');
    }
  }

  static async solve(config = {}) {
    const instance = new DarkCaptcha(config);
    return instance.resolve(config);
  }

  async resolve(config = {}) {
    const merged = { ...this.options, ...config };
    const type = merged.type || 'auto';

    if (type === 'auto') {
      return this._autoSolve(config);
    }

    return this._solveLocal(type, config, merged);
  }

  async _autoSolve(config) {
    const detector = new Detector();
    const detection = await detector.detect(config);

    try {
      return await this._solveLocal(detection.type, { ...config, ...detection });
    } catch (localErr) {
      if (this._service) {
        try {
          return await this._service.solve({ ...config, ...detection });
        } catch {}
      }
      throw localErr;
    }
  }

  async _solveLocal(type, config, merged) {
    const solver = this._solvers.get(type);
    if (!solver) {
      throw new UnsupportedCaptchaError(type);
    }

    try {
      return await solver.solve(config);
    } catch (err) {
      if (err instanceof DarkCaptchaError) throw err;
      throw new SolverError(`Solver ${type} failed: ${err.message}`, type, err);
    }
  }

  listSolvers() {
    return Array.from(this._solvers.keys());
  }
}

module.exports = DarkCaptcha;
