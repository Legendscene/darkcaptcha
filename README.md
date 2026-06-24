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

- **Local solvers** – work out of the box (text OCR via Tesseract.js, math parsing, AI image analysis, speech-to-text)
- **Browser automation** – uses Playwright to solve captchas directly in a headless browser
- **Service bridges** – optional fallback to paid services (2captcha, Anti-Captcha, CapSolver)

---

## 🎯 Supported Types

| Type | Identifier | Local | Method |
|------|-----------|-------|--------|
| Text | `text` | ✅ | OCR (Tesseract.js) |
| Math | `math` | ✅ | Expression parser |
| reCAPTCHA v2 | `recaptcha_v2` | ✅ | Playwright click or AI audio/image |
| reCAPTCHA v3 | `recaptcha_v3` | ✅ | Playwright token extraction |
| hCaptcha | `hcaptcha` | ✅ | Playwright click or AI image |
| FunCAPTCHA | `funcaptcha` | ✅ | Playwright token extraction |
| Turnstile | `turnstile` | ✅ | Playwright token extraction |
| Slider | `slider` | ✅ | Gap detection + smooth drag curve |
| Puzzle | `puzzle` | ✅ | Playwright element interaction |
| Image | `image` | ✅ | CLIP AI zero-shot classification |
| Audio | `audio` | ✅ | Speech-to-text (built-in OS or whisper) |
| Coordinate | `coordinate` | ❌ | Needs AI or service |
| Rotate | `rotate` | ❌ | Needs AI or service |
| Drag & Drop | `dragdrop` | ✅ | Playwright mouse drag |
| Icon | `icon` | ❌ | Needs AI or service |
| Click | `click` | ❌ | Needs AI or service |
| Generic | `generic` | ✅ | Auto-fallback via text → math → AI |

---

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

### reCAPTCHA v2/v3 from browser page

```js
const result = await DarkCaptcha.solve({
  type: 'recaptcha_v2',
  siteKey: '6Lc...',
  pageUrl: 'https://example.com',
});
```
Requires Playwright. Clicks checkbox or solves audio/image challenge automatically.

### Image captcha with AI

```js
const result = await DarkCaptcha.solve({
  type: 'image',
  images: ['tile1.png', 'tile2.png', ...],  // tile images from captcha grid
  question: 'Select all crosswalks',
});
```
Uses CLIP AI model. Install: `npm install @xenova/transformers`

### Auto-detect from image URL

```js
const result = await DarkCaptcha.solve({
  image: 'https://example.com/captcha.png',
  // type is auto-detected
});
```

---

## 🤖 Auto-Solve (Playwright Integration)

DarkCaptcha can **automatically detect and solve captchas** on any page without writing per-site logic. It watches for reCAPTCHA, hCaptcha, Turnstile, and FunCAPTCHA iframes, extracts site keys, solves them (locally via OCR/AI/STT or Playwright), and injects the token — all automatically. No paid services needed.

### Simple auto-solve

```js
const { chromium } = require('playwright');
const { autoSolve } = require('darkcaptcha');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Start auto-solve watchdog (watches for captchas automatically)
  const watchdog = await autoSolve(page, {
    autoClick: true,
  });

  await page.goto('https://example.com/signup');
  // Captchas are solved automatically — no extra code needed

  // ... fill form, click submit, etc. — captchas are auto-solved

  await watchdog.stop();
  await browser.close();
})();
```

### How it works

1. **Interceptor** — injects a script that monitors for captcha iframes and DOM elements
2. **Polling** — checks every 2 seconds for new captchas
3. **Detection** — identifies captcha type (reCAPTCHA, hCaptcha, etc.) and extracts site key
4. **Solving** — calls DarkCaptcha.solve() with the detected parameters
5. **Injection** — sets the token in the appropriate textarea and triggers callbacks
6. **Auto-submit** — optionally clicks the submit/continue button after solving

> **Note:** Auto-solve requires Playwright installed (`npm install playwright && npx playwright install chromium`). For image captchas, install AI support: `npm install @xenova/transformers`.

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
