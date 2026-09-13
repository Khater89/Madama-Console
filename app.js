'use strict';

/* ============================================================================
   BUILT-IN CONNECTION  —  fill these five lines in, commit, and the page is
   connected for everyone who opens the link.

   Why this block has to exist: the TABLES live in Supabase and are shared by
   everyone, but the settings that REACH Supabase cannot themselves live in
   Supabase — the page needs the address and the key before it can read a single
   row. Until now they sat in each browser's own storage, which is why the page
   was connected on your machine and empty on anyone else's.

   Only the PUBLISHABLE key (sb_publishable_…) goes here. Never the secret key:
   this file is served publicly from GitHub Pages and anyone can read it.

   THE TWO EMPTY LINES BELOW ARE THE WHOLE JOB. The quickest place to copy them
   from is your own screen: open the page on the machine where the console already
   works, go to Connection, and the boxes there hold the exact values.
   ============================================================================ */
var DEFAULTS = {
  url:         'https://eviqqynpcmyukaijelxg.supabase.co',
  key:         'sb_publishable_8ie-cUObKlxbhqqh_pwuxg_OxyNf4b8',
  hook:        'https://jacob-89.app.n8n.cloud/webhook/madama-engine-run',
  fn_telegram: 'bright-processor',   // the slug at the end of the Telegram function's URL
  fn_rewrite:  '',   // stays empty until the rewrite function is deployed
  who:         'Khater'              // the name recorded on approvals
};

var $ = function(s){ return document.querySelector(s); };
var $$ = function(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); };
var CFG = {}, BRANDS = [], OPTIONS = [];
var PLATFORMS = ['facebook','instagram','linkedin'];
var PLATNAME = { facebook:'Facebook', instagram:'Instagram', linkedin:'LinkedIn' };
var MEDIA = ['Text Only','Image','Short Video','Image + Short Video'];

/* ---------- rates: same figures as the Publish Ledger ---------- */
var RATE = { textIn:2/1e6, textOut:12/1e6, imgOut:30/1e6, imgTok:6000,
             vid720:0.1014, mul1080:1.55, creditUSD:0.027, vqa:0.01 };
var TOK = { draft:{i:2200,o:900}, polish:{i:1800,o:900}, imgqa:{i:1600,o:250} };

/* A toast that explains a failure has to stay up long enough to be read. Short
   confirmations still vanish quickly; anything long gets time per word, and a
   click dismisses it early. */
function toast(msg){
  var t = $('#toast'); t.textContent = msg; t.hidden = false;
  var ms = Math.min(20000, Math.max(2600, String(msg).length * 55));
  clearTimeout(toast._t); toast._t = setTimeout(function(){ t.hidden = true; }, ms);
  t.onclick = function(){ clearTimeout(toast._t); t.hidden = true; };
}
function note(el, kind, html){
  el.innerHTML = html ? '<div class="note ' + kind + '">' + html + '</div>' : '';
}
function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c];
  });
}

/* ---------- Supabase REST. The publishable key goes on the apikey header
     ONLY - Supabase rejects it on Authorization with "Invalid JWT". ---------- */
function api(path, opts){
  opts = opts || {};
  if (!CFG.url || !CFG.key) return Promise.reject(new Error('Set the connection first.'));
  var h = { 'apikey': CFG.key, 'Content-Type': 'application/json' };
  if (opts.prefer) h['Prefer'] = opts.prefer;
  return fetch(CFG.url.replace(/\/$/,'') + '/rest/v1/' + path, {
    method: opts.method || 'GET', headers: h,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  }).then(function(r){
    return r.text().then(function(t){
      var data = t ? JSON.parse(t) : null;
      if (!r.ok) throw new Error((data && (data.message || data.hint)) || (r.status + ' ' + r.statusText));
      return data;
    });
  });
}

/* ---------- Supabase Edge Functions ----------
   Two things make these fail in ways that look like nothing happening at all.

   The slug: a function's URL ends with the slug it was created under, and the
   dashboard invents that slug for you. Renaming the function afterwards changes
   the label above the URL and nothing else. So the slug is a SETTING here, not a
   constant in this file - otherwise one rename breaks Approve with no message.

   The key: sb_publishable_ keys are not JWTs. Supabase's built-in "Verify JWT"
   only understands the old anon key, so it must be OFF on these functions, and
   the key goes on the apikey header ONLY - never on Authorization, which is
   parsed as a JWT and rejected. The functions check the key themselves instead. */
var FN_DEFAULT = { telegram:'notify-telegram', rewrite:'rewrite-copy' };
function fnSlug(which){
  return String(CFG['fn_' + which] || FN_DEFAULT[which]).trim().replace(/^\/+|\/+$/g, '');
}
function fnUrl(which){
  return CFG.url.replace(/\/$/,'') + '/functions/v1/' + fnSlug(which);
}
function callFn(which, body){
  if (!CFG.url || !CFG.key) return Promise.reject(new Error('set the connection first.'));
  var slug = fnSlug(which);
  return fetch(fnUrl(which), {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'apikey': CFG.key },
    body: JSON.stringify(body)
  }).then(function(r){
    return r.text().then(function(t){
      var d = null; try { d = t ? JSON.parse(t) : null; } catch(e){}
      if (r.ok) return d || {};
      if (r.status === 404) throw new Error('this project has no function called "' + slug +
        '". Open Supabase → Edge Functions, copy the last part of the function URL, and paste it into Connection.');
      if (r.status === 401 || r.status === 403) throw new Error('the function refused the key. Open the function’s settings and turn "Verify JWT" off — a publishable key is not a JWT.');
      throw new Error((d && (d.error || d.message)) || (r.status + ' ' + r.statusText));
    });
  }, function(netErr){
    /* A rejected fetch means the browser never got a readable answer. The usual
       cause is not the network: it is "Verify JWT" still switched on, where the
       gateway turns the call away before the function runs and answers without
       the CORS header the browser needs to show us why. */
    throw new Error('no answer from ' + fnUrl(which) + ' (' + netErr.message +
      '). Check the slug under Connection, and that "Verify JWT" is off on that function.');
  });
}
/* Ask each function what state it is in without doing any work - and without
   spending a cent on OpenAI. An empty body is valid JSON with no id, so a
   healthy function answers 400 "Which row? Send an id." Anything else is a
   specific, nameable problem. */
function fnProbe(which){
  var slug = fnSlug(which);
  return fetch(fnUrl(which), {
    method:'POST', headers:{ 'Content-Type':'application/json', 'apikey': CFG.key }, body:'{}'
  }).then(function(r){
    return r.text().then(function(t){
      var d = null; try { d = t ? JSON.parse(t) : null; } catch(e){}
      var msg = (d && (d.error || d.message)) || t || '';
      if (r.status === 400) return { ok:true,  text:'ready.' };
      if (r.status === 404) return { ok:false, text:'not found. Nothing on this project answers to the slug <code>' + esc(slug) + '</code>.' };
      if (r.status === 401 || r.status === 403) return { ok:false, text:'reachable, but it refused the key (' + r.status + '). Turn <strong>Verify JWT</strong> off in the function’s settings.' };
      if (r.status === 500) return { ok:false, text:'deployed, but something is missing: ' + esc(msg) };
      return { ok:false, text:r.status + ' — ' + esc(msg) };
    });
  }).catch(function(e){
    return { ok:false, text:'no answer at all (' + esc(e.message) +
      '). Either the slug is wrong, or <strong>Verify JWT</strong> is still on — the gateway then turns the call away ' +
      'before the function runs and the browser can only report it as a network error.' };
  });
}
function checkFns(){
  if (!CFG.url || !CFG.key) { note($('#fnNote'), 'bad', 'Save the URL and key first.'); return; }
  note($('#fnNote'), '', 'Checking…');
  Promise.all([fnProbe('telegram'), fnProbe('rewrite')]).then(function(r){
    var lines = [
      '<strong>Telegram on approve</strong> (<code>' + esc(fnSlug('telegram')) + '</code>) — ' + r[0].text,
      '<strong>AI rewrite</strong> (<code>' + esc(fnSlug('rewrite')) + '</code>) — ' + r[1].text
    ];
    note($('#fnNote'), r[0].ok && r[1].ok ? 'good' : 'bad', lines.join('<br>'));
  });
}

