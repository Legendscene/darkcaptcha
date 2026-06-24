class DarkCaptchaError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR', details = null) {
    super(message);
    this.name = 'DarkCaptchaError';
    this.code = code;
    this.details = details;
  }
}

class UnsupportedCaptchaError extends DarkCaptchaError {
  constructor(type) {
    super(`Unsupported captcha type: ${type}`, 'UNSUPPORTED_TYPE', { type });
    this.name = 'UnsupportedCaptchaError';
  }
}

class SolverError extends DarkCaptchaError {
  constructor(message, solver, originalError = null) {
    super(message, 'SOLVER_ERROR', { solver, originalMessage: originalError?.message });
    this.name = 'SolverError';
    this.solver = solver;
  }
}

class ServiceError extends DarkCaptchaError {
  constructor(message, service, statusCode = null) {
    super(message, 'SERVICE_ERROR', { service, statusCode });
    this.name = 'ServiceError';
    this.service = service;
  }
}

class BrowserError extends DarkCaptchaError {
  constructor(message, browser = null) {
    super(message, 'BROWSER_ERROR', { browser });
    this.name = 'BrowserError';
  }
}

class OcrError extends DarkCaptchaError {
  constructor(message, confidence = 0) {
    super(message, 'OCR_ERROR', { confidence });
    this.name = 'OcrError';
  }
}

module.exports = {
  DarkCaptchaError,
  UnsupportedCaptchaError,
  SolverError,
  ServiceError,
  BrowserError,
  OcrError,
};
