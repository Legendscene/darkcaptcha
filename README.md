<div align="center">
  <h1>🕵️ DarkCaptcha</h1>
  <p><strong>Universal CAPTCHA Solver — 18 captcha types, one API.</strong></p>
  <p>Text · Math · reCAPTCHA v2/v3 · hCaptcha · FunCAPTCHA · Turnstile · Slider · Puzzle · Image · Audio · Coordinate · Rotate · Drag & Drop · Icon · Click · Generic</p>
  <p>
    <a href="#-install"><code>npm install darkcaptcha</code></a>
    ·
    <a href="#-quick-start">Quick Start</a>
    ·
    <a href="#-supported-types">Supported Types</a>
    ·
    <a href="#-solvers">Solvers</a>
    ·
    <a href="#-cli">CLI</a>
  </p>
</div>

---

## 📦 Install

```bash
npm install darkcaptcha
```

For browser-based solving (reCAPTCHA, hCaptcha, slider, etc.), install Playwright:

```bash
npm install playwright
npx playwright install chromium
```

> **Note:** Playwright is optional. Most captcha types also work via external solving services (2captcha, Anti-Captcha, CapSolver).

---

## ⚡ Quick Start

### Solve a math captcha (local, no dependencies needed)

```js
const DarkCaptcha = require('darkcaptcha');

const result = await DarkCaptcha.solve({
  type: 'math',
  expression: '25 * 4 + 10',
});

console.log(result.answer); // "110"
```

### Solve a text captcha from an image

```js
const result = await DarkCaptcha.solve({
  type: 'text',
  image: './captcha.png',
});

console.log(result.text);    // "X7k9M"
console.log(result.confidence); // 85
```

### Auto-detect and solve

```js
const result = await DarkCaptcha.solve({
  image: './captcha.png',
});

console.log(result); // auto-detects type and solves
```

### Solve reCAPTCHA v2 with a service

```js
const result = await DarkCaptcha.solve({
  type: 'recaptcha_v2',
  siteKey: '6Lc...',
  pageUrl: 'https://example.com',
  service: '2captcha',
  apiKey: 'your-2captcha-api-key',
});

console.log(result.token); // reCAPTCHA response token
```

---

## 🧠 Architecture

```
                  ┌──────────────┐
                  │ DarkCaptcha  │  ← Main orchestrator
                  └──────┬───────┘
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
   ┌──────────┐   ┌──────────┐   ┌──────────┐
   │ Detector │   │  Solvers │   │Services  │
   │(auto-detect)│  │(16 types)│   │(3 bridges)│
   └──────────┘   └──────────┘   └──────────┘
                        │
               ┌────────┴────────┐
               ▼                 ▼
        ┌──────────┐      ┌──────────┐
        │  Local   │      │ Browser  │
        │(OCR/Math)│      │(Playwright)│
        └──────────┘      └──────────┘
```

- **Local solvers** – work out of the box (text OCR via Tesseract.js, math parsing)
- **Service bridges** – delegate to paid captcha-solving services (2captcha, Anti-Captcha, CapSolver)
- **Browser automation** – uses Playwright to solve captchas directly in a headless browser

---

## 🎯 Supported Types

| Type | Identifier | Local | Service | Browser | Notes |
|------|-----------|-------|---------|---------|-------|
| Text | `text` | ✅ OCR | — | — | Tesseract.js with image preprocessing |
| Math | `math` | ✅ Parse | — | — | Arithmetic + word expressions |
| reCAPTCHA v2 | `recaptcha_v2` | — | ✅ | ✅ | Requires service key or Playwright |
| reCAPTCHA v3 | `recaptcha_v3` | — | ✅ | ✅ | Requires service key or Playwright |
| hCaptcha | `hcaptcha` | — | ✅ | ✅ | Requires service key or Playwright |
| FunCAPTCHA | `funcaptcha` | — | ✅ | ✅ | Arkose Labs |
| Turnstile | `turnstile` | — | ✅ | ✅ | Cloudflare |
| Slider | `slider` | ✅ Gap | — | ✅ | Detects gap + generates smooth curve |
| Puzzle | `puzzle` | — | — | ✅ | Jigsaw / shape puzzle |
| Image | `image` | — | ✅ | ✅ | "Select all X" style |
| Audio | `audio` | — | ✅ | — | Speech-to-text via service |
| Coordinate | `coordinate` | — | ✅ | ✅ | Click at specific coordinates |
| Rotate | `rotate` | — | — | ✅ | Rotate to correct orientation |
| Drag & Drop | `dragdrop` | — | — | ✅ | Drag element to target |
| Icon | `icon` | — | ✅ | ✅ | Select matching icons |
| Click | `click` | — | ✅ | ✅ | Click in correct order |
| Generic | `generic` | ✅ Fallback | ✅ | ✅ | Tries text → math → service |

---

## 🔧 API Reference

### `DarkCaptcha.solve(config)`

The main entry point. Static method — creates an instance and solves in one call.

