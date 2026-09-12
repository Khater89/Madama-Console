# Madama Console

Internal platform that produces and manages social media content for the four
Madama Group facility-services companies: Hawks Facility Solutions, Pipes &
Wires, Simply Facility Solutions and Jayco Maintenance.

Three pieces, three places. Nothing here needs a build step, a bundler or a
package manager — the site is plain HTML5, CSS3 and vanilla JavaScript.

```
index.html   style.css   app.js        ->  GitHub Pages   (the console)
supabase/                              ->  Supabase       (the data)
n8n/                                   ->  n8n            (the engine)
```

---

## 1. The console — GitHub Pages

Upload `index.html`, `style.css` and `app.js` to the **root** of the repository,
side by side. The paths between them are relative, so nothing else is needed.

The connection settings are the `DEFAULTS` block at the top of **`app.js`**:

```js
var DEFAULTS = {
  url:         'https://….supabase.co',
  key:         'sb_publishable_…',
  hook:        'https://….app.n8n.cloud/webhook/madama-engine-run',
  fn_telegram: '…',   // the slug at the END of the Edge Function's URL
  fn_rewrite:  '',
  who:         '…'
};
```

Two things worth knowing about that block.

The **slug** is the last part of an Edge Function's URL, not its display name.
Supabase invents the slug when the function is created and renaming the function
afterwards changes only the label. Copy what comes after `/functions/v1/`.

Only the **publishable** key belongs here. `sb_secret_…` bypasses row level
security completely and belongs in n8n alone. This file is served publicly from
GitHub Pages, so treat everything in it as public — which it is.

Anything saved from the console's **Connection** tab is stored in that one
browser and overrides the built-in values. "Use built-in settings" clears it.

## 2. The data — Supabase

Run the SQL in order, once, in the SQL editor:

| file | what it does |
|---|---|
| `supabase/01-schema.sql` | the eight tables |
| `supabase/02-seed.sql` | the four companies, their services and brand voices |
| `supabase/03-grants.sql` | what the console is allowed to do from a browser |
| `supabase/04-branding-check.sql` | reports which companies are missing colours or a logo |

Every date-like column is `TEXT` on purpose: the engine writes an empty string
into those fields in ten different nodes, and a `timestamptz` column rejects
`''` outright.

### Edge Functions

`supabase/functions/` holds the two functions the console calls. Deploy each one,
then set its secret:

| function | secret it needs |
|---|---|
| `notify-telegram.ts` | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` |
| `rewrite-copy.ts` | `OPENAI_API_KEY` |

Both must be deployed with **Verify JWT turned off**. Supabase's built-in check
only understands the old JWT-based keys, so each function authorises the caller
itself instead — it compares the incoming `apikey` header against this project's
own keys. Note that a redeploy can switch that setting back on, so check it after
every deploy.

Connection → **Check Edge Functions** in the console tests both without doing any
work and without spending anything, and says which of the three things is wrong:
the slug, the JWT setting, or a missing secret.

## 3. The engine — n8n

Import `n8n/marketing-engine-v10.7.json`. Its only trigger is the webhook
`madama-engine-run`, so the workflow must be **Active** for the production URL to
answer. One run advances every eligible row by exactly one stage, which is why a
video post takes three runs: copy, then image, then video.

---

## How a post moves

```
New order  ->  Queue  ->  Review & edit  ->  Pending publishing  ->  Published
              (engine)    (you read and      (approved; Telegram    (live)
                           edit it)           has it)
```

A post is in exactly one tab at a time. Telegram fires on **approval**, never
while the engine is still producing — you see a post there only after you have
signed it off.

**Clear** empties one whole list. It is refused only while something is actually
being produced: the engine would otherwise write its result into a row that no
longer exists, and the money would be spent for nothing. A row that has been
sitting on "Generating" for more than fifteen minutes counts as dead, not busy.

## Costs

The console prices an order before it runs. A five-second 720p video is about
$0.51; images and copy are a fraction of that. Gemini billing is prepaid — when
the balance runs out the service suspends, and n8n reports it as a `429` whose
message misleadingly suggests spacing out requests.

## Still open

- Social accounts. `facebook_page_id`, `instagram_user_id` and
  `linkedin_organization_id` on `brands` are the last blocker for automatic
  publishing.
- Jayco has no brand colours, logo or art direction, so its images and videos
  come out generic. `04-branding-check.sql` shows what is missing.
- The console is open to anyone who has the link. Adding Supabase Auth and
  switching the policies in `03-grants.sql` from `to anon` to `to authenticated`
  is the fix when that matters.
