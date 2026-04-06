// =====================================================
// MUSICFY AI CHAT ASSISTANT — Frontend Logic
// Use environment variables or window config for production deployment
const BACKEND_URL = window.BACKEND_URL || 'http://13.234.225.151:3001';
const SITE_URL = window.SITE_URL || 'http://localhost:5174';

// --- State ---
let chatHistory = [];     // { role: 'user'|'assistant', text, response, ts }
let songs = [];           // Local library
let currentSong = null;   // Current playing song
let isLoading = false;

// --- DOM ---
const messagesEl = document.getElementById('messages');
const messagesWrap = document.getElementById('messages-wrap');
const inputEl = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const typingEl = document.getElementById('typing-indicator');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const topbarStatus = document.getElementById('topbar-status');
const modelNameEl = document.getElementById('model-name');
const historyList = document.getElementById('history-list');

// Player DOM
const audioPlayer = document.getElementById('audio-player');
const playerBar = document.getElementById('player-bar');
const playerSong = document.getElementById('player-song');
const playerBtn = document.getElementById('player-play-btn');

// =====================================================
// MUSIC PLAYER & LIBRARY
// =====================================================
// (Removed hardcoded SITE_URL, now defined at top)

async function loadSongs() {
  try {
    const res = await fetch(`${SITE_URL}/songs/songs.json`);
    if (res.ok) songs = await res.json();
  } catch { }
}

function findSongByQuery(query) {
  const norm = query.toLowerCase().replace(/[^a-z0-9]/g, '');
  return songs.filter(s => {
    const sNorm = s.toLowerCase().replace(/[^a-z0-9]/g, '');
    return sNorm.includes(norm) || norm.includes(sNorm);
  });
}

function cleanSongTitle(filename) {
  return filename.replace('.mp3', '').replace(/_spotdown\.org/g, '').replace(/_/g, ' ');
}

function playSong(file) {
  const title = cleanSongTitle(file);
  audioPlayer.src = `${SITE_URL}/songs/${encodeURIComponent(file)}`;
  playerSong.textContent = title;
  currentSong = { file, title };

  document.body.classList.add('player-active');
  playerBar.style.display = 'flex';
  audioPlayer.play().catch(console.error);
  updatePlayerBtn(true);
}

