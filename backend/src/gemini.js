const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

function extractJson(text) {
  const raw = String(text || '').trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try { return JSON.parse(candidate.slice(start, end + 1)); } catch { return null; }
}

async function generateGeminiContent({ prompt, image, schemaHint }) {
  if (!process.env.GEMINI_API_KEY) {
    const error = new Error('GEMINI_API_KEY no configurada');
    error.code = 'GEMINI_NOT_CONFIGURED';
    throw error;
  }

  const parts = [{ text: `${prompt}\n\n${schemaHint || ''}`.trim() }];
  if (image?.buffer && image?.mimetype) {
    parts.push({ inlineData: { mimeType: image.mimetype, data: image.buffer.toString('base64') } });
  }

  const response = await fetch(`${GEMINI_API_URL}/models/${DEFAULT_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature: 0.35, responseMimeType: schemaHint ? 'application/json' : 'text/plain' },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error?.message || 'Gemini no pudo generar respuesta');
    error.code = 'GEMINI_REQUEST_FAILED';
    throw error;
  }
  return data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n').trim() || '';
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
    return { ...fallbackQuote(hints), aiWarning: error.code === 'GEMINI_NOT_CONFIGURED' ? 'Configura GEMINI_API_KEY para activar Gemini.' : 'Gemini no respondió; se usó cotización local.' };
  }
}

async function assistantReply({ message, services = [] }) {
  const serviceList = services.map((s) => `${s.name}: S/ ${s.base_price || s.price}, ${s.duration_minutes || s.duration} min`).join('; ');
  const prompt = `Eres una asesora de belleza y ventas para un salón de uñas en Perú. Responde en español, tono cálido y breve, recomienda servicios adicionales solo si aportan valor. Servicios disponibles: ${serviceList || 'manicure, gel, acrílicas, soft gel y nail art'}. Pregunta: ${message}`;
  try {
    const text = await generateGeminiContent({ prompt });
    return { reply: text || 'Claro, cuéntame qué estilo buscas y te recomiendo una opción.', source: 'gemini' };
  } catch (error) {
    return { reply: 'Puedo ayudarte con precios, diseños y reservas. Para una ocasión especial recomiendo Soft Gel nude con brillo perlado y Nail Art sutil.', source: 'fallback', aiWarning: error.code === 'GEMINI_NOT_CONFIGURED' ? 'Configura GEMINI_API_KEY para activar Gemini.' : 'Gemini no respondió; se usó respuesta local.' };
  }
}

module.exports = { quoteDesign, assistantReply };