/* ---------- config ----------
   The built-in settings are the floor; anything saved in this browser sits on top
   of them, so one person can point their own copy somewhere else without changing
   the file everyone else opens. "Use built-in settings" clears the local override. */
function loadCfg(){
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem('madama.cfg') || '{}'); } catch(e){}
  CFG = {};
  Object.keys(DEFAULTS).forEach(function(k){ CFG[k] = String(saved[k] || DEFAULTS[k] || '').trim(); });
  $('#cfgUrl').value = CFG.url || '';
  $('#cfgKey').value = CFG.key || '';
  $('#cfgHook').value = CFG.hook || '';
  $('#cfgWho').value = CFG.who || '';
  $('#cfgFnTg').value = CFG.fn_telegram || '';
  $('#cfgFnRw').value = CFG.fn_rewrite || '';
}
function saveCfg(){
  CFG = { url: $('#cfgUrl').value.trim(), key: $('#cfgKey').value.trim(),
          hook: $('#cfgHook').value.trim(), who: $('#cfgWho').value.trim(),
          fn_telegram: $('#cfgFnTg').value.trim(), fn_rewrite: $('#cfgFnRw').value.trim() };
  try { localStorage.setItem('madama.cfg', JSON.stringify(CFG)); } catch(e){}
  if (/^sb_secret_/.test(CFG.key)) {
    note($('#cfgNote'), 'bad', 'That is the <strong>secret</strong> key. Use the publishable one — the secret key must never reach a browser.');
    return;
  }
  boot();
}

/* ---------- reference data ---------- */
function boot(){
  var missing = !CFG.url || !CFG.key;
  $('#needCfg').hidden = !missing;
  if (missing) { show('setup'); return; }
  Promise.all([
    api('brands?select=*&active=eq.true'),
    api('brand_content_options?select=*&active=eq.true&content_type=eq.service')
  ]).then(function(res){
    BRANDS = res[0]; OPTIONS = res[1];
    renderBrands(); renderPlatforms(); recalc();
    loadAll().catch(function(){});
    note($('#cfgNote'), 'good', 'Connected — ' + BRANDS.length + ' active companies, ' + OPTIONS.length + ' service options.');
  }).catch(function(e){
    note($('#cfgNote'), 'bad', 'Could not reach Supabase: ' + esc(e.message));
    $('#brandChips').innerHTML = '<span class="empty">Not connected.</span>';
  });
}

function renderBrands(){
  $('#brandChips').innerHTML = BRANDS.map(function(b){
    return '<label class="chip" data-on="0"><input type="checkbox" value="' + esc(b.brand_id) + '">' +
           esc(b.company_name || b.brand_id) + '</label>';
  }).join('') || '<span class="empty">No active companies.</span>';
  $$('#brandChips input').forEach(function(i){
    i.addEventListener('change', function(){
      i.closest('.chip').dataset.on = i.checked ? '1' : '0';
      renderServices(); recalc();
    });
  });
}
function chosenBrands(){
  return $$('#brandChips input:checked').map(function(i){ return i.value; });
}

/* union of services across the selected companies, not the intersection */
function availableServices(){
  var ids = chosenBrands(), seen = {};
  ids.forEach(function(id){
    OPTIONS.filter(function(o){ return (o.brand_id||'').toLowerCase() === id.toLowerCase(); })
      .forEach(function(o){
        var k = (o.option_value||'').toLowerCase(); if (!k) return;
        if (!seen[k]) seen[k] = { row:o, brands:{} };
        seen[k].brands[id] = 1;
      });
  });
  return Object.keys(seen).map(function(k){
    var e = seen[k];
    return { value:e.row.option_value, label:e.row.option_label || e.row.option_value,
             n:Object.keys(e.brands).length, total:ids.length };
  }).sort(function(a,b){ return (b.n - a.n) || a.label.localeCompare(b.label); });
}
function renderServices(){
  var sel = $('#service'), keep = sel.value;
  var list = availableServices();
  sel.innerHTML = '<option value="__random__">Random pick from each company\'s services</option>' +
    list.map(function(s){
      var extra = (s.total > 1 && s.n < s.total) ? ' (offered by ' + s.n + ' of ' + s.total + ')' : '';
      return '<option value="' + esc(s.value) + '">' + esc(s.label) + extra + '</option>';
    }).join('');
  sel.value = keep && sel.querySelector('option[value="' + CSS.escape(keep) + '"]') ? keep : '__random__';
}

function renderPlatforms(){
  $('#platGrid').innerHTML = PLATFORMS.map(function(p){
    return '<label><span class="lbl">' + PLATNAME[p] + '</span>' +
      '<select data-plat="' + p + '">' +
      ['Not used'].concat(MEDIA).map(function(m){
        return '<option>' + m + '</option>';
      }).join('') + '</select></label>';
  }).join('');
  $$('#platGrid select').forEach(function(sel){ sel.value = 'Not used'; sel.addEventListener('change', recalc); });
}
function mediaByPlatform(){
  var out = {};
  $$('#platGrid select').forEach(function(s){
    if (s.value !== 'Not used') out[s.dataset.plat] = s.value;
  });
  return out;
}

/* ---------- cost, mirroring the engine's actual call chain ---------- */
function perPost(media){
  var secs = +$('#vsecs').value, res = $('#vres').value;
  var vRate = RATE.vid720 * (res === '1080p' ? RATE.mul1080 : 1);
  var img = /image/i.test(media), vid = /video/i.test(media);
  var txt = function(t){ return t.i*RATE.textIn + t.o*RATE.textOut; };
  var c = txt(TOK.draft) + txt(TOK.polish);
  if (img) c += RATE.imgTok*RATE.imgOut + txt(TOK.imgqa) + RATE.creditUSD;
  if (vid) c += secs*vRate + RATE.vqa + secs*(14/60)*RATE.creditUSD;
  return c;
}
function recalc(){
  var brands = chosenBrands(), media = mediaByPlatform(), slots = +$('#plan').value;
  var anyVideo = Object.keys(media).some(function(p){ return /video/i.test(media[p]); });
  $('#videoOpts').hidden = !anyVideo;

  var posts = 0, cost = 0;
  brands.forEach(function(){
    Object.keys(media).forEach(function(p){
      for (var s = 0; s < slots; s++) { posts++; cost += perPost(media[p]); }
    });
  });
  $('#cost').textContent = '$' + cost.toFixed(2);
  $('#costMeta').textContent = posts
    ? posts + (posts === 1 ? ' post' : ' posts') + ' — ' + brands.length + ' × ' +
      Object.keys(media).length + ' platform' + (Object.keys(media).length === 1 ? '' : 's') + ' × ' + slots + ' slot' + (slots === 1 ? '' : 's')
    : 'pick a company and at least one platform';
  $('#confirm').disabled = !posts;

  /* Spell out every row that will be created. The platform pickers used to default to
     "Short Video", so an order could quietly carry two platforms the operator never
     chose - three posts instead of one. They now default to "Not used", and this list
     is the second guard: you see the exact rows before you pay for them. */
  var pv = $('#plan-preview');
  if (!posts) { pv.hidden = true; pv.innerHTML = ''; }
  else {
    var names = {};
    BRANDS.forEach(function(b){ names[b.brand_id] = b.company_name || b.brand_id; });
    var lines = [];
    brands.forEach(function(b){
      Object.keys(media).forEach(function(p){
        lines.push('<div><b>' + esc(names[b] || b) + '</b> · ' + PLATNAME[p] +
                   ' · ' + esc(media[p]) + (slots > 1 ? ' · ×' + slots + ' dates' : '') + '</div>');
      });
    });
    pv.hidden = false;
    pv.innerHTML = '<div style="color:var(--ink);font-weight:600;margin-bottom:4px">' +
      posts + ' post' + (posts === 1 ? '' : 's') + ' will be created:</div>' + lines.join('');
  }
  return { posts: posts, cost: cost, brands: brands, media: media, slots: slots };
}

/* ---------- build and send the order ---------- */
function isoSlot(dateStr, hour, addDays){
  var d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
  d.setDate(d.getDate() + addDays);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}
