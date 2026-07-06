const assert = require('node:assert/strict');
const test = require('node:test');

const { extractJson, generateGeminiContent, normalizeGeminiApiKey } = require('../src/gemini');

test('normalizeGeminiApiKey trims quotes and bearer prefix', () => {
  assert.equal(normalizeGeminiApiKey('  "Bearer abc123"  '), 'abc123');
});

test('extractJson parses fenced Gemini JSON responses', () => {
  assert.deepEqual(extractJson('```json\n{"price":95}\n```'), { price: 95 });
});

test('generateGeminiContent sends API key in X-goog-api-key header', async () => {
  const originalKey = process.env.GEMINI_API_KEY;
  const originalFetch = global.fetch;
  process.env.GEMINI_API_KEY = ' test-key ';
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'hola' }] } }] }),
    };
  };

  try {
    const result = await generateGeminiContent({ prompt: 'Hola' });
    assert.equal(result, 'hola');
    assert.equal(request.options.headers['X-goog-api-key'], 'test-key');
    assert.equal(request.url.includes('?key='), false);
  } finally {
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
    global.fetch = originalFetch;
  }
});