| Config Field | Type | Default | Description |
|-------------|------|---------|-------------|
| `type` | `string` | `'auto'` | Captcha type or `'auto'` for detection |
| `image` | `string` | — | Path to captcha image |
| `buffer` | `Buffer` | — | Raw image buffer |
| `audio` | `string` | — | Path to audio captcha file |
| `siteKey` | `string` | — | Site key (reCAPTCHA, hCaptcha, etc.) |
| `pageUrl` | `string` | — | Page URL where captcha appears |
| `expression` | `string` | — | Math expression |
| `question` | `string` | — | Captcha question/instruction |
| `service` | `string` | — | External service: `'2captcha'`, `'anticaptcha'`, `'capsolver'` |
| `apiKey` | `string` | — | API key for external service |
| `action` | `string` | `'verify'` | reCAPTCHA v3 action |
| `minScore` | `number` | `0.3` | reCAPTCHA v3 minimum score |

**Returns:** `Promise<object>` — result varies by type:

```js
// Text result:
{ text: 'X7k9M', confidence: 85, solver: 'TextSolver' }

// Math result:
{ answer: '110', method: '+', expression: '25*4+10', confidence: 90 }

// reCAPTCHA result:
{ token: '03A...', version: 'v2', solver: 'RecaptchaSolver', confidence: 85 }

// Slider result:
{ distance: 147, steps: [...], trackWidth: 300, solver: 'SliderSolver', confidence: 75 }
```

### `new DarkCaptcha(options)`

Create a reusable instance with persistent configuration.

```js
const solver = new DarkCaptcha({
  service: '2captcha',
  apiKey: 'your-key',
  defaultType: 'auto',
  timeout: 120000,
});

const result1 = await solver.resolve({ image: 'c1.png' });
const result2 = await solver.resolve({ image: 'c2.png' });
```

---

## 🖥️ CLI

```bash
# Solve a captcha image
darkcaptcha solve --image captcha.png

# Solve with explicit type
darkcaptcha solve --type math --expression "5 + 3"

# Solve reCAPTCHA with service
darkcaptcha solve --type recaptcha_v2 --sitekey KEY --pageurl URL --service 2captcha --apikey YOUR_KEY

# JSON output
darkcaptcha solve --image captcha.png --json

# Detect captcha type
darkcaptcha detect captcha.png

# List all supported types
darkcaptcha list-types

# Help
darkcaptcha --help
```

---

## 🔌 External Services

For captcha types that can't be solved locally (reCAPTCHA, hCaptcha, image selection, audio, etc.), you need an external solving service.

| Service | Sign Up | How It Works |
|---------|---------|-------------|
| [2captcha](https://2captcha.com) | Create account → get API key | Human-powered solving |
| [Anti-Captcha](https://anti-captcha.com) | Create account → get API key | Human-powered solving |
| [CapSolver](https://capsolver.com) | Create account → get API key | AI + human hybrid |

```js
// Method 1: Pass in config
const result = await DarkCaptcha.solve({
  type: 'hcaptcha',
  siteKey: 'SITE_KEY',
  pageUrl: 'https://example.com',
  service: '2captcha',
  apiKey: 'YOUR_API_KEY',
});

// Method 2: Configure on instance
const solver = new DarkCaptcha({ service: '2captcha', apiKey: '...' });
const result = await solver.resolve({ type: 'hcaptcha', siteKey: '...', pageUrl: '...' });
```

---

## 🧩 Examples

### Slider captcha — detect gap and generate movement curve

```js
const result = await DarkCaptcha.solve({
  type: 'slider',
  image: 'slider-bg.png',
});

console.log(`Gap at x=${result.distance}px`);
console.log(`Generated ${result.steps.length} movement steps`);
// Use result.steps with Playwright/Puppeteer to execute the slide
```

### reCAPTCHA v3 with Auto-Captcha service

```js
const result = await DarkCaptcha.solve({
  type: 'recaptcha_v3',
  siteKey: '6Lc...',
  pageUrl: 'https://example.com',
  action: 'submit_form',
  minScore: 0.7,
  service: 'anticaptcha',
  apiKey: '...',
});
```

### Auto-detect from image URL

```js
const result = await DarkCaptcha.solve({
  image: 'https://example.com/captcha.png',
  // type is auto-detected
});
```

---

## ⚠️ Error Handling

```js
const { DarkCaptchaError, SolverError, ServiceError } = require('darkcaptcha');

try {
  const result = await DarkCaptcha.solve({ image: 'captcha.png' });
} catch (err) {
  if (err instanceof ServiceError) {
    console.error('Service issue:', err.message);
  } else if (err instanceof SolverError) {
    console.error('Solver failed:', err.message);
  } else if (err instanceof DarkCaptchaError) {
    console.error('DarkCaptcha error:', err.code, err.message);
  } else {
    console.error('Unexpected error:', err);
  }
}
```

---

## 🛠️ Development

```bash
git clone https://github.com/Legendscene/darkcaptcha.git
cd darkcaptcha
npm install
npm test
```

---

## 📄 License

MIT © Pranshu