function servicesFor(brandId){
  return OPTIONS.filter(function(o){ return (o.brand_id||'').toLowerCase() === brandId.toLowerCase(); });
}
var ANGLES = [
  'direct service request and practical customer value',
  'residential or property-management operational value',
  'commercial, facility, or operational service value',
  'reliability, response, and coordination'
];
function buildRows(state){
  var chosen = $('#service').value, slots = state.slots, rows = [], seq = 0;
  var offsets = slots === 7 ? [0,1,2,3,4,5,6] : slots === 4 ? [0,2,4,6] : [0];
  var startDate = $('#startDate').value, hour = +$('#hour').value || 9;
  var vstyle = $('#vstyle').value, vsecs = +$('#vsecs').value;

  state.brands.forEach(function(bid, bi){
    var brand = BRANDS.filter(function(b){ return b.brand_id === bid; })[0] || {};
    var pool = servicesFor(bid);
    if (!pool.length) throw new Error('No active services for ' + (brand.company_name || bid));
    var plats = Object.keys(state.media);

    offsets.forEach(function(off, si){
      plats.forEach(function(p, pi){
        seq++;
        var media = state.media[p];
        var vid = /video/i.test(media), img = /image/i.test(media);
        var pick = chosen === '__random__' ? null
          : pool.filter(function(o){ return (o.option_value||'').toLowerCase() === chosen.toLowerCase(); })[0];
        if (!pick) pick = pool[(si*plats.length + pi + bi) % pool.length];
        var service = pick.option_value;
        var company = brand.company_name || bid;

        rows.push({
          id: bid + '-ui-' + Date.now().toString(36) + '-' + seq + '-' + Math.random().toString(36).slice(2,7),
          brand_id: bid,
          campaign: slots === 1 ? 'Instant Service Marketing' : 'Scheduled Service Marketing',
          content_pillar: service,
          topic_idea: [
            'Create one English ' + PLATNAME[p] + ' marketing post for ' + company + ' promoting ' + service + '.',
            'Use a distinct angle centered on ' + ANGLES[(si*plats.length + pi) % ANGLES.length] + '.',
            'Market the service directly and encourage a qualified service request.',
            'Do not turn Repair content into preventive maintenance, awareness education, warning-sign content, or DIY advice.',
            'This item must be different from other items in the same batch.',
            'Requested media package: ' + media + '.'
          ].join(' '),
          target_audience: brand.target_audience || '',
          tone_of_voice: brand.tone_of_voice || '',
          scheduled_at: isoSlot(startDate, hour, off),
          status: 'Needs Draft',
          link_url: brand.website_url || '',
          publish_facebook: p === 'facebook' ? !!brand.publish_facebook : false,
          publish_instagram: p === 'instagram' ? !!brand.publish_instagram : false,
          publish_linkedin: p === 'linkedin' ? !!brand.publish_linkedin : false,
          facebook_status: p === 'facebook' ? 'Pending' : 'Not Requested',
          instagram_status: p === 'instagram' ? 'Pending' : 'Not Requested',
          linkedin_status: p === 'linkedin' ? 'Pending' : 'Not Requested',
          image_status: img ? 'Pending' : 'Not Requested',
          media_type: media,
          video_status: vid ? 'Pending' : 'Not Requested',
          video_provider: vid ? 'Google Gemini' : '',
          video_style: vid ? vstyle : '',
          video_duration_seconds: vid ? vsecs : 8,
          video_aspect_ratio: p === 'linkedin' ? '16:9' : '9:16',
          audit_status: 'Not Submitted',
          audit_version: 1,
          target_platform: p,
          updated_at: new Date().toISOString()
        });
      });
    });
  });
  return rows;
}

$('#confirm').addEventListener('click', function(){
  var state = recalc();
  if (!state.posts) return;
  if (!confirm('Create ' + state.posts + ' post' + (state.posts === 1 ? '' : 's') +
               ' and start the engine?\n\nEstimated API cost: $' + state.cost.toFixed(2))) return;
  var btn = this; btn.disabled = true;
  var rows;
  try { rows = buildRows(state); }
  catch(e){ note($('#orderNote'),'bad', esc(e.message)); btn.disabled = false; return; }

  api('content_queue', { method:'POST', body:rows, prefer:'return=representation' })
    .then(function(saved){
      note($('#orderNote'),'good', saved.length + ' rows created. Waking the engine…');
      if (!CFG.hook) {
        note($('#orderNote'),'good', saved.length + ' rows created. No webhook URL set, so run the engine from n8n yourself.');
        return;
      }
      return fetch(CFG.hook, {
        method:'POST', headers:{'Content-Type':'text/plain'},   /* simple request: no CORS preflight */
        body: JSON.stringify({ source:'console', count: saved.length, ids: saved.map(function(r){ return r.id; }) })
      }).then(function(){
        note($('#orderNote'),'good', saved.length + ' rows created and the engine has been started. Watch progress under <strong>Queue</strong>.');
      }).catch(function(){
        note($('#orderNote'),'bad', saved.length + ' rows were created, but the engine webhook did not answer. Run it from n8n — nothing is lost.');
      });
    })
    .catch(function(e){ note($('#orderNote'),'bad','Could not create the order: ' + esc(e.message)); })
    .then(function(){
      btn.disabled = false;
      /* wipe the selection: pressing Confirm twice used to create the order twice */
      $$('#brandChips input').forEach(function(i){ i.checked = false; i.closest('.chip').dataset.on = '0'; });
      $$('#platGrid select').forEach(function(sel){ sel.value = 'Not used'; });
      renderServices(); recalc();
      loadQueue();
    });
});

$('#reset').addEventListener('click', function(){
  $$('#brandChips input').forEach(function(i){ i.checked = false; i.closest('.chip').dataset.on = '0'; });
  renderServices(); note($('#orderNote'),'',''); recalc();
});

/* ---------- review ---------- */
function mediaBlock(r){
  var out = '';
  if (r.image_url) out += '<a href="' + esc(r.image_url) + '" target="_blank" rel="noopener"><img src="' + esc(r.image_url) + '" alt="Generated image"></a>';
  if (r.video_url) out += '<video src="' + esc(r.video_url) + '" controls preload="metadata"></video>';
  return out ? '<div class="media">' + out + '</div>' : '';
}
function copyFor(r){
  var t = (r.target_platform||'').toLowerCase();
  return t === 'facebook' ? r.generated_facebook : t === 'instagram' ? r.generated_instagram : r.generated_linkedin;
}
var REVIEW = [];
function loadReview(){
  var box = $('#reviewList'); box.innerHTML = '<div class="empty">Loading…</div>';
  loadAll().then(function(){
      var rows = REVIEW = stage('review');
      if (!rows.length) { box.innerHTML = '<div class="panel"><div class="empty">Nothing waiting. A post appears here the moment the engine finishes producing it.</div></div>'; return; }
      box.innerHTML = rows.map(function(r){
        var ready = true;
        var company = (BRANDS.filter(function(b){ return b.brand_id === r.brand_id; })[0] || {}).company_name || r.brand_id;
        return '<div class="card" data-id="' + esc(r.id) + '">' +
          '<header><div><div class="who">' + esc(company) + ' — ' + esc(r.content_pillar) + ' — ' + esc(PLATNAME[r.target_platform] || r.target_platform) + '</div>' +
          '<div class="idline">' + esc(r.id) + '</div></div>' +
          '<div><span class="tag t-mute">' + esc(r.media_type) + '</span></div></header>' +
          mediaBlock(r) +
          '<textarea class="copy" data-copy>' + esc(copyFor(r) || '') + '</textarea>' +
          '<div class="row" style="margin:10px 0">' +
            '<input data-prompt placeholder="Tell the AI what to change — e.g. make it shorter and lead with the problem" style="flex:1;min-width:240px">' +
            '<button class="btn ghost" data-act="rewrite">Rewrite with AI</button>' +
          '</div>' +
          '<div data-diff></div>' +
          '<div class="row">' +
          '<button class="btn ghost" data-act="save">Save edits</button>' +
          '<button class="btn ok" data-act="approve">Approve &amp; send to Telegram</button>' +
          '<button class="btn no" data-act="delete">Delete</button>' +
          '</div></div>';
      }).join('');
      $$('#reviewList [data-act]').forEach(function(b){
        b.addEventListener('click', function(){
          var card = b.closest('.card'), id = card.dataset.id;
          if (b.dataset.act === 'save')    return saveCopy(card, id);
          if (b.dataset.act === 'rewrite') return rewrite(card, id, b);
          if (b.dataset.act === 'approve') return saveCopy(card, id, function(){ decide(id, 'approve'); });
          if (b.dataset.act === 'delete')  return dropRows([id], loadReview);
          decide(id, b.dataset.act);
        });
      });
    })
    .catch(function(e){ box.innerHTML = '<div class="panel"><div class="note bad">' + esc(e.message) + '</div></div>'; });
}

