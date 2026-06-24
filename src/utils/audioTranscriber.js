const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

async function transcribeAudio(audioPathOrBuffer) {
  const audioPath = Buffer.isBuffer(audioPathOrBuffer)
    ? await _bufferToTempFile(audioPathOrBuffer)
    : path.resolve(audioPathOrBuffer);

  if (!fs.existsSync(audioPath)) {
    throw new Error(`Audio file not found: ${audioPath}`);
  }

  if (process.platform === 'win32') {
    return _transcribeWindows(audioPath);
  }

  if (process.platform === 'darwin') {
    return _transcribeMac(audioPath);
  }

  return _transcribeLinux(audioPath);
}

async function _bufferToTempFile(buffer) {
  const tmpDir = require('os').tmpdir();
  const tmpPath = path.join(tmpDir, `darkcaptcha_audio_${Date.now()}.mp3`);
  fs.writeFileSync(tmpPath, buffer);
  return tmpPath;
}

function _transcribeWindows(audioPath) {
  const ext = path.extname(audioPath).toLowerCase();
  let wavPath = audioPath;

  if (ext !== '.wav') {
    wavPath = audioPath.replace(ext, '.wav');
    try {
      execSync(
        `Add-Type -AssemblyName System.Speech; ` +
        `$recognizer = New-Object System.Speech.Recognition.SpeechRecognizer;`,
        { shell: 'powershell', timeout: 10000 }
      );
    } catch {}
  }

  const psScript = `
Add-Type -AssemblyName System.Speech
$stream = [System.IO.File]::OpenRead('${wavPath.replace(/'/g, "''")}')
$reader = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(8000, 16, 1)
$recognizer = New-Object System.Speech.Recognition.SpeechRecognizer
$recognizer.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
$result = $recognizer.EmulateRecognizeAsync([System.Speech.AudioFormat.SpeechAudioFormatInfo]::new(8000, 16, 1), $stream)
Start-Sleep -Seconds 5
$result
$recognizer.Dispose()
$stream.Close()
`;

  try {
    const output = execSync(
      `powershell -NoProfile -Command "${psScript.Replace('"', '\\"')}"`,
      { timeout: 30000, encoding: 'utf8' }
    );
    const text = output.trim();
    if (text) return { text, confidence: 60 };
  } catch {}

  return { text: null, confidence: 0, error: 'Windows speech recognition failed' };
}

function _transcribeMac(audioPath) {
  try {
    const output = execSync(
      `ffmpeg -i "${audioPath}" -ar 16000 -ac 1 -f wav - | whisper - --language en 2>/dev/null`,
      { timeout: 60000, encoding: 'utf8', shell: true }
    );
    const text = output.trim();
    if (text) return { text, confidence: 65 };
  } catch {}

  try {
    const output = execSync(
      `ffmpeg -i "${audioPath}" -ar 16000 -ac 1 /tmp/darkcaptcha_temp.wav -y 2>/dev/null && ` +
      `pip3 install -q speechrecognition 2>/dev/null; ` +
      `python3 -c "
import speech_recognition as sr
r = sr.Recognizer()
with sr.AudioFile('/tmp/darkcaptcha_temp.wav') as src:
    audio = r.record(src)
try:
    print(r.recognize_google(audio))
except:
    print('')
" 2>/dev/null`,
      { timeout: 60000, encoding: 'utf8', shell: true }
    );
    const text = output.trim();
    if (text) return { text, confidence: 55 };
  } catch {}

  return { text: null, confidence: 0, error: 'Mac audio transcription failed. Try: brew install ffmpeg && pip3 install speechrecognition' };
}

function _transcribeLinux(audioPath) {
  try {
    const output = execSync(
      `ffmpeg -i "${audioPath}" -ar 16000 -ac 1 -f wav - | whisper - --language en 2>/dev/null`,
      { timeout: 60000, encoding: 'utf8', shell: true }
    );
    const text = output.trim();
    if (text) return { text, confidence: 65 };
  } catch {}

  try {
    const tmpWav = `/tmp/darkcaptcha_${Date.now()}.wav`;
    execSync(`ffmpeg -i "${audioPath}" -ar 16000 -ac 1 "${tmpWav}" -y 2>/dev/null`, { timeout: 15000 });
    const output = execSync(
      `python3 -c "
import speech_recognition as sr
r = sr.Recognizer()
with sr.AudioFile('${tmpWav}') as src:
    audio = r.record(src)
try:
    print(r.recognize_google(audio))
except:
    print('')
" 2>/dev/null`,
      { timeout: 30000, encoding: 'utf8', shell: true }
    );
    try { execSync(`rm "${tmpWav}"`); } catch {}
    const text = output.trim();
    if (text) return { text, confidence: 55 };
  } catch {}

  return { text: null, confidence: 0, error: 'Linux audio transcription failed. Install: ffmpeg, python3 -m pip install speechrecognition' };
}

module.exports = { transcribeAudio };
