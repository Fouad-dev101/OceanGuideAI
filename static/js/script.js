/* ═══════════════════════════════════════════════
   Ocean Guide AI — script.js
   ═══════════════════════════════════════════════ */

// ─────────────────────────────────────────────
// Bubbles animation
// ─────────────────────────────────────────────
const oceanBg = document.getElementById('oceanBg');
for (let i = 0; i < 22; i++) {
  const b = document.createElement('div');
  const s = Math.random() * 13 + 3;
  b.className = 'bubble';
  b.style.cssText = `
    width:${s}px; height:${s}px;
    left:${Math.random() * 100}%;
    bottom:${Math.random() * 20}px;
    background: rgba(0,188,212,${Math.random() * 0.12 + 0.03});
    animation-duration: ${10 + Math.random() * 16}s;
    animation-delay: ${Math.random() * 12}s;
  `;
  oceanBg.appendChild(b);
}

// ─────────────────────────────────────────────
// Tab switching
// ─────────────────────────────────────────────
function switchTab(t) {
  document.getElementById('tab-search-btn').classList.toggle('active', t === 'search');
  document.getElementById('tab-chat-btn').classList.toggle('active', t === 'chat');
  document.getElementById('panel-search').style.display = t === 'search' ? 'block' : 'none';
  document.getElementById('panel-chat').style.display   = t === 'chat'   ? 'flex'  : 'none';

  if (t === 'chat' && document.querySelectorAll('.msg').length === 0) {
    initChat();
  }
}

// ─────────────────────────────────────────────
// Quick Buttons (popular species)
// ─────────────────────────────────────────────
const POPULAR = [
  { sci: 'Thunnus thynnus',          label: 'Thon rouge' },
  { sci: 'Amphiprion ocellaris',     label: 'Poisson-clown' },
  { sci: 'Homarus gammarus',         label: 'Homard' },
  { sci: 'Sepia officinalis',        label: 'Seiche' },
  { sci: 'Gadus morhua',             label: 'Morue' },
  { sci: 'Hippocampus hippocampus',  label: 'Hippocampe' },
  { sci: 'Lophius piscatorius',      label: 'Baudroie' },
  { sci: 'Octopus vulgaris',         label: 'Pieuvre' },
];

const qb = document.getElementById('quickBtns');
POPULAR.forEach(({ sci, label }) => {
  const btn = document.createElement('button');
  btn.className = 'quick-btn';
  btn.textContent = label;
  btn.title = sci;
  btn.onclick = () => loadSpecies(sci);
  qb.appendChild(btn);
});

// ─────────────────────────────────────────────
// Search / Autocomplete
// ─────────────────────────────────────────────
let debounceTimer;
const searchInput  = document.getElementById('searchInput');
const suggestionsEl = document.getElementById('suggestions');

searchInput.addEventListener('input', function () {
  clearTimeout(debounceTimer);
  const q = this.value.trim();
  if (q.length < 2) { suggestionsEl.style.display = 'none'; return; }
  debounceTimer = setTimeout(() => fetchSuggestions(q), 200);
});

searchInput.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') { suggestionsEl.style.display = 'none'; }
  if (e.key === 'Enter')  { suggestionsEl.style.display = 'none'; loadSpecies(this.value.trim()); }
});

document.addEventListener('click', function (e) {
  if (!searchInput.contains(e.target) && !suggestionsEl.contains(e.target)) {
    suggestionsEl.style.display = 'none';
  }
});

function fetchSuggestions(q) {
  fetch(`/suggest?q=${encodeURIComponent(q)}`)
    .then(r => r.json())
    .then(items => renderSuggestions(items))
    .catch(() => { suggestionsEl.style.display = 'none'; });
}

function renderSuggestions(items) {
  if (!items.length) { suggestionsEl.style.display = 'none'; return; }

  suggestionsEl.innerHTML = items.map(item => `
    <div class="sug-item" onclick="selectSpecies('${item.sci.replace(/'/g, "\\'")}')">
      <div class="sug-sci">
        ${item.sci}
        ${item.code ? `<span class="fao-tag">${item.code}</span>` : ''}
      </div>
      <div class="sug-common">
        ${[item.eng, item.fra].filter(Boolean).join(' · ') || '&nbsp;'}
      </div>
    </div>
  `).join('');

  suggestionsEl.style.display = 'block';
}

function selectSpecies(sci) {
  searchInput.value = sci;
  suggestionsEl.style.display = 'none';
  loadSpecies(sci);
}