function decide(id, act){
  var patch = { status:'Approved', approved_by: CFG.who || 'console',
                approved_at: new Date().toISOString(), last_error:'',
                updated_at: new Date().toISOString() };
  api('content_queue?id=eq.' + encodeURIComponent(id), { method:'PATCH', body:patch, prefer:'return=representation' })
    .then(function(res){
      if (!res || !res.length){
        toast('The database refused the change. Run madama_system2_frontend_grants.sql once.');
        return;
      }
      /* Telegram fires on APPROVAL, not on production - you see it only after you
         have signed it off. The bot token lives in an Edge Function, never here. */
      return callFn('telegram', { id: id })
      .then(function(){ toast('Approved and sent to Telegram'); })
      .catch(function(e){ toast('Approved, but Telegram failed: ' + e.message); })
      .then(function(){ loadReview(); });
    })
    .catch(function(e){ toast('Failed: ' + e.message); });
}


/* ---------- the pipeline ----------
   A post lives in exactly one stage at a time. Nothing is ever deleted to make it
   "disappear" from a list - the row carries the cost, the media and the record of
   what was posted, so it moves between stages instead. The filters below are the
   single source of truth for which list a row shows up in. */
function produced(r){
  var mt = r.media_type || 'Image';
  var copy = copyFor(r);
  return !!String(copy || '').trim()
      && (!/image/i.test(mt) || !!r.image_url)
      && (!/video/i.test(mt) || (r.video_status === 'Ready' && !!r.video_url));
}
function stageOf(r){
  var st = String(r.status || '').toLowerCase();
  if (st === 'published')  return 'done';
  if (st === 'cancelled')  return 'done';
  if (st === 'approved' || st === 'publishing' || st === 'partially published') return 'publish';
  if (st === 'needs review') return 'queue';          // stuck: it needs a person, in production
  return produced(r) ? 'review' : 'queue';
}
var ALL = [];
function loadAll(){
  return api('content_queue?select=*&order=row_created_at.desc&limit=200')
    .then(function(rows){
      ALL = rows;
      var n = { queue:0, review:0, publish:0, done:0 };
      rows.forEach(function(r){ n[stageOf(r)]++; });
      $('#c-queue').textContent   = n.queue   || '';
      $('#c-review').textContent  = n.review  || '';
      $('#c-publish').textContent = n.publish || '';
      ['queue','review','publish','done'].forEach(function(k){
        var el = $('#p-' + k); if (!el) return;
        el.textContent = n[k];
        el.closest('.tile').dataset.empty = n[k] ? '0' : '1';
      });
      refreshClearButtons();
      return rows;
    });
}
function stage(name){ return ALL.filter(function(r){ return stageOf(r) === name; }); }

/* ---------- editing the copy ---------- */
function fieldFor(platform){
  var t = (platform || '').toLowerCase();
  return t === 'facebook' ? 'generated_facebook' : t === 'instagram' ? 'generated_instagram' : 'generated_linkedin';
}
function saveCopy(card, id, then){
  var row = (REVIEW.filter(function(r){ return r.id === id; })[0]) || {};
  var text = card.querySelector('[data-copy]').value;
  if (text === (copyFor(row) || '')) { if (then) then(); else toast('Nothing changed'); return; }
  var patch = {};
  patch[fieldFor(row.target_platform)] = text;
  patch.updated_at = new Date().toISOString();
  api('content_queue?id=eq.' + encodeURIComponent(id), { method:'PATCH', body:patch, prefer:'return=representation' })
    .then(function(res){
      if (!res || !res.length){ toast('The database refused the edit. Run the grants SQL once.'); return; }
      row[fieldFor(row.target_platform)] = text;
      toast('Saved');
      if (then) then();
    })
    .catch(function(e){ toast('Save failed: ' + e.message); });
}

/* The OpenAI key is NOT in this page. The browser sends the row id and your
   instruction to a Supabase Edge Function, which holds the key server side and
   returns a suggestion. Nothing is written until you press Save edits. */
function rewrite(card, id, btn){
  var instruction = card.querySelector('[data-prompt]').value.trim();
  if (!instruction) { toast('Say what to change first'); return; }
  if (!CFG.url) { toast('Set the connection first'); return; }
  btn.disabled = true; btn.textContent = 'Rewriting…';
  callFn('rewrite', { id: id, instruction: instruction })
  .then(function(d){
    card.querySelector('[data-copy]').value = d.rewritten;
    card.querySelector('[data-diff]').innerHTML =
      '<div class="note">Rewritten. Read it, adjust anything by hand, then press <strong>Save edits</strong> — nothing is stored until you do.</div>';
  })
  .catch(function(e){
    card.querySelector('[data-diff]').innerHTML =
      '<div class="note bad">Rewrite failed: ' + esc(e.message) +
      '<br>Connection → <strong>Check Edge Functions</strong> tells you which of the two is wrong: the slug, the JWT setting, or a missing secret.</div>';
  })
  .then(function(){ btn.disabled = false; btn.textContent = 'Rewrite with AI'; });
}

/* ---------- publish ---------- */
var PUBLISH = [];
function accountFor(brand, platform){
  var key = platform === 'facebook' ? 'facebook_page_id'
          : platform === 'instagram' ? 'instagram_user_id' : 'linkedin_organization_id';
  return String((brand || {})[key] || '').trim();
}
function loadPublish(){
  var box = $('#publishList'); box.innerHTML = '<div class="empty">Loading…</div>';
  loadAll().then(function(){
      var rows = PUBLISH = stage('publish');
      if (!rows.length){ box.innerHTML = '<div class="panel"><div class="empty">Nothing approved yet. Approve a post under Review &amp; edit and it lands here.</div></div>'; return; }
      box.innerHTML = rows.map(function(r){
        var brand = BRANDS.filter(function(b){ return b.brand_id === r.brand_id; })[0] || {};
        var p = (r.target_platform || '').toLowerCase();
        var acct = accountFor(brand, p);
        var enabled = !!brand['publish_' + p];
        var blocked = !acct || !enabled;
        return '<div class="card" data-id="' + esc(r.id) + '">' +
          '<header><div><div class="who">' + esc(brand.company_name || r.brand_id) + ' — ' + esc(PLATNAME[p] || p) + '</div>' +
          '<div class="idline">' + esc(r.id) + '</div></div>' +
          '<div><span class="tag ' + (blocked ? 't-bad' : 't-ok') + '">' + esc(r.status) + '</span></div></header>' +
          mediaBlock(r) +
          '<pre>' + esc(copyFor(r) || '') + '</pre>' +
          '<div class="note' + (blocked ? ' bad' : '') + '">' +
            '<strong>Goes to:</strong> ' + esc(brand.company_name || r.brand_id) + '\u2019s ' + esc(PLATNAME[p] || p) + ' account' +
            (acct ? ' \u2014 <span class="num">' + esc(acct) + '</span>' : ' \u2014 <strong>no account id on this company</strong>') +
            (enabled ? '' : '<br>Publishing to ' + esc(PLATNAME[p] || p) + ' is switched off for this company.') +
          '</div>' +
          '<div class="row" style="margin-top:12px">' +
            '<button class="btn ok" data-pub' + (blocked ? ' disabled title="Add the account id and switch the platform on for this company first"' : '') + '>' +
              (blocked ? 'Cannot publish yet' : 'Publish now') + '</button>' +
            '<button class="btn no" data-drop title="Delete this post instead of publishing it">Delete</button>' +
            '<span class="idline">approved ' + esc(String(r.approved_at || '').slice(0,16).replace('T',' ')) + '</span>' +
          '</div></div>';
      }).join('');
      $$('#publishList [data-pub]').forEach(function(b){
        b.addEventListener('click', function(){ publishNow(b.closest('.card').dataset.id); });
      });
      /* Approved does not mean committed. A post can be killed here, after it is
         finished and before anything reaches a company account. */
      $$('#publishList [data-drop]').forEach(function(b){
        b.addEventListener('click', function(){ dropRows([b.closest('.card').dataset.id], loadPublish); });
      });
    })
    .catch(function(e){ box.innerHTML = '<div class="panel"><div class="note bad">' + esc(e.message) + '</div></div>'; });
}
/* "Publish now" brings the scheduled time forward and wakes the engine - the engine
   owns the actual posting, because that is where the platform credentials live. */
