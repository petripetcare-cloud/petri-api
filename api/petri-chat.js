// api/petri-chat.js  (DIAGNOSTIC VERSION)
export default async function handler(req, res) {
  // CORS + preflight
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed", method: req.method });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { message, species, imageUrl } = body;

    // DO NOT log secrets; just tell if they exist
    const envFlags = {
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE: !!process.env.SUPABASE_SERVICE_ROLE,
      SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
      SUPABASE_STORAGE_BUCKET: !!process.env.SUPABASE_STORAGE_BUCKET
    };

    return res.status(200).json({
      ok: true,
      echo: { message, species, imageUrl },
      envFlags,
      note: "Diagnostic handler active: no OpenAI or Supabase calls."
    });
  } catch (e) {
    console.error("petri-chat DIAG error:", e);
    return res.status(500).json({ error: "Diagnostic failure", detail: String(e) });
  }
}
