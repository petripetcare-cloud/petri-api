import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

// NOTE: For real HEIC->JPG conversion on serverless, add 'sharp' to your project and convert after upload.
// Here we accept HEIC/JPEG/PNG up to ~20MB and return a signed URL.

export const config = {
  api: {
    bodyParser: false
  }
};

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const busboy = require('busboy');
    const bb = busboy({ headers: req.headers, limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB

    const result = { fields: {}, file: null };
    bb.on('file', (name, file, info) => {
      const { filename, mimeType } = info;
      const chunks = [];
      file.on('data', (d) => chunks.push(d));
      file.on('end', () => {
        result.file = { filename, mimeType, buffer: Buffer.concat(chunks) };
      });
    });
    bb.on('field', (name, val) => { result.fields[name] = val; });
    bb.on('error', reject);
    bb.on('finish', () => resolve(result));
    req.pipe(bb);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { file } = await parseMultipart(req);
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'petri-uploads';
    const ext = (file.filename.split('.').pop() || 'jpg').toLowerCase();
    const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: upErr } = await supabase.storage.from(bucket).upload(path, file.buffer, {
      contentType: file.mimeType,
      upsert: false
    });
    if (upErr) throw upErr;

    // Signed URL (short-lived)
    const { data: signed, error: urlErr } = await supabase
      .storage
      .from(bucket)
      .createSignedUrl(path, 60 * 10); // 10 minutes

    if (urlErr) throw urlErr;

    res.status(200).json({ ok: true, imageUrl: signed.signedUrl, path });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Upload failed', detail: String(e) });
  }
}