function publishNow(id){
  if (!confirm('Publish this post now, to the live company account?')) return;
  api('content_queue?id=eq.' + encodeURIComponent(id),
      { method:'PATCH', prefer:'return=representation',
        body:{ scheduled_at: new Date().toISOString(), updated_at: new Date().toISOString() } })
    .then(function(res){
      if (!res || !res.length){ toast('The database refused it. Run the grants SQL once.'); return; }
      toast('Queued for publishing');
      if (CFG.hook) fetch(CFG.hook, { method:'POST', headers:{'Content-Type':'text/plain'},   /* simple request: no CORS preflight */
                                      body: JSON.stringify({ source:'console', action:'publish' }) }).catch(function(){});
      setTimeout(loadPublish, 4000);
    })
    .catch(function(e){ toast('Failed: ' + e.message); });
}

/* ---------- published ----------
   This tab had a Refresh button, a Clear button and a table, and no code behind any
   of it: `loadDone` was wired up in three places and never written, so opening
   Published threw and the table sat on "Loading…" forever. */
function loadDone(){
  var box = $('#doneTable'); box.innerHTML = '<div class="empty">Loading…</div>';
  loadAll().then(function(){
      var rows = stage('done');
      if (!rows.length){ box.innerHTML = '<div class="empty">Nothing has gone out yet.</div>'; return; }
      box.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:13.5px">' +
        '<thead><tr>' + ['Company','Service','Platform','Media','Status','When',''].map(function(h){
          return '<th style="text-align:left;font:600 11px var(--ui);letter-spacing:.09em;text-transform:uppercase;color:var(--ink-3);padding:0 12px 8px 0;border-bottom:1px solid var(--line)">' + h + '</th>';
        }).join('') + '</tr></thead><tbody>' +
        rows.map(function(r){
          var cancelled = String(r.status).toLowerCase() === 'cancelled';
          var company = (BRANDS.filter(function(b){ return b.brand_id === r.brand_id; })[0] || {}).company_name || r.brand_id;
          var when = String(r.published_at || r.updated_at || '').slice(0,16).replace('T',' ');
          return '<tr>' +
            [company, r.content_pillar, PLATNAME[r.target_platform] || r.target_platform, r.media_type].map(function(v){
              return '<td style="' + TD + '">' + esc(v) + '</td>';
            }).join('') +
            '<td style="' + TD + '"><span class="tag ' + (cancelled ? 't-mute' : 't-ok') + '">' + esc(r.status) + '</span></td>' +
            '<td style="' + TD + '"><span class="idline">' + esc(when) + '</span></td>' +
            '<td style="' + TD + ';text-align:right">' +
              '<button class="btn no" style="padding:4px 12px;font-size:12.5px" data-del="' + esc(r.id) + '">Delete</button>' +
            '</td></tr>';
        }).join('') + '</tbody></table>';
      $$('#doneTable [data-del]').forEach(function(b){
        b.addEventListener('click', function(){ dropRows([b.dataset.del], loadDone); });
      });
    })
    .catch(function(e){ box.innerHTML = '<div class="note bad">' + esc(e.message) + '</div>'; });
}

/* ---------- queue ---------- */
var QUEUE = [];
var TD = 'padding:8px 12px 8px 0;border-bottom:1px solid var(--line-soft)';

/* Anything may be deleted except a row the engine is generating this minute -
   the same single rule the Clear buttons use. */
function deletable(r){ return !generatingNow(r); }
/* A draft that has not cost anything yet: the "delete all unstarted" shortcut. */
function unstarted(r){
  return r.status === 'Needs Draft' && !r.image_url && !r.video_url;
}

/* What the engine will do to this row on its next run. This mirrors the order of
   the branches in 'Validate and Classify Queue Rows' - one run advances a row by
   exactly one stage, which is why a video post needs three runs, not one. */
/* After a failed generation the engine sets next_retry_at and will not touch the
   row again until that time passes. The console used to ignore that field, so it
   counted a cooling-off row as work the engine was about to do — then reported
   "the engine did not pick this up" when the engine correctly left it alone.
   A row in backoff is waiting, not pending. */
function coolingOff(r){
  var t = Date.parse(r.next_retry_at || '');
  return t && t > Date.now() ? t : 0;
}
function retryLabel(r){
  var t = coolingOff(r);
  if (!t) return '';
  var mins = Math.max(1, Math.round((t - Date.now()) / 60000));
  return 'Retrying in ' + mins + ' min';
}

function nextStep(r){
  var st = (r.status || '').toLowerCase();
  var mt = r.media_type || 'Image';
  var needImg = /image/i.test(mt), needVid = /video/i.test(mt);
  if (coolingOff(r) && (r.image_status === 'Failed' || r.video_status === 'Failed')){
    return { key:'retry', label: retryLabel(r) };
  }
  if (st === 'needs draft' || st === 'draft requested') return { key:'draft',  label:'Write the copy' };
  if (st === 'awaiting approval'){
    if (needImg && !r.image_url) return { key:'image', label:'Generate the image' };
    if (needVid && (r.video_status !== 'Ready' || !r.video_url)) return { key:'video', label:'Generate the video' };
    if (!r.audit_id) return { key:'audit', label:'Submit for audit' };
    return { key:'wait', label:'Waiting for your approval' };
  }
  if (st === 'under audit')   return { key:'human', label:'Waiting for audit sign-off' };
  if (st === 'needs review')  return { key:'human', label:'Needs a human — see the error' };
  if (st === 'approved')      return { key:'publish', label:'Publish' };
  if (st === 'published')     return { key:'done', label:'Done' };
  if (st === 'cancelled')     return { key:'done', label:'Cancelled' };
  return { key:'wait', label:'—' };
}

/* per-stage cost, same rates as the order screen */
function stepCost(r, step){
  if (step === 'draft') return 2200*RATE.textIn + 900*RATE.textOut + 1800*RATE.textIn + 900*RATE.textOut;
  if (step === 'image') return RATE.imgTok*RATE.imgOut + (1600*RATE.textIn + 250*RATE.textOut) + RATE.creditUSD;
  if (step === 'video'){
    var secs = Number(r.video_duration_seconds) || 8;
    return secs*RATE.vid720 + RATE.vqa + secs*(14/60)*RATE.creditUSD;
  }
  return 0;
}

var STEPNAME = { draft:'copy', image:'images', video:'videos', audit:'audits', publish:'publishes' };

function renderSummary(rows){
  if (WATCH) return;   // the watcher owns this panel while it runs
  var count = {}, cost = 0;
  rows.forEach(function(r){
    var n = nextStep(r);
    if (['draft','image','video','audit','publish'].indexOf(n.key) < 0) return;
    count[n.key] = (count[n.key] || 0) + 1;
    cost += stepCost(r, n.key);
  });
  var parts = ['draft','image','video','audit','publish'].filter(function(k){ return count[k]; })
    .map(function(k){ return count[k] + ' ' + STEPNAME[k]; });
  var total = parts.length;
  var el = $('#runSummary');
  if (!total){
    el.innerHTML = '<div class="note good">Nothing for the engine to do. Every row is either finished or waiting on a person.</div>';
    $('#runEngine').disabled = true;
    return;
  }
  el.innerHTML = '<div class="note"><strong>Next run will produce:</strong> ' + parts.join(', ') +
    ' — about <span class="num">$' + cost.toFixed(2) + '</span>.<br>' +
    'One run advances every row by a single stage, so a post with a video needs three runs in all: copy, then image, then video.</div>';
  $('#runEngine').disabled = false;
}