async function downloadCurrentSong() {
  if (!currentSong) return;
  const url = `${SITE_URL}/songs/${encodeURIComponent(currentSong.file)}`;
  const link = document.createElement('a');
  link.href = url;
  link.download = currentSong.file;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function updatePlayerBtn(playing) {
  playerBtn.innerHTML = playing
    ? `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
}

playerBtn.onclick = () => {
  if (audioPlayer.paused) { audioPlayer.play(); updatePlayerBtn(true); }
  else { audioPlayer.pause(); updatePlayerBtn(false); }
};

// =====================================================
// BACKEND STATUS
// =====================================================
async function checkBackend() {
  try {
    const res = await fetch(`${BACKEND_URL}/`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error('not ok');
    const data = await res.json();
    setOnline(true, data.model_name);
  } catch {
    setOnline(false);
  }
}

function setOnline(ok, modelName) {
  statusDot.className = 'status-dot ' + (ok ? 'online' : 'offline');
  statusText.textContent = ok ? 'Backend Online' : 'Backend Offline';
  topbarStatus.textContent = ok ? '🟢 Connected' : '🔴 Disconnected';
  if (modelNameEl && ok && modelName) modelNameEl.textContent = modelName;
}

// =====================================================
// CHAT
// =====================================================
async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text || isLoading) return;

  inputEl.value = '';
  inputEl.style.height = 'auto';
  appendUserBubble(text);
  setLoading(true);

  try {
    const res = await fetch(`${BACKEND_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': 'musicfy-secret-key-2026' },
      body: JSON.stringify({ message: text }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const response = { status: 'unknown_intent', data: {}, message: data.reply || '' };
    executeIntent(response, text);
    appendAssistantBubble(text, response, 'Qwen');

    // Persist to history
    chatHistory.push({ role: 'user', text, ts: now() });
    chatHistory.push({ role: 'assistant', response, ts: now() });
    saveHistory();

  } catch (err) {
    appendErrorBubble(err.message || 'Something went wrong');
  } finally {
    setLoading(false);
  }
}

function executeIntent(response, originalMessage) {
  const status = (response.status || '').toLowerCase();
  const data = response.data || {};
  const songQ = data.song || data.movie || originalMessage;

  if (status === 'playing' || status === 'play_song') {
    const matches = findSongByQuery(songQ);
    if (matches.length > 0) playSong(matches[0]);
  } else if (status === 'paused') {
    audioPlayer.pause();
    updatePlayerBtn(false);
  } else if (status === 'resumed') {
    if (audioPlayer.src) { audioPlayer.play(); updatePlayerBtn(true); }
  } else if (status === 'stopped') {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    updatePlayerBtn(false);
    playerBar.style.display = 'none';
    document.body.classList.remove('player-active');
  } else if (status === 'downloading' || status === 'download_song') {
    downloadCurrentSong();
  }
}


function sendSuggestion(text) {
  inputEl.value = text;
  sendMessage();
}

function setLoading(state) {
  isLoading = state;
  sendBtn.disabled = state;
  typingEl.classList.toggle('hidden', !state);
  if (state) scrollBottom();
}

// =====================================================
// BUBBLE BUILDERS
// =====================================================
function appendUserBubble(text) {
  const row = document.createElement('div');
  row.className = 'bubble-row user';
  row.innerHTML = `
    <div class="bubble-avatar">👤</div>
    <div>
      <div class="bubble user-bubble">${escHtml(text)}</div>
      <div class="timestamp">${now()}</div>
    </div>
  `;
  messagesEl.appendChild(row);
  scrollBottom();
}

function appendAssistantBubble(userText, response, model) {
  const { humanText, cardHtml } = buildResponseContent(response);
  const row = document.createElement('div');
  row.className = 'bubble-row assistant';
  row.innerHTML = `
    <div class="bubble-avatar">🎵</div>
    <div>
      <div class="bubble assistant-bubble">
        <p>${escHtml(humanText)}</p>
        ${cardHtml}
      </div>
      <div class="timestamp">${now()}</div>
    </div>
  `;
  messagesEl.appendChild(row);
  scrollBottom();
}

function appendErrorBubble(msg) {
  const row = document.createElement('div');
  row.className = 'bubble-row assistant';
  row.innerHTML = `
    <div class="bubble-avatar">🎵</div>
    <div>
      <div class="bubble assistant-bubble">
        <div class="response-card">
          <div class="rc-header"><span class="rc-badge error">Error</span></div>
          <p style="font-size:13px;color:var(--text-dim)">${escHtml(msg)}</p>
        </div>
      </div>
    </div>
  `;
  messagesEl.appendChild(row);
  scrollBottom();
}

// =====================================================
// RESPONSE FORMATTING
// =====================================================
function buildResponseContent(response) {
  const status = (response.status || '').toLowerCase();
  const data = response.data || {};
  const intent = data.intent || status;
  const song = data.song || response.song || null;
  const movie = data.movie || response.movie || null;
  const artist = data.artist || response.artist || null;
  const errMsg = response.message || '';

  let humanText = '';
  let badgeClass = 'unknown';
  let badgeLabel = '?';
  let details = '';

  switch (status) {
    case 'playing':
    case 'play_song':
      badgeClass = 'playing';
      badgeLabel = '▶ Playing';
      humanText = `Got it! Playing${song ? ` "${song}"` : ''}${movie ? ` from ‟${movie}"` : ''}${artist ? ` by ${artist}` : ''}.`;
      break;

    case 'searching':
    case 'search_song':
      badgeClass = 'searching';
      badgeLabel = '🔍 Searching';
      humanText = `Searching for${song ? ` "${song}"` : ' songs'}${movie ? ` from "${movie}"` : ''}${artist ? ` by ${artist}` : ''} in the library.`;
      break;

    case 'downloading':
    case 'download_song':
      badgeClass = 'downloading';
      badgeLabel = '⬇ Downloading';
      humanText = `Starting download for${song ? ` "${song}"` : ''}${movie ? ` from "${movie}"` : ''}.`;
      break;

    case 'paused':
      badgeClass = 'paused';
      badgeLabel = '⏸ Paused';
      humanText = 'Music paused.';
      break;

    case 'resumed':
      badgeClass = 'resumed';
      badgeLabel = '▶ Resumed';
      humanText = 'Music resumed!';
      break;

    case 'stopped':
      badgeClass = 'stopped';
      badgeLabel = '⏹ Stopped';
      humanText = 'Music stopped.';
      break;

    case 'error':
      badgeClass = 'error';
      badgeLabel = 'Error';
      humanText = errMsg || 'Something went wrong on the backend.';
      break;

    case 'unknown_intent':
    default:
      badgeClass = 'unknown';
      badgeLabel = '❓ Unknown';
      humanText = "Sorry, I didn't catch that. Try: \"play [song]\", \"search [song]\", \"pause\", or \"download [song]\".";
  }

  // Build detail rows
  const rows = [];
  if (song) rows.push(`<div class="rc-row"><strong>Song:</strong> ${escHtml(song)}</div>`);
  if (movie) rows.push(`<div class="rc-row"><strong>Movie:</strong> ${escHtml(movie)}</div>`);
  if (artist) rows.push(`<div class="rc-row"><strong>Artist:</strong> ${escHtml(artist)}</div>`);

  if (status === 'error' || status === 'unknown_intent') {
    return { humanText, cardHtml: '' };
  }

  const cardHtml = `
    <div class="response-card">
      <div class="rc-header">
        <span class="rc-badge ${badgeClass}">${badgeLabel}</span>
      </div>
      ${rows.join('\n')}
    </div>
  `;

  return { humanText, cardHtml };
}

// =====================================================
// UTILITIES
// =====================================================
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function now() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function scrollBottom() {
  requestAnimationFrame(() => {
    messagesWrap.scrollTop = messagesWrap.scrollHeight;
  });
}

// =====================================================
// PERSISTENCE
// =====================================================
const LS_KEY = 'musicfy_chatbot_history';

function saveHistory() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(chatHistory.slice(-100))); }
  catch { }
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) chatHistory = JSON.parse(raw);
  } catch { chatHistory = []; }
  renderHistoryTab();
}