// ─────────────────────────────────────────────
// Load & display species
// ─────────────────────────────────────────────
function loadSpecies(sci) {
  if (!sci) return;
  setRight(loadingHTML());

  fetch(`/species?name=${encodeURIComponent(sci)}`)
    .then(r => r.json())
    .then(data => buildCard(data, sci))
    .catch(() => setRight(`<div class="err-card">❌ Erreur réseau. Vérifiez que Flask tourne.</div>`));
}

function buildCard(data, sci) {
  const fao    = data.fao    || {};
  const d      = data.detail || {};
  const photo  = data.photo  || '';
  const source = data.source || 'FAO ASFIS';
  const sciName = d.ScientificName || sci;

  // Common names
  const names = [d.FBname || d.SLBname, fao.fra, fao.eng]
    .filter((v, i, a) => v && a.indexOf(v) === i);

  // Stats row (size, weight, depth, etc.)
  const stats = [
    d.Length && { v: d.Length + ' cm', l: 'Taille max' },
    d.Weight && { v: d.Weight + ' kg', l: 'Poids max' },
    (d.DepthRangeShallow != null && d.DepthRangeDeep != null) && { v: d.DepthRangeShallow + '–' + d.DepthRangeDeep + ' m', l: 'Profondeur' },
    d.Longevity && { v: d.Longevity + ' ans', l: 'Longévité' },
    d.AgeMaturity && { v: d.AgeMaturity + ' ans', l: 'Maturité' },
    d.TemperatureRange && { v: d.TemperatureRange + ' °C', l: 'Température' },
    d.Vulnerability && { v: d.Vulnerability, l: 'Vulnérabilité' }
  ].filter(Boolean);

  // Conservation
  const conCode  = d.IUCNCode || d.iucnCode || '';
  const conClass = { LC:'con-lc', NT:'con-nt', VU:'con-vu', EN:'con-en', CR:'con-cr', DD:'con-dd' }[conCode] || '';
  const conLabel = {
    LC:'Préoccupation mineure', NT:'Quasi menacé',
    VU:'Vulnérable', EN:'En danger', CR:'En danger critique', DD:'Données insuffisantes'
  }[conCode] || conCode;

  const html = `
  <div class="species-card">
    <div class="card-hero">
      ${photo ? `<img src="${photo}" alt="${sciName}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
      <div class="hero-no-img" style="${photo ? 'display:none' : ''}">🐟</div>
      <div class="hero-grad"></div>
      <div class="hero-source">📡 ${source}</div>
      <div class="hero-names">
        <h2>${sciName}</h2>
        ${names.length ? `<div class="common-names">${names.map(n=>`<span class="common-badge">${n}</span>`).join('')}</div>` : ''}
      </div>
    </div>

    <div class="fao-banner">
      <div class="fao-code-big">${fao.code || '–'}</div>
      <div class="fao-details">
        <div class="fao-name-fr">${fao.fra || fao.eng || sciName}</div>
        ${fao.fra && fao.eng ? `<div class="fao-name-en">${fao.eng}</div>` : ''}
        ${fao.family ? `<div class="fao-family">${fao.family}${fao.order ? ' · ' + fao.order : ''}</div>` : ''}
      </div>
      <div class="fao-logo"><strong>FAO</strong>ASFIS 2025</div>
    </div>

    <div class="card-body">
      <!-- Taxonomy -->
      ${(d.Kingdom||d.Phylum||d.Class||d.Order||d.Family||fao.family) ? `
      <div class="taxonomy-strip">
        ${d.Kingdom ? `<div class="tax-item"><span class="tax-label">Règne</span><span class="tax-val">${d.Kingdom}</span></div>` : ''}
        ${d.Phylum  ? `<div class="tax-item"><span class="tax-label">Embranchement</span><span class="tax-val">${d.Phylum}</span></div>` : ''}
        ${d.Class   ? `<div class="tax-item"><span class="tax-label">Classe</span><span class="tax-val">${d.Class}</span></div>` : ''}
        ${d.Order   ? `<div class="tax-item"><span class="tax-label">Ordre</span><span class="tax-val">${d.Order}</span></div>` : ''}
        ${(d.Family||fao.family) ? `<div class="tax-item"><span class="tax-label">Famille</span><span class="tax-val">${d.Family||fao.family}</span></div>` : ''}
      </div>` : ''}

      <!-- Stats -->
      ${stats.length ? `
      <div class="stats-row">
        ${stats.map(s=>`<div class="stat-box"><div class="stat-val">${s.v}</div><div class="stat-lbl">${s.l}</div></div>`).join('')}
      </div>` : `
      <div class="stats-row">
        <div class="stat-box"><div class="stat-val">—</div><div class="stat-lbl">Taille max</div></div>
        <div class="stat-box"><div class="stat-val">—</div><div class="stat-lbl">Poids max</div></div>
        <div class="stat-box"><div class="stat-val">—</div><div class="stat-lbl">Profondeur</div></div>
      </div>`}

      <!-- Ecological info -->
      <div class="info-grid">
        <div class="info-block full"><label>🌍 Habitat</label><p class="muted">${d.Habitat || '—'}</p></div>
        <div class="info-block full"><label>🗺️ Distribution</label><p class="muted">${d.Distribution || '—'}</p></div>
        <div class="info-block"><label>🦐 Alimentation</label><p class="muted">${d.FoodItems || '—'}</p></div>
        <div class="info-block"><label>🔄 Comportement</label><p class="muted">${(d.Behavior||d.Behaviour) || '—'}</p></div>
        <div class="info-block full"><label>🧬 Biologie</label><p class="muted">${(d.Biology||d.GeneralCharacteristics) || '—'}</p></div>
        <div class="info-block full"><label>📋 Notes additionnelles</label><p class="muted">${d.Comments || '—'}</p></div>
      </div>

      <!-- Conservation -->
      ${conCode ? `<div class="conservation ${conClass}">🔴 <strong>Statut UICN : ${conCode}</strong> — ${conLabel}</div>` : ''}

      <!-- External links -->
      <div class="ext-links">
        <a href="https://fishbase.se/summary/${sciName.replace(' ','-')}.html" target="_blank" class="ext-link">🐟 FishBase</a>
        <a href="https://sealifebase.se/summary/${sciName.replace(' ','-')}.html" target="_blank" class="ext-link">🦑 SeaLifeBase</a>
        <a href="https://www.marinespecies.org/aphia.php?p=search&q=${encodeURIComponent(sciName)}" target="_blank" class="ext-link">🌊 WoRMS</a>
        <a href="https://www.gbif.org/species/search?q=${encodeURIComponent(sciName)}" target="_blank" class="ext-link">🔬 GBIF</a>
        ${fao.code ? `<a href="https://www.fao.org/fishery/en/species/${fao.code}" target="_blank" class="ext-link">📋 FAO</a>` : ''}
        ${photo    ? `<a href="${photo}" target="_blank" class="ext-link">📷 Photo source</a>` : ''}
      </div>
    </div>
  </div>`;
  setRight(html);
}

// ─────────────────────────────────────────────
// AI CHATBOT
// ─────────────────────────────────────────────
let chatHistory    = [];
let partialDesc    = '';
let awaitingMore   = false;
let botIsTyping    = false;

function initChat() {
  chatHistory  = [];
  partialDesc  = '';
  awaitingMore = false;

  appendBotMsg(
    '👋 Salut ! Je suis <strong>MarineBot</strong>, ton expert en espèces marines 🌊\n\n' +
    'Décris-moi ce que tu as observé : couleur, taille, forme, habitat, comportement…\n' +
    'Je vais t\'aider à identifier l\'espèce !'
  );
}

function appendBotMsg(html, isTyping = false) {
  const area = document.getElementById('chatArea');
  const div  = document.createElement('div');
  div.className = 'msg bot';
  div.innerHTML = `
    <div class="avatar bot">🌊</div>
    <div class="bubble-msg">
      ${isTyping
        ? '<div class="typing-dots"><span></span><span></span><span></span></div>'
        : html.replace(/\n/g, '<br>')}
    </div>`;
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
  return div;
}

function appendUserMsg(text) {
  const area = document.getElementById('chatArea');
  const div  = document.createElement('div');
  div.className = 'msg user';
  div.innerHTML = `
    <div class="avatar user">👤</div>
    <div class="bubble-msg">${text.replace(/\n/g, '<br>')}</div>`;
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

async function sendChat() {
  if (botIsTyping) return;

  const inp  = document.getElementById('chatInput');
  const btn  = document.getElementById('sendBtn');
  const text = inp.value.trim();
  if (!text) return;

  inp.value = '';
  inp.style.height = '';
  appendUserMsg(text);

  // Accumulate description
  if (awaitingMore) {
    partialDesc += ' ' + text;
  } else {
    partialDesc = text;
  }

  chatHistory.push({ role: 'user', content: text });

  // Show typing indicator
  const typingDiv = appendBotMsg('', true);
  botIsTyping = true;
  btn.disabled = true;

  // Streaming from Flask /chat
  try {
    const resp = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: chatHistory, partial_desc: partialDesc })
    });

    const reader   = resp.body.getReader();
    const decoder  = new TextDecoder();
    let   buffer   = '';
    let   fullText = '';

    // Replace typing dots with empty bubble for streaming
    const bubbleEl = typingDiv.querySelector('.bubble-msg');
    bubbleEl.innerHTML = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6);
        try {
          const evt = JSON.parse(raw);

          if (evt.chunk) {
            fullText += evt.chunk;
            // Stream text into bubble (but hide if it looks like JSON being built)
            if (!fullText.trimStart().startsWith('{')) {
              bubbleEl.innerHTML = fullText.replace(/\n/g, '<br>');
              document.getElementById('chatArea').scrollTop = 9999;
            }
          }

          if (evt.done) {
            fullText = evt.full || fullText;
            if (!fullText.trim()) {
              bubbleEl.classList.add("error");
              bubbleEl.innerHTML = "❌ Réponse vide — vérifie ta clé Groq dans app.py (ligne GROQ_API_KEY).";
            } else {
              handleBotResponse(fullText, typingDiv, bubbleEl);
            }
          }

          if (evt.error) {
            bubbleEl.classList.add("error");
            bubbleEl.innerHTML = "❌ " + evt.error;
          }
        } catch (_) {}
      }
    }
  } catch (err) {
    typingDiv.querySelector('.bubble-msg').innerHTML = '❌ Impossible de contacter le serveur.';
  } finally {
    botIsTyping  = false;
    btn.disabled = false;
    document.getElementById('chatInput').focus();
  }
}

function handleBotResponse(fullText, msgDiv, bubbleEl) {
  const area = document.getElementById('chatArea');

  // Try to parse as identification JSON
  let parsed = null;
  try {
    const clean = fullText.replace(/```json|```/g, '').trim();
    parsed = JSON.parse(clean);
  } catch (_) {}

  if (parsed && parsed.identified) {
    // ── Identification found ──
    awaitingMore = false;
    chatHistory.push({ role: 'assistant', content: fullText });

    const confEmoji = { high: '🟢', medium: '🟡', low: '🔴' }[parsed.confidence] || '🔵';
    bubbleEl.innerHTML = `
      🎯 <strong>Espèce identifiée !</strong><br><br>
      🔬 <em>${parsed.scientific_name}</em><br>
      🇫🇷 ${parsed.common_fr || '–'} &nbsp;·&nbsp; 🇬🇧 ${parsed.common_en || '–'}<br><br>
      ${confEmoji} <strong>Confiance :</strong> ${parsed.confidence}<br><br>
      💡 ${parsed.reason}<br><br>
      ${parsed.fun_fact ? '🐠 <em>' + parsed.fun_fact + '</em>' : ''}
    `;

    // Action buttons
    const actions = document.createElement('div');
    actions.className = 'chat-actions';
    actions.innerHTML = `
      <button class="chat-action-btn teal"
              onclick="loadSpecies('${parsed.scientific_name.replace(/'/g, "\\'")}')">
        📋 Voir la fiche complète
      </button>
      <button class="chat-action-btn blue" onclick="resetChat()">
        🔄 Nouvelle recherche
      </button>`;
    area.appendChild(actions);

    // Auto-load species card on right panel
    setTimeout(() => loadSpecies(parsed.scientific_name), 700);

  } else {
    // ── Bot asking for more info ──
    awaitingMore = true;
    chatHistory.push({ role: 'assistant', content: fullText });
    bubbleEl.innerHTML = fullText.replace(/\n/g, '<br>');
  }

  area.scrollTop = area.scrollHeight;
}

function resetChat() {
  document.getElementById('chatArea').innerHTML = '';
  chatHistory  = [];
  partialDesc  = '';
  awaitingMore = false;
  initChat();
}

// ─────────────────────────────────────────────
// Chat input: Enter to send, Shift+Enter newline
// ─────────────────────────────────────────────
document.getElementById('chatInput').addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChat();
  }
  // Auto-resize
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 100) + 'px';
});

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function setRight(html) {
  document.getElementById('rightPanel').innerHTML = html;
}

function loadingHTML() {
  return `
    <div class="loading-card">
      <div class="wave-load"><span></span><span></span><span></span></div>
      <p>Chargement des données…</p>
    </div>`;
}

// ─────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────
switchTab('search');
