// ============================================================================
//  supabase/functions/<your slug>/index.ts          (display name: rewrite-copy)
//
//  Rewrites one post's copy with OpenAI, on YOUR instruction.
//
//  Why this exists as an Edge Function instead of a fetch from the console:
//  an OpenAI key in a browser page is readable by anyone who opens that page,
//  and anyone who finds it can spend your balance. The key lives here as a
//  Supabase secret; the browser only ever sends the row id and the instruction.
//
//  TWO DEPLOYMENT FACTS THAT BITE:
//
//  1. The function's SLUG is the last part of its URL and is fixed when the
//     function is created. Renaming it in the dashboard changes the label only.
//     Whatever the slug is, paste it into the console under Connection.
//
//  2. Supabase's built-in "Verify JWT" only understands the legacy anon /
//     service_role keys. With sb_publishable_ keys it rejects every call, so
//     that setting must be OFF for this function. This one spends money on
//     every call, so it authorises the caller itself — see `authorize`.
//
//  Secret this function needs:
//    OPENAI_API_KEY=sk-...
// ============================================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

// ---------------------------------------------------------------------------
//  Every API key this project recognises. Supabase injects the new keys as JSON
//  dictionaries (SUPABASE_PUBLISHABLE_KEYS / SUPABASE_SECRET_KEYS) and the old
//  ones as plain strings; accept whichever shape is present.
// ---------------------------------------------------------------------------
function projectKeys(): string[] {
  const out: string[] = [];
  for (const name of ['SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_SECRET_KEYS']) {
    const raw = Deno.env.get(name);
    if (!raw) continue;
    try {
      for (const v of Object.values(JSON.parse(raw))) if (typeof v === 'string' && v) out.push(v);
    } catch { if (raw.trim()) out.push(raw.trim()); }
  }
  for (const name of ['SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY',
                      'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
    const v = Deno.env.get(name);
    if (v) out.push(v);
  }
  return out;
}

// With "Verify JWT" off, anyone who knows this URL could call it and spend the
// OpenAI balance. So the caller must present a key belonging to this project.
async function authorize(req: Request, supaUrl: string): Promise<boolean> {
  const presented = (req.headers.get('apikey') ||
                     (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')).trim();
  if (!presented) return false;
  const known = projectKeys();
  if (known.length) return known.includes(presented);
  // Nothing in the environment to compare against: let the database decide.
  try {
    const r = await fetch(`${supaUrl}/rest/v1/brands?select=brand_id&limit=1`, { headers: { apikey: presented } });
    return r.ok;
  } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const OPENAI = Deno.env.get('OPENAI_API_KEY');
  const SUPA_URL = Deno.env.get('SUPABASE_URL') ?? '';

  // Supabase is mid-migration on key names. A project created today injects
  // SUPABASE_SECRET_KEYS - a JSON dictionary, not a single string - while older
  // projects still inject SUPABASE_SERVICE_ROLE_KEY. Accept whichever is present.
  const SUPA_KEY = (() => {
    const dict = Deno.env.get('SUPABASE_SECRET_KEYS');
    if (dict) {
      try {
        const parsed = JSON.parse(dict);
        const first = Object.values(parsed).find((v) => typeof v === 'string' && v);
        if (first) return first as string;
      } catch { /* fall through to the legacy names */ }
    }
    return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY') ?? '';
  })();

  if (!(await authorize(req, SUPA_URL))) {
    return json({ error: 'Not authorised — send this project\'s publishable key on the apikey header.' }, 401);
  }

  if (!OPENAI) return json({ error: 'OPENAI_API_KEY is not set on this project.' }, 500);
  if (!SUPA_URL || !SUPA_KEY) return json({ error: 'This function cannot reach the database — no service key in the environment.' }, 500);

  let id = '', instruction = '', model = 'gpt-5.6';
  try {
    const body = await req.json();
    id = String(body.id ?? '').trim();
    instruction = String(body.instruction ?? '').trim();
    if (body.model) model = String(body.model);
  } catch {
    return json({ error: 'Body must be JSON.' }, 400);
  }
  if (!id) return json({ error: 'Which row? Send an id.' }, 400);
  if (!instruction) return json({ error: 'Say what to change.' }, 400);

  // ---- read the row and its brand, server side ----
  const rest = async (path: string) => {
    const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
      // sb_secret_ keys are not JWTs: they go on apikey only, never Authorization.
      headers: /^sb_secret_/.test(SUPA_KEY)
        ? { apikey: SUPA_KEY }
        : { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    });
    if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
    return r.json();
  };

  let row: Record<string, unknown>, brand: Record<string, unknown>;
  try {
    const rows = await rest(`content_queue?select=*&id=eq.${encodeURIComponent(id)}`);
    if (!rows.length) return json({ error: 'No such row.' }, 404);
    row = rows[0];
    const brands = await rest(`brands?select=*&brand_id=eq.${encodeURIComponent(String(row.brand_id))}`);
    brand = brands[0] ?? {};
  } catch (e) {
    return json({ error: `Could not read the row: ${(e as Error).message}` }, 500);
  }

  const platform = String(row.target_platform ?? '').toLowerCase();
  const field = platform === 'facebook' ? 'generated_facebook'
              : platform === 'instagram' ? 'generated_instagram'
              : 'generated_linkedin';
  const current = String(row[field] ?? '');

  // ---- rewrite ----
  const system = [
    'You rewrite one finished social media post for a facility services company.',
    'Return ONLY the rewritten post text. No preamble, no quotes around it, no commentary.',
    'Keep the same language as the original.',
    'Keep the contact block at the end exactly as it is, character for character.',
    'Never invent prices, guarantees, certifications, availability claims or results',
    'that are not already in the company facts below.',
  ].join(' ');

  const user = [
    `Company: ${brand.company_name ?? row.brand_id}`,
    `Company facts (the only facts you may use): ${brand.brand_context ?? ''}`,
    `Tone of voice: ${brand.tone_of_voice ?? ''}`,
    `Platform: ${row.target_platform}`,
    `Service: ${row.content_pillar}`,
    '',
    'CURRENT POST:',
    current,
    '',
    'WHAT TO CHANGE:',
    instruction,
  ].join('\n');

  let text = '';
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    const data = await r.json();
    if (!r.ok) return json({ error: data?.error?.message ?? `OpenAI returned ${r.status}` }, 502);
    text = String(data?.choices?.[0]?.message?.content ?? '').trim();
    if (!text) return json({ error: 'OpenAI returned an empty rewrite.' }, 502);
  } catch (e) {
    return json({ error: `OpenAI call failed: ${(e as Error).message}` }, 502);
  }

  // The rewrite is returned, NOT saved. The console shows it next to the original
  // so a person decides - an AI edit should never overwrite approved-track copy
  // without someone seeing it first.
  return json({ id, field, original: current, rewritten: text });
});
