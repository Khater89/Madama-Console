// ============================================================================
//  supabase/functions/<your slug>/index.ts        (display name: notify-telegram)
//
//  Sends one approved post to Telegram — the image or video with the copy as its
//  caption, or a plain message for a text-only post.
//
//  This fires on APPROVAL, not while the engine is producing. You see a post on
//  Telegram only after you have read it and signed it off.
//
//  The bot token lives here as a project secret. It is never in the console page.
//
//  TWO DEPLOYMENT FACTS THAT BITE:
//
//  1. The function's SLUG is the last part of its URL and is fixed when the
//     function is created. Renaming it in the dashboard changes the label only.
//     Whatever the slug is, paste it into the console under Connection.
//
//  2. Supabase's built-in "Verify JWT" only understands the legacy anon /
//     service_role keys. With sb_publishable_ keys it rejects every call, so
//     that setting must be OFF for this function. Which is why the function
//     authorises the caller itself, below — see `authorize`.
//
//  Secrets this function needs:
//    TELEGRAM_BOT_TOKEN=123456:AA...
//    TELEGRAM_CHAT_ID=-5451423584
// ============================================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

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

// With "Verify JWT" off, anyone who knows this URL can call it. So the caller
// must present a key belonging to this project — the console sends the
// publishable key on the apikey header, exactly as it does for the database.
async function authorize(req: Request, supaUrl: string): Promise<boolean> {
  const presented = (req.headers.get('apikey') ||
                     (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')).trim();
  if (!presented) return false;
  const known = projectKeys();
  if (known.length) return known.includes(presented);
  // Nothing in the environment to compare against: let the database decide.
  // A key this project does not recognise cannot read a single row.
  try {
    const r = await fetch(`${supaUrl}/rest/v1/brands?select=brand_id&limit=1`, { headers: { apikey: presented } });
    return r.ok;
  } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const CHAT = Deno.env.get('TELEGRAM_CHAT_ID');
  const SUPA_URL = Deno.env.get('SUPABASE_URL') ?? '';

  // Supabase is mid-migration on key names: new projects inject SUPABASE_SECRET_KEYS
  // as a JSON dictionary, older ones inject SUPABASE_SERVICE_ROLE_KEY.
  const SUPA_KEY = (() => {
    const dict = Deno.env.get('SUPABASE_SECRET_KEYS');
    if (dict) {
      try {
        const first = Object.values(JSON.parse(dict)).find((v) => typeof v === 'string' && v);
        if (first) return first as string;
      } catch { /* fall through */ }
    }
    return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY') ?? '';
  })();

  if (!(await authorize(req, SUPA_URL))) {
    return json({ error: 'Not authorised — send this project\'s publishable key on the apikey header.' }, 401);
  }

  if (!TOKEN) return json({ error: 'TELEGRAM_BOT_TOKEN is not set on this project.' }, 500);
  if (!CHAT)  return json({ error: 'TELEGRAM_CHAT_ID is not set on this project.' }, 500);
  if (!SUPA_URL || !SUPA_KEY) return json({ error: 'This function cannot reach the database.' }, 500);

  let id = '';
  try { id = String((await req.json()).id ?? '').trim(); }
  catch { return json({ error: 'Body must be JSON.' }, 400); }
  if (!id) return json({ error: 'Which row? Send an id.' }, 400);

  const headers = /^sb_secret_/.test(SUPA_KEY)
    ? { apikey: SUPA_KEY }
    : { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` };

  const rest = async (path: string) => {
    const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, { headers });
    if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
    return r.json();
  };

  let row: Record<string, string>, brand: Record<string, string>;
  try {
    const rows = await rest(`content_queue?select=*&id=eq.${encodeURIComponent(id)}`);
    if (!rows.length) return json({ error: 'No such row.' }, 404);
    row = rows[0];
    const brands = await rest(`brands?select=*&brand_id=eq.${encodeURIComponent(row.brand_id)}`);
    brand = brands[0] ?? {};
  } catch (e) {
    return json({ error: `Could not read the row: ${(e as Error).message}` }, 500);
  }

  const platform = String(row.target_platform ?? '').toLowerCase();
  const copy = platform === 'facebook' ? row.generated_facebook
             : platform === 'instagram' ? row.generated_instagram
             : row.generated_linkedin;

  const head = [
    `✅ APPROVED — ${platform.toUpperCase()}`,
    `\u{1F3E2} ${brand.company_name || row.brand_id}`,
    `\u{1F527} ${row.content_pillar || ''}`,
    `\u{1F9FE} ${row.id}`,
    '',
  ].join('\n');

  // Telegram caps a photo/video caption at 1024 characters and a message at 4096.
  // Long copy goes as a separate message right after the media rather than being cut.
  const full = head + String(copy || '').trim();
  const api = (m: string) => `https://api.telegram.org/bot${TOKEN}/${m}`;
  const send = async (method: string, body: Record<string, unknown>) => {
    const r = await fetch(api(method), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT, ...body }),
    });
    const d = await r.json();
    if (!d.ok) throw new Error(d.description || `Telegram ${method} failed`);
    return d;
  };

  try {
    const short = full.length <= 1024;
    if (row.video_url) {
      await send('sendVideo', { video: row.video_url, caption: short ? full : head.trim() });
    } else if (row.image_url) {
      await send('sendPhoto', { photo: row.image_url, caption: short ? full : head.trim() });
    } else {
      await send('sendMessage', { text: full.slice(0, 4096), disable_web_page_preview: true });
      return json({ ok: true, sent: 'text' });
    }
    if (!short) await send('sendMessage', { text: String(copy || '').slice(0, 4096), disable_web_page_preview: true });
    return json({ ok: true, sent: row.video_url ? 'video' : 'photo' });
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
});
