const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const DarkCaptcha = require('./index');

const program = new Command();

program
  .name('darkcaptcha')
  .description('Universal CAPTCHA solver — supports text, math, reCAPTCHA, hCaptcha, FunCAPTCHA, Turnstile, slider, puzzle, image, audio, and more')
  .version('1.0.0');

program
  .command('solve')
  .description('Solve a captcha')
  .option('-i, --image <path>', 'Path to captcha image file')
  .option('-a, --audio <path>', 'Path to audio captcha file')
  .option('-t, --type <type>', 'Captcha type (auto, text, math, recaptcha_v2, recaptcha_v3, hcaptcha, funcaptcha, turnstile, slider, puzzle, image, audio, coordinate, rotate, dragdrop, icon, click)')
  .option('-s, --sitekey <key>', 'Site key (for reCAPTCHA/hCaptcha/Turnstile/FunCAPTCHA)')
  .option('-u, --pageurl <url>', 'Page URL (for reCAPTCHA/hCaptcha/Turnstile/FunCAPTCHA)')
  .option('-e, --expression <expr>', 'Math expression (for math captcha)')
  .option('--question <text>', 'Question/instruction text')
  .option('--service <name>', 'External service (2captcha, anticaptcha, capsolver)')
  .option('--apikey <key>', 'API key for external service')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    try {
      if (!options.image && !options.audio && !options.sitekey && !options.expression && !options.type) {
        console.error('Error: Provide an image, audio, sitekey, expression, or type');
        console.error('Usage: darkcaptcha solve --image captcha.png');
        console.error('       darkcaptcha solve --type math --expression "5 + 3"');
        console.error('       darkcaptcha solve --type recaptcha_v2 --sitekey KEY --pageurl URL');
        process.exit(1);
      }

      const config = {
        type: options.type || 'auto',
        ...(options.image && { image: path.resolve(options.image) }),
        ...(options.audio && { audio: path.resolve(options.audio) }),
        ...(options.sitekey && { siteKey: options.sitekey }),
        ...(options.pageurl && { pageUrl: options.pageurl }),
        ...(options.expression && { expression: options.expression }),
        ...(options.question && { question: options.question }),
        ...(options.service && { service: options.service }),
        ...(options.apikey && { apiKey: options.apikey }),
      };

      console.error(`[DarkCaptcha] Solving ${config.type || 'auto'} captcha...`);
      const result = await DarkCaptcha.solve(config);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        for (const [key, val] of Object.entries(result)) {
          if (val !== null && val !== undefined) {
            const display = typeof val === 'object' ? JSON.stringify(val) : String(val);
            console.log(`${key}: ${display}`);
          }
        }
      }
    } catch (err) {
      console.error(`[DarkCaptcha Error] ${err.message}`);
      if (options.json) {
        console.log(JSON.stringify({ error: err.message, code: err.code }, null, 2));
      }
      process.exit(1);
    }
  });

program
  .command('list-types')
  .description('List all supported captcha types')
  .action(() => {
    const types = DarkCaptcha.CAPTCHA_TYPES || [
      'auto', 'text', 'math', 'recaptcha_v2', 'recaptcha_v3',
      'hcaptcha', 'funcaptcha', 'turnstile', 'slider', 'puzzle',
      'image', 'audio', 'coordinate', 'rotate', 'dragdrop',
      'icon', 'click', 'generic',
    ];
    for (const type of types) {
      console.log(`  - ${type}`);
    }
  });

program
  .command('detect')
  .description('Detect captcha type from an image')
  .argument('<image>', 'Path to captcha image')
  .option('--json', 'Output as JSON')
  .action(async (imagePath, options) => {
    try {
      const resolved = path.resolve(imagePath);
      if (!fs.existsSync(resolved)) {
        console.error(`File not found: ${resolved}`);
        process.exit(1);
      }

      const detector = new DarkCaptcha.Detector();
      const result = await detector.detect({ image: resolved });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`Detected type: ${result.type}`);
        if (result.serviceRequired) {
          console.log('Note: This captcha type may require an external service');
        }
      }
    } catch (err) {
      console.error(`Detection error: ${err.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
