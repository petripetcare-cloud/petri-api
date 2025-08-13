// api/petri-chat.js — DIAGNOSTIC VERSION
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

    // Quick env sanity (DON'T log secret values)
    const flags = {
      hasOPENAI: !!process.env.OPENAI_API_KEY,
      hasSUPABASE_URL: !!process.env.SUPABASE_URL,
      hasSERVICE_ROLE: !!process.env.SUPABASE_SERVICE_ROLE
    };

    return res.status(200).json({
      ok: true,
      echo: { message, species, imageUrl },
      env: flags,
      note: "Diagnostic handler: no OpenAI/Supabase calls yet."
    });
  } catch (e) {
    console.error("petri-chat DIAG error:", e);
    return res.status(500).json({ error: "Diagnostic failure", detail: String(e) });
  }
}