function loadQueue(){
  var box = $('#queueTable'); box.innerHTML = '<div class="empty">Loading…</div>';
  loadAll().then(function(){
      var rows = QUEUE = stage('queue');
      renderSummary(rows);
      var drafts = rows.filter(unstarted).length;
      $('#dropDrafts').hidden = !drafts;
      $('#dropDrafts').textContent = 'Delete all ' + drafts + ' unstarted draft' + (drafts === 1 ? '' : 's');
      if (!rows.length) { box.innerHTML = '<div class="empty">Nothing in production. Finished posts are under Review &amp; edit.</div>'; return; }

      box.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:13.5px">' +
        '<thead><tr>' + ['Company','Service','Platform','Media','Status','Next step',''].map(function(h){
          return '<th style="text-align:left;font:600 11px var(--ui);letter-spacing:.09em;text-transform:uppercase;color:var(--ink-3);padding:0 12px 8px 0;border-bottom:1px solid var(--line)">' + h + '</th>';
        }).join('') + '</tr></thead><tbody>' +
        rows.map(function(r){
          var st = (r.status || '').toLowerCase();
          var cls = st === 'needs review' ? 't-bad' : 't-wait';
          var n = nextStep(r);
          var ncls = ['draft','image','video','audit','publish'].indexOf(n.key) >= 0 ? 't-wait'
                   : n.key === 'human' ? 't-bad'
                   : n.key === 'retry' ? 't-bad' : 't-mute';
          var price = stepCost(r, n.key);
          var company = (BRANDS.filter(function(b){ return b.brand_id === r.brand_id; })[0] || {}).company_name || r.brand_id;
          return '<tr title="' + esc(r.last_error || '') + '">' +
            [company, r.content_pillar, PLATNAME[r.target_platform] || r.target_platform, r.media_type].map(function(v){
              return '<td style="' + TD + '">' + esc(v) + '</td>';
            }).join('') +
            '<td style="' + TD + '"><span class="tag ' + cls + '">' + esc(r.status) + '</span></td>' +
            '<td style="' + TD + '"><span class="tag ' + ncls + '">' + esc(n.label) + '</span>' +
              (price ? ' <span class="idline">$' + price.toFixed(2) + '</span>' : '') + '</td>' +
            '<td style="' + TD + ';text-align:right">' +
              (deletable(r)
                ? '<button class="btn no" style="padding:4px 12px;font-size:12.5px" data-del="' + esc(r.id) + '">Delete</button>'
                : '<span class="idline" title="Being produced right now — deleting it mid-generation wastes what it cost">—</span>') +
            '</td></tr>';
        }).join('') + '</tbody></table>';

      $$('#queueTable [data-del]').forEach(function(b){
        b.addEventListener('click', function(){ dropRows([b.dataset.del]); });
      });
    })
    .catch(function(e){ box.innerHTML = '<div class="note bad">' + esc(e.message) + '</div>'; });
}

/* A press used to vanish without a trace: no pressed state, no progress, no way to
   know whether to press again. The button now holds a busy state for as long as the
   engine is actually working, releases itself when the stage lands, and then says
   plainly whether another press is needed. The watching happens here in the page,
   where you can see it and close the tab to stop it - not in a server-side loop. */
var WATCH = null;

function workSignature(rows){
  return rows.map(function(r){
    return [r.id, r.status, r.image_status, r.video_status,
            r.image_url ? 1 : 0, r.video_url ? 1 : 0].join('|');
  }).sort().join('~');
}
/* "In production" has to mean the engine has its hands on this row RIGHT NOW -
   not that the row happens to be sitting in the Queue. Two things depend on
   getting that distinction right: the Run watcher, and every Clear button.

   A row whose generation was rejected - a 429, a suspended Gemini balance, a
   crashed run - keeps saying "Generating" forever, and would lock Clear for good.
   So a lock nobody has touched in STALE_MIN minutes counts as dead, not busy.
   row_updated_at is written by a database trigger on every write, whoever writes,
   so it is the one timestamp that cannot be stale while work is really happening. */
var STALE_MIN = 15;
function generatingNow(r){
  if (r.image_status !== 'Generating' && r.video_status !== 'Generating') return false;
  var t = Date.parse(r.row_updated_at || r.updated_at || '');
  if (!t) return true;                                  // no timestamp - assume live
  return (Date.now() - t) < STALE_MIN * 60000;
}
function inFlight(rows){ return rows.filter(generatingNow).length; }

/* Why a Clear is refused, in words, or '' when nothing stands in the way. */
function busyReason(){
  if (WATCH) return 'the engine is running — press “Run engine now” once to stop watching first';
  var n = inFlight(ALL);
  if (n) return n + ' post' + (n === 1 ? ' is' : 's are') + ' being produced right now';
  return '';
}
function pendingWork(rows){
  return rows.filter(function(r){
    return ['draft','image','video','audit','publish'].indexOf(nextStep(r).key) >= 0;
  });
}

function stopWatch(){
  if (WATCH) { clearTimeout(WATCH.timer); WATCH = null; }
  var b = $('#runEngine');
  b.classList.remove('busy');
  b.disabled = false;
  b.textContent = 'Run engine now';
}

function runEngine(){
  if (WATCH) { stopWatch(); toast('Stopped watching. The engine keeps going on its own.'); return; }
  if (!CFG.hook){
    toast('No webhook URL set — add it under Connection, or press Execute in n8n.');
    return;
  }
  if (/\/webhook-test\//.test(CFG.hook)){
    toast('That is the TEST webhook URL. It only fires while n8n is open on “Listen for test event”. ' +
          'For everyday use take the Production URL — the same address with /webhook/ instead of /webhook-test/.');
  }
  var before = workSignature(ALL);
  var b = $('#runEngine');
  b.classList.add('busy');
  b.textContent = 'Working… press to stop watching';
  $('#runSummary').innerHTML = '<div class="working">Engine started. Watching the queue — this button releases itself when the stage lands.</div>';

  WATCH = { before: before, started: Date.now(), polls: 0, sawFlight: false, timer: null, trigger: 'sent' };

  /* Content-Type is text/plain ON PURPOSE, and it is the whole reason this used to
     do nothing at all.

     application/json is not a CORS-safe content type, so the browser insists on
     sending an OPTIONS preflight first. The Webhook node has no Allowed Origins set,
     so it never answers that preflight - and the browser then throws the POST away
     without ever sending it. The engine was never called. Meanwhile this panel sat
     there counting minutes, waiting for a run that had not started.

     text/plain makes it a simple request: no preflight, the POST goes straight to
     n8n. The engine reads nothing out of the body, so the format costs us nothing. */
  fetch(CFG.hook, { method:'POST', headers:{'Content-Type':'text/plain'},
                    body: JSON.stringify({ source:'console', action:'run' }) })
    .then(function(r){
      /* fetch does NOT reject on 404. An unregistered webhook - the usual symptom of
         a workflow that is not Active - used to land here and be thrown away silently. */
      if (r.ok) { WATCH && (WATCH.trigger = 'ok'); return; }
      return r.text().then(function(t){
        var d = null; try { d = JSON.parse(t); } catch(e){}
        var msg = (d && (d.message || d.error)) || t || ('HTTP ' + r.status);
        var hint = (d && d.hint) || '';
        stopWatch();
        $('#runSummary').innerHTML = '<div class="note bad"><strong>n8n refused the call — the engine never started.</strong><br>' +
          esc(msg) + (hint ? '<br><span class="idline">' + esc(hint) + '</span>' : '') +
          (r.status === 404 ? '<br>Almost always this means the workflow is not <strong>Active</strong> in n8n, ' +
                              'or the URL is the test one. A production webhook only answers while the workflow is Active.' : '') +
          '</div>';
      });
    })
    .catch(function(){
      /* The request went out but the browser could not read the reply: n8n sends no
         CORS header back. That is not a failure - the engine may well be running.
         The database is the honest witness, so keep watching and say so. */
      if (WATCH) WATCH.trigger = 'unreadable';
    });

  poll();
}

