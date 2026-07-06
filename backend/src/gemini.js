const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const MAX_CONTEXT_ITEMS = 30;

function normalizeGeminiApiKey(value) {
  return String(value || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/^Bearer\s+/i, '');
}

function getGeminiApiKey() {
  const key = normalizeGeminiApiKey(process.env.GEMINI_API_KEY);
  if (key) process.env.GEMINI_API_KEY = key;
  return key;
}

function extractJson(text) {
  const raw = String(text || '').trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try { return JSON.parse(candidate.slice(start, end + 1)); } catch { return null; }
}

function buildGeminiError(data, status) {
  const message = data.error?.message || 'Gemini no pudo generar respuesta';
  const error = new Error(message);
  error.code = 'GEMINI_REQUEST_FAILED';
  error.status = status;
  return error;
}

async function generateGeminiContent({ prompt, image, schemaHint }) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    const error = new Error('GEMINI_API_KEY no configurada');
    error.code = 'GEMINI_NOT_CONFIGURED';
    throw error;
  }

  const parts = [{ text: `${prompt}\n\n${schemaHint || ''}`.trim() }];
  if (image?.buffer && image?.mimetype) {
    parts.push({ inlineData: { mimeType: image.mimetype, data: image.buffer.toString('base64') } });
  }

  const response = await fetch(`${GEMINI_API_URL}/models/${DEFAULT_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature: 0.35, responseMimeType: schemaHint ? 'application/json' : 'text/plain' },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw buildGeminiError(data, response.status);
  return data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n').trim() || '';
}

function money(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `S/ ${number.toFixed(number % 1 ? 2 : 0)}` : 'precio por confirmar';
}

function formatCatalogItem(item) {
  const price = money(item.base_price ?? item.price);
  const duration = item.duration_minutes || item.duration;
  const stock = item.stock === undefined ? '' : `, stock: ${item.stock}`;
  return `${item.name}: ${price}${duration ? `, ${duration} min` : ''}${stock}${item.description ? ` - ${item.description}` : ''}`;
}

function buildCatalogContext({ services = [], products = [] }) {
  const activeProducts = products.filter((product) => Number(product.stock ?? 1) > 0);
  return {
    services: services.slice(0, MAX_CONTEXT_ITEMS),
    products: activeProducts.slice(0, MAX_CONTEXT_ITEMS),
    hasMoreServices: services.length > MAX_CONTEXT_ITEMS,
    hasMoreProducts: activeProducts.length > MAX_CONTEXT_ITEMS,
  };
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3);
}

function filterCatalogByMessage(items, message) {
  const tokens = tokenize(message);
  if (!tokens.length) return [];
  return items.filter((item) => {
    const haystack = tokenize(`${item.name} ${item.description || ''} ${item.category || ''} ${item.sku || ''}`);
    return tokens.some((token) => haystack.includes(token));
  });
}

function localAssistantReply({ message, services = [], products = [] }) {
  const text = String(message || '').toLowerCase();
  const wantsCatalog = /producto|productos|vende|venden|tiene|tienen|precio|precios|catalogo|catálogo|servicio|servicios|rojo|nude|gel|acrilic|uñas|unas/.test(text);
  const productMatches = filterCatalogByMessage(products, message);
  const serviceMatches = filterCatalogByMessage(services, message);
  const availableProducts = products.filter((product) => Number(product.stock ?? 1) > 0);
  const items = [...productMatches, ...serviceMatches];

  if (items.length) {
    return `Sí, de momento encontré estas opciones para ti:\n${items.slice(0, 6).map((item) => `• ${formatCatalogItem(item)}`).join('\n')}\n¿Te gustaría que te ayude a reservar o buscas algún color/ocasión en específico?`;
  }

  if (wantsCatalog) {
    if (availableProducts.length === 1 && services.length === 0) {
      return `De momento tenemos este producto disponible: ${formatCatalogItem(availableProducts[0])}. ¿Te gustaría llevarlo o quieres que te ayude con una reserva?`;
    }
    if (availableProducts.length <= 6 && services.length <= 6) {
      const catalog = [...availableProducts, ...services];
      if (catalog.length) return `De momento tenemos estas opciones:\n${catalog.map((item) => `• ${formatCatalogItem(item)}`).join('\n')}\n¿Te gustaría alguna?`;
    }
    return 'Tenemos varias opciones disponibles. Para recomendarte mejor, ¿buscas algún color específico, tipo de uña (acrílica, gel, press-on) o es para algún evento especial?';
  }

  return 'Claro, puedo ayudarte con productos, precios, diseños y reservas. Cuéntame qué color, estilo u ocasión tienes en mente y reviso las opciones disponibles.';
}

function fallbackQuote(hints = '') {
  const lower = String(hints).toLowerCase();
  const high = /piedra|3d|boda|relieve|espejo|cristal|encapsulado|chrome/.test(lower);
  return {
    difficulty: high ? 'Alta' : 'Media',
    estimatedMinutes: high ? 135 : 95,
    price: high ? 150 : 95,
    materials: ['Acrílico', 'Nail Art', 'Esmalte permanente', high ? 'Piedras' : 'Brillo'],
    explanation: high ? 'Cotización preliminar por complejidad alta; el salón revisará el precio antes de confirmar.' : 'Cotización preliminar automática basada en descripción y reglas de precio.',
    requiresReview: high,
    source: 'fallback',
  };
}

async function quoteDesign({ hints, image }) {
  const schemaHint = 'Devuelve solo JSON válido con: difficulty string (Baja, Media, Alta o Especial), estimatedMinutes number, price number en soles peruanos, materials array de strings, explanation string breve, requiresReview boolean.';
  const prompt = `Actúa como cotizadora experta de un salón de manicure y nail art en Perú. Analiza la imagen y/o descripción, detecta tipo de uñas, longitud, colores, nail art, piedras, relieves y complejidad. Descripción: ${hints || 'Sin descripción adicional'}`;
  try {
    const text = await generateGeminiContent({ prompt, image, schemaHint });
    const parsed = extractJson(text);
    if (!parsed) return fallbackQuote(hints);
    return {
      difficulty: parsed.difficulty || 'Media',
      estimatedMinutes: Number(parsed.estimatedMinutes) || 95,
      price: Number(parsed.price) || 95,
      materials: Array.isArray(parsed.materials) ? parsed.materials.slice(0, 8) : ['Nail Art'],
      explanation: parsed.explanation || 'Cotización generada con IA.',
      requiresReview: Boolean(parsed.requiresReview),
      source: 'gemini',
    };
  } catch (error) {
    return { ...fallbackQuote(hints), aiWarning: error.code === 'GEMINI_NOT_CONFIGURED' ? 'Configura GEMINI_API_KEY para activar Gemini.' : `Gemini no respondió${error.status ? ` (HTTP ${error.status})` : ''}; se usó cotización local.` };
  }
}

async function assistantReply({ message, services = [], products = [], specialists = [], availability = [] }) {
  const catalog = buildCatalogContext({ services, products });
  const serviceList = catalog.services.map(formatCatalogItem).join('\n');
  const productList = catalog.products.map(formatCatalogItem).join('\n');
  const specialistList = specialists.map((sp) => `${sp.full_name}: atiende de ${String(sp.work_start).slice(0,5)} a ${String(sp.work_end).slice(0,5)}; especialidades: ${sp.specialties || 'por confirmar'}`).join('\n');
  const bookingList = availability.map((b) => `${b.specialist_name}: ${b.service_name} el ${new Date(b.starts_at).toLocaleString('es-PE', { timeZone: 'America/Lima' })}, bloquea ${Number(b.duration_minutes) + Number(b.buffer_minutes || 15)} min, estado ${b.status}`).join('\n');
  const prompt = `Eres una asesora de belleza y ventas para un salón de uñas en Perú. Responde en español, tono cálido y breve.
Usa SOLO los servicios y productos disponibles abajo; no inventes productos, precios, colores ni servicios.
Si hay 1 o pocos resultados relevantes, menciónalos con precio y pregunta si le gustaría reservar o comprar.
Si hay muchos productos o la pregunta es amplia, no listes todo: pregunta por color, tipo de uña u ocasión.
Si no hay coincidencias, dilo con amabilidad y ofrece buscar por color, evento o tipo.
Si preguntan por horarios, reservas o trabajadoras, usa los horarios laborales, especialidades y reservas ocupadas; explica que la reserva se confirma desde la página.

Servicios disponibles:\n${serviceList || 'Sin servicios cargados'}
${catalog.hasMoreServices ? '\nHay más servicios no listados en este contexto.' : ''}

Productos disponibles con stock:\n${productList || 'Sin productos cargados'}
${catalog.hasMoreProducts ? '\nHay más productos no listados en este contexto.' : ''}

Trabajadoras activas:\n${specialistList || 'Sin trabajadoras cargadas'}

Reservas ocupadas próximas:\n${bookingList || 'Sin reservas próximas registradas'}

Pregunta del cliente: ${message}`;
  try {
    const text = await generateGeminiContent({ prompt });
    return { reply: text || localAssistantReply({ message, services, products }), source: 'gemini' };
  } catch (error) {
    return { reply: localAssistantReply({ message, services, products }), source: 'fallback', aiWarning: error.code === 'GEMINI_NOT_CONFIGURED' ? 'Configura GEMINI_API_KEY para activar Gemini.' : `Gemini no respondió${error.status ? ` (HTTP ${error.status})` : ''}; se usó respuesta local.` };
  }
}

module.exports = { quoteDesign, assistantReply, generateGeminiContent, extractJson, normalizeGeminiApiKey, localAssistantReply };
