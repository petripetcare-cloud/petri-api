import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

// Simple keyword search helper
async function keywordSearch({ message, species }) {
  // naive: search by species first, then ilike on question/answer
  const { data, error } = await supabase
    .from('petri_kb')
    .select('id, question, answer, species, tags, source_url')
    .eq('species', species || 'dog')
    .or(`question.ilike.%${message}%,answer.ilike.%${message}%`)
    .limit(3);

  if (error) throw error;
  return data || [];
}

// Compose Petri's warm answer
async function composeAnswer({ message, species, kbHits = [], imageObservation = null }) {
  const context = kbHits.map((r, i) => `(${i+1}) Q: ${r.question}\nA: ${r.answer}`).join('\n\n') || 'No verified KB matches.';

  const sys = `You are Petri, a warm, caring pet health assistant.
Speak clearly and briefly, with actionable steps. Offer caution without scaring.
If using verified KB matches, base your advice on them. If none, you may still help, but say it is not from the verified database.
Offer to share a trusted vet reference if relevant.`;

  const user = [
    imageObservation ? `Image observation: ${imageObservation}` : null,
    `User message: ${message}`,
    species ? `Species: ${species}` : null,
    `KB context (may be empty):\n${context}`
  ].filter(Boolean).join('\n\n');

  const resp = await openai.chat.completions.create({
    model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: user }
    ],
    temperature: 0.6
  });

  return resp.choices?.[0]?.message?.content?.trim() || 'Sorry, I had trouble composing an answer.';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { message, species, imageUrl } = body || {};

    let imageObservation = null;
    if (imageUrl) {
      // Vision assist: describe the image first, short summary
      const vis = await openai.chat.completions.create({
        model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a vision assistant. Briefly describe clinically relevant visible details in the pet photo (e.g., redness, swelling, discharge). 1-2 sentences.' },
          {
            role: 'user',
            content: [
              { type: 'input_text', text: 'Describe this image for a veterinarian in 1-2 sentences.' },
              { type: 'input_image', image_url: imageUrl }
            ]
          }
        ],
        temperature: 0.2
      });
      imageObservation = vis.choices?.[0]?.message?.content?.trim() || null;
    }

    // Keyword search first (semantic later)
    const kbHits = await keywordSearch({ message, species });

    const answer = await composeAnswer({ message, species, kbHits, imageObservation });

    res.status(200).json({
      ok: true,
      answer,
      usedKb: kbHits.length > 0,
      kbIds: kbHits.map(r => r.id),
      sources: kbHits.map(r => r.source_url).filter(Boolean) // only show in UI if user asks
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error', detail: String(e) });
  }
}