function poll(){
  if (!WATCH) return;
  var MAX_MS = 12 * 60 * 1000;   // a video can render for ten minutes; give it twelve
  WATCH.polls++;
  loadAll().then(function(rows){
    if (!WATCH) return;
    var flying = inFlight(rows);
    if (flying) WATCH.sawFlight = true;
    var changed = workSignature(rows) !== WATCH.before;
    var mins = Math.round((Date.now() - WATCH.started) / 60000);
    var secs = Math.round((Date.now() - WATCH.started) / 1000);

    var landed = changed && !flying && WATCH.polls > 1;
    var timedOut = Date.now() - WATCH.started > MAX_MS;

    /* Two minutes in with nothing touched, nothing generating and nothing ever
       generating: the engine is not working on this queue, and counting to twelve
       minutes only wastes the operator's time. Say what is actually wrong. */
    var DEAD_MS = 120000;
    if (!changed && !flying && !WATCH.sawFlight && Date.now() - WATCH.started > DEAD_MS){
      var test = /\/webhook-test\//.test(CFG.hook || '');
      var unreadable = WATCH.trigger === 'unreadable';
      stopWatch();

      /* Nothing changed can mean two completely different things, and saying the
         wrong one sends you to n8n to fix a workflow that is working. Check the
         queue first: if no row was actually due, the engine ran and correctly
         did nothing. */
      var due = pendingWork(rows);
      if (!due.length){
        var cooling = rows.filter(coolingOff)
                          .sort(function(a,b){ return coolingOff(a) - coolingOff(b); });
        var human = rows.filter(function(r){ return nextStep(r).key === 'human'; });
        $('#runSummary').innerHTML = '<div class="note good">' +
          '<strong>The engine ran and found nothing due.</strong> That is not a fault — no row was ready for it.' +
          (cooling.length
            ? '<br><span class="num">' + cooling.length + '</span> row' + (cooling.length === 1 ? ' is' : 's are') +
              ' cooling off after a failed attempt. The engine will not retry before ' +
              new Date(coolingOff(cooling[0])).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) + '.'
            : '') +
          (human.length
            ? '<br><span class="num">' + human.length + '</span> row' + (human.length === 1 ? '' : 's') +
              ' need a person, not the engine — see the Queue for the reason on each.'
            : '') +
          '</div>';
        return;
      }

      $('#runSummary').innerHTML = '<div class="note bad">' +
        '<strong>Nothing has changed in the database for two minutes, and ' +
        '<span class="num">' + due.length + '</span> row' + (due.length === 1 ? ' was' : 's were') +
        ' due — so the engine did not pick this up.</strong>' +
        '<br>Three things cause this, in order of how often:' +
        '<br>1. The workflow is not <strong>Active</strong> in n8n. A production webhook only answers while it is.' +
        '<br>2. The URL under Connection is the <strong>test</strong> one — <code>/webhook-test/</code> fires only while you are ' +
             'sitting in n8n with “Listen for test event” open.' + (test ? ' <strong>Yours is the test URL.</strong>' : '') +
        '<br>3. The path does not match the Webhook node — it should end in <code>madama-engine-run</code>.' +
        (unreadable ? '<br><span class="idline">The browser could not read n8n’s reply (no CORS header on the Webhook node), ' +
                      'so this was judged purely on the database. Setting Allowed Origins to * on that node would let the ' +
                      'console report n8n’s own error instead of guessing.</span>' : '') +
        '</div>';
      return;
    }

    if (!landed && !timedOut){
      $('#runSummary').innerHTML = '<div class="working">' +
        (flying ? '<span class="num">' + flying + '</span> post' + (flying === 1 ? '' : 's') + ' being produced right now.'
                : changed ? 'Stage finishing…'
                : 'Waiting for the engine to pick the queue up… nothing has changed yet.') +
        ' <span style="color:var(--ink-3)">' + (secs < 90 ? secs + 's' : mins + ' min') + ' elapsed</span></div>';
      WATCH.timer = setTimeout(poll, 10000);
      return;
    }

    // released
    var b = $('#runEngine');
    b.classList.remove('busy'); b.disabled = false; b.textContent = 'Run engine now';
    WATCH = null;

    var left = pendingWork(rows);
    var moved = stage('review').length;
    if (timedOut){
      $('#runSummary').innerHTML = '<div class="working" style="border-left-color:var(--crit)">' +
        'Gave up watching after 12 minutes. The engine may still be running — press Refresh in a minute.</div>';
      return;
    }
    if (!left.length){
      $('#runSummary').innerHTML = '<div class="note good"><strong>Done.</strong> Nothing left for the engine.' +
        (moved ? ' <strong>' + moved + '</strong> post' + (moved === 1 ? ' is' : 's are') + ' waiting under Review &amp; edit.' : '') +
        '</div>';
      return;
    }
    var cost = left.reduce(function(sum, r){ return sum + stepCost(r, nextStep(r).key); }, 0);
    $('#runSummary').innerHTML = '<div class="note"><strong>Stage done — press Run again.</strong> ' +
      left.length + ' post' + (left.length === 1 ? '' : 's') + ' still need work' +
      (cost ? ', about <span class="num">$' + cost.toFixed(2) + '</span> for the next stage' : '') + '.' +
      (moved ? '<br><strong>' + moved + '</strong> finished post' + (moved === 1 ? '' : 's') + ' moved to Review &amp; edit.' : '') +
      '</div>';
  })
  .catch(function(){
    if (!WATCH) return;
    WATCH.timer = setTimeout(poll, 10000);
  });
}

/* Delete is a DELETE straight at the table over Supabase's REST API, so what comes
   back is the list of rows that were actually removed. Row level security refuses
   silently - 200 with an empty list - so the count is the only way to tell a real
   deletion from a polite refusal, and it gets reported either way. */
function dropRows(ids, after){
  if (!ids.length) return;
  if (!confirm('Delete ' + ids.length + ' post' + (ids.length === 1 ? '' : 's') + ' permanently?\n\n' +
               'The copy, the image and the video go with it, and this cannot be undone.\n' +
               'What was actually posted to a company account stays on record in publication_log — ' +
               'that table is not touched.')) return;
  /* Sent in batches: a Clear over a full list would otherwise put every id into one
     URL, and a few hundred of them is long enough for the request to be refused
     with an error that says nothing about what actually went wrong. */
  var batches = [], SIZE = 40;
  for (var i = 0; i < ids.length; i += SIZE) batches.push(ids.slice(i, i + SIZE));

  batches.reduce(function(chain, batch){
    return chain.then(function(count){
      var q = batch.map(function(id){ return '"' + encodeURIComponent(id) + '"'; }).join(',');
      return api('content_queue?id=in.(' + q + ')', { method:'DELETE', prefer:'return=representation' })
        .then(function(gone){ return count + ((gone && gone.length) || 0); });
    });
  }, Promise.resolve(0))
    .then(function(n){
      if (!n) toast('The database refused it — nothing was deleted. Run the latest madama_system2_frontend_grants.sql once, then try again.');
      else if (n < ids.length) toast(n + ' of ' + ids.length + ' deleted. The database refused the other ' +
                                     (ids.length - n) + ' — run the latest grants SQL.');
      else toast(n + ' post' + (n === 1 ? '' : 's') + ' deleted');
      (after || loadQueue)();
    })
    .catch(function(e){ toast('Delete failed: ' + e.message); });
}

/* Clear empties one whole list, on every tab.

   It used to be locked whenever ANYTHING sat in the Queue - which is almost always,
   since the Queue is where unfinished posts live. That made Clear impossible to use
   on the Queue tab at all and unreliable everywhere else. The only thing worth
   blocking is a delete landing mid-generation, where the engine writes its result
   into a row that no longer exists and the money is spent for nothing. So the lock
   now asks the one question that matters: is anything being produced right now? */
function clearStage(name, after){
  var why = busyReason();
  if (why) { toast('Not while ' + why + '.'); return; }
  var ids = stage(name).map(function(r){ return r.id; });
  if (!ids.length) { toast('Already empty'); return; }
  dropRows(ids, after);
}
function refreshClearButtons(){
  var why = busyReason();
  [['#clearQueue','queue'], ['#clearReview','review'], ['#clearPublish','publish'], ['#clearDone','done']].forEach(function(pair){
    var b = $(pair[0]); if (!b) return;
    var n = stage(pair[1]).length;
    b.disabled = !n || !!why;
    b.title = !n ? 'Nothing to clear'
            : why ? 'Not while ' + why
            : 'Delete all ' + n + ' post' + (n === 1 ? '' : 's') + ' in this list';
    b.textContent = 'Clear' + (n ? ' (' + n + ')' : '');
  });
}


/* every Refresh shows it was pressed, so a click is never silent */
function withBusy(btn, fn){
  var label = btn.textContent;
  btn.classList.add('busy'); btn.disabled = true; btn.textContent = 'Refreshing…';
  Promise.resolve(fn()).catch(function(){}).then(function(){
    setTimeout(function(){
      btn.classList.remove('busy'); btn.disabled = false; btn.textContent = label;
    }, 350);
  });
}

