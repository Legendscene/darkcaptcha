let TransformersLib = null;

async function _ensureTransformers() {
  if (TransformersLib) return TransformersLib;
  try {
    TransformersLib = await import('@xenova/transformers');
    return TransformersLib;
  } catch (err) {
    throw new Error(
      'AI models not available.\n' +
      'Install: npm install @xenova/transformers\n' +
      'This adds local AI for solving image captchas without paid services.'
    );
  }
}

const MODEL_CACHE = {
  clip: null,
  processor: null,
};

async function getCLIP() {
  if (MODEL_CACHE.clip) return MODEL_CACHE.clip;

  const { pipeline } = await _ensureTransformers();
  console.error('[DarkCaptcha] Loading CLIP AI model (first time download ~600MB)...');

  MODEL_CACHE.clip = await pipeline(
    'zero-shot-image-classification',
    'Xenova/clip-vit-base-patch32',
    { quantized: true }
  );

  console.error('[DarkCaptcha] CLIP model ready.');
  return MODEL_CACHE.clip;
}

function isMLAvailable() {
  try {
    require.resolve('@xenova/transformers');
    return true;
  } catch {
    return false;
  }
}

module.exports = { getCLIP, isMLAvailable };