function renderHistoryTab() {
  if (!historyList) return;
  if (chatHistory.length === 0) {
    historyList.innerHTML = '<p class="empty-state">No history yet. Start chatting!</p>';
    return;
  }
  historyList.innerHTML = chatHistory.map(entry => {
    const isUser = entry.role === 'user';
    const label = isUser ? 'You' : 'Musicfy AI';
    const cls = isUser ? 'user-role' : 'ai-role';
    const text = isUser
      ? escHtml(entry.text)
      : escHtml((entry.response?.status || 'response') + (entry.response?.data?.song ? ` — ${entry.response.data.song}` : ''));
    return `
      <div class="history-entry">
        <div class="he-role ${cls}">${label} · ${entry.ts || ''}</div>
        <div class="he-text">${text}</div>
      </div>
    `;
  }).reverse().join('');
}

function clearHistory() {
  if (!confirm('Clear all conversation history?')) return;
  chatHistory = [];
  saveHistory();
  renderHistoryTab();
}

// =====================================================
// UI CONTROLS
// =====================================================
function clearChat() {
  if (!confirm('Clear this chat?')) return;
  // Remove all bubbles except the first (welcome) bubble
  const rows = messagesEl.querySelectorAll('.bubble-row');
  rows.forEach((r, i) => { if (i > 0) r.remove(); });
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

let activeTab = 'chat';
function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('nav-' + tab).classList.add('active');
  document.getElementById('panel-' + tab).classList.add('active');
  if (tab === 'history') renderHistoryTab();
}

// =====================================================
// INPUT AUTO-RESIZE & KEYBOARD
// =====================================================
inputEl.addEventListener('input', () => {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
});

inputEl.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

document.getElementById('sidebar-close').addEventListener('click', () => {
  document.getElementById('sidebar').classList.remove('open');
});

// =====================================================
// INIT
// =====================================================
(async () => {
  loadHistory();
  await loadSongs();
  await checkBackend();
  // Recheck every 30s
  setInterval(checkBackend, 30000);
})();