/* ---------- nav ---------- */
window.show = function show(view){
  if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches){
    document.startViewTransition(function(){ swapView(view); });
  } else { swapView(view); }
};
function swapView(view){
  ['order','review','publish','queue','done','setup'].forEach(function(v){ $('#v-' + v).hidden = v !== view; });
  $$('nav button[data-view]').forEach(function(b){ b.setAttribute('aria-current', b.dataset.view === view ? 'true' : 'false'); });
  if (view === 'review') loadReview();
  if (view === 'queue') loadQueue();
  if (view === 'publish') loadPublish();
  if (view === 'done') loadDone();
}
$$('nav button[data-view]').forEach(function(b){ b.addEventListener('click', function(){ show(b.dataset.view); }); });

/* Theme. Three states, same as the stylesheet: an explicit choice stamps the
   root element, and no stamp at all means "follow the machine". */
(function(){
  var btn = $('#themeBtn');
  function paint(){
    var stamped = document.documentElement.getAttribute('data-theme');
    var dark = stamped ? stamped === 'dark'
                       : matchMedia('(prefers-color-scheme: dark)').matches;
    btn.textContent = dark ? 'Light mode' : 'Dark mode';
    btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
  }
  try {
    var saved = localStorage.getItem('madama.theme');
    if (saved === 'dark' || saved === 'light') document.documentElement.setAttribute('data-theme', saved);
  } catch(e){}
  paint();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', paint);
  btn.addEventListener('click', function(){
    var dark = btn.getAttribute('aria-pressed') === 'true';
    var next = dark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('madama.theme', next); } catch(e){}
    paint();
  });
})();
$('#saveCfg').addEventListener('click', saveCfg);
$('#testCfg').addEventListener('click', function(){
  api('brands?select=brand_id&limit=1')
    .then(function(r){ note($('#cfgNote'),'good','Reachable. ' + (r.length ? 'Data is there.' : 'Connected, but brands is empty — run the seed SQL.')); })
    .catch(function(e){ note($('#cfgNote'),'bad', esc(e.message)); });
});
$('#checkFns').addEventListener('click', checkFns);
$$('.tile[data-go]').forEach(function(t){
  t.addEventListener('click', function(){ show(t.dataset.go); });
});
$('#useBuiltIn').addEventListener('click', function(){
  try { localStorage.removeItem('madama.cfg'); } catch(e){}
  loadCfg();
  if (!CFG.url || !CFG.key){
    note($('#cfgNote'), 'bad', 'There are no built-in settings in this copy of the page — fill in the DEFAULTS block at the top of the file.');
    return;
  }
  note($('#cfgNote'), 'good', 'Back to the settings built into the page.');
  boot();
});
$('#reloadReview').addEventListener('click', function(){ withBusy(this, loadReview); });
$('#reloadPublish').addEventListener('click', function(){ withBusy(this, loadPublish); });
$('#reloadDone').addEventListener('click', function(){ withBusy(this, loadDone); });
$('#clearQueue').addEventListener('click',   function(){ clearStage('queue',   loadQueue); });
$('#clearReview').addEventListener('click',  function(){ clearStage('review',  loadReview); });
$('#clearPublish').addEventListener('click', function(){ clearStage('publish', loadPublish); });
$('#clearDone').addEventListener('click',    function(){ clearStage('done',    loadDone); });
$('#reloadQueue').addEventListener('click', function(){ withBusy(this, loadQueue); });
$('#runEngine').addEventListener('click', runEngine);
$('#dropDrafts').addEventListener('click', function(){
  dropRows(QUEUE.filter(deletable).map(function(r){ return r.id; }));
});
['#plan','#hour','#startDate','#vsecs','#vres','#vstyle'].forEach(function(s){
  $(s).addEventListener('change', recalc);
});
$('#startDate').valueAsDate = new Date();
loadCfg();
boot();

/* ============================================================================
   MOTION & INTERACTION
   ----------------------------------------------------------------------------
   Everything below is presentation. It adds no behaviour the console depends
   on: strip this block out and every button, fetch and state change still
   works exactly the same. It is kept last, and kept separate, for that reason.

   Four things live here:
     1. reveal   — elements settle into place as they arrive on screen
     2. pointer  — surfaces light up under the cursor; the backdrop leans
     3. ripple   — a press leaves a mark where it landed
     4. enhance  — applies 1 and 2 to content the app renders later
   ========================================================================== */
(function () {
  'use strict';

  var still = matchMedia('(prefers-reduced-motion: reduce)');

  /* ---- 1. reveal ---------------------------------------------------------
     Chrome runs this natively off the scroll position (animation-timeline in
     style.css) and never needs the observer. Everywhere else the observer does
     it. Both paths end at the same class, and neither can leave something
     invisible: anything already on screen is revealed on the spot, and the
     timer at the bottom reveals the lot no matter what. */
  var io = 'IntersectionObserver' in window
    ? new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.04 })
    : null;

  function revealScan() {
    var h = window.innerHeight || 800;
    document.querySelectorAll('.reveal:not(.in)').forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < h * 1.05 && r.bottom > -40) el.classList.add('in');
    });
  }

  /* ---- 2. pointer --------------------------------------------------------
     One listener for the whole page rather than one per card. It writes CSS
     custom properties and lets the stylesheet decide what to do with them, so
     nothing here knows about glows, orbs or any particular element. */
  var raf = 0, last = null;
  function onMove(e) {
    last = e;
    if (raf) return;
    raf = requestAnimationFrame(function () {
      raf = 0;
      var ev = last; if (!ev) return;

      /* the backdrop leans, normalised to -1..1 from the centre of the window */
      var root = document.documentElement;
      root.style.setProperty('--px', ((ev.clientX / window.innerWidth) * 2 - 1).toFixed(3));
      root.style.setProperty('--py', ((ev.clientY / window.innerHeight) * 2 - 1).toFixed(3));

      /* the surface under the cursor lights where the cursor is */
      var el = ev.target && ev.target.closest && ev.target.closest('.glow');
      if (!el) return;
      var r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (ev.clientX - r.left) + 'px');
      el.style.setProperty('--my', (ev.clientY - r.top) + 'px');
    });
  }

  /* ---- 3. ripple --------------------------------------------------------- */
  function onDown(e) {
    var b = e.target && e.target.closest && e.target.closest('.btn');
    if (!b || b.disabled) return;
    var r = b.getBoundingClientRect();
    b.style.setProperty('--rx', (e.clientX - r.left) + 'px');
    b.style.setProperty('--ry', (e.clientY - r.top) + 'px');
    b.classList.remove('rip');
    void b.offsetWidth;               // restart the animation on a repeat press
    b.classList.add('rip');
  }

  /* ---- 4. enhance --------------------------------------------------------
     The queue, the review cards and the published table are all built after a
     fetch returns, so they never exist when this file first runs. A mutation
     observer picks them up instead of every render function having to remember
     to call something. */
  function enhance(root) {
    (root || document).querySelectorAll('.panel, .card, .tile').forEach(function (el) {
      if (!el.classList.contains('glow')) el.classList.add('glow');
      if (!el.classList.contains('reveal') && !el.classList.contains('in')) {
        el.classList.add('reveal');
        if (io) io.observe(el);
      }
    });
    revealScan();
  }

  function start() {
    enhance(document);

    if (!still.matches) {
      window.addEventListener('pointermove', onMove, { passive: true });
    }
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('scroll', revealScan, { passive: true });
    window.addEventListener('resize', revealScan, { passive: true });

    if ('MutationObserver' in window) {
      new MutationObserver(function (muts) {
        var touched = false;
        muts.forEach(function (m) {
          m.addedNodes.forEach(function (n) { if (n.nodeType === 1) touched = true; });
        });
        if (touched) enhance(document);
      }).observe(document.querySelector('main') || document.body,
                 { childList: true, subtree: true });
    }

    /* Failsafe. If the observer never fires — a browser without it, a tab
       restored in the background, a section that was hidden when it was
       observed — nothing stays stuck at zero opacity. */
    setTimeout(function () {
      document.querySelectorAll('.reveal:not(.in)').forEach(function (el) { el.classList.add('in'); });
    }, 1400);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
