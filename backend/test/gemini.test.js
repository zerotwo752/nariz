const assert = require('node:assert/strict');
const test = require('node:test');

const { assistantReply, extractJson, generateGeminiContent, localAssistantReply, normalizeGeminiApiKey } = require('../src/gemini');

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


test('localAssistantReply lists the only available product with price', () => {
  const result = localAssistantReply({
    message: '¿Qué productos tiene?',
    services: [],
    products: [{ name: 'Uña acrílica roja', description: 'Set rojo intenso', category: 'uñas', price: 45, stock: 3 }],
  });

  assert.match(result, /Uña acrílica roja/);
  assert.match(result, /S\/ 45/);
});

test('localAssistantReply asks a narrowing question for large catalogs', () => {
  const products = Array.from({ length: 12 }, (_, index) => ({
    name: `Producto ${index + 1}`,
    description: 'Color variado',
    category: 'uñas',
    price: 30 + index,
    stock: 1,
  }));

  const result = localAssistantReply({ message: '¿Qué productos tiene?', services: [], products });
  assert.match(result, /color específico|tipo de uña|evento especial/);
});

test('assistantReply fallback uses catalog when Gemini fails', async () => {
  const originalKey = process.env.GEMINI_API_KEY;
  const originalFetch = global.fetch;
  process.env.GEMINI_API_KEY = 'test-key';
  global.fetch = async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'bad request' } }) });

  try {
    const result = await assistantReply({
      message: 'Busco rojo',
      services: [],
      products: [{ name: 'Uña acrílica roja', description: 'Set rojo intenso', category: 'uñas', price: 45, stock: 3 }],
    });
    assert.equal(result.source, 'fallback');
    assert.match(result.aiWarning, /HTTP 400/);
    assert.match(result.reply, /Uña acrílica roja/);
  } finally {
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
    global.fetch = originalFetch;
  }
});
