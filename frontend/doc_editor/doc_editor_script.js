// ---------------- Timeline (Version History) ----------------
let versions = [];
let currentUser = null;
let currentVersionId = null; // track which version is currently loaded/active

const local_endpoint = 'http://127.0.0.1:8000';
const production_endpoint = 'https://codora-vk5z.onrender.com';
const current_endpoint = local_endpoint;

// Render timeline dynamically
async function renderVersionHistory() {
  const container = document.getElementById("versionHistory");
  if (!container) return;
  // Ask the server over WebSocket for versions list
  try {
    // Clear UI while loading
    container.innerHTML = '<div style="padding:16px;color:#6b7280">Loading versions…</div>';
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'list_versions' }));
    } else {
      // Fallback: show empty
      container.innerHTML = '<div style="padding:16px;color:#6b7280">Not connected</div>';
    }
  } catch (e) {
    console.error('Failed to request versions', e);
    container.innerHTML = '<div style="padding:16px;color:#6b7280">Failed to fetch versions</div>';
  }
}

function escapeHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Add commit to version history
async function addCommit() {
  const input = document.getElementById("commitMessage");
  const message = input.value.trim();
  if (!message) return;
  // Send commit request over WebSocket
  try {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      alert('Not connected to server yet');
      return;
    }

  // Do not send client-provided author; server will set author from session
  ws.send(JSON.stringify({ type: 'commit', message, content: editor ? editor.innerHTML : '' }));
    // optimistic UI: clear message and wait for server to broadcast updated list
    input.value = '';
  } catch (e) {
    console.error('Commit error', e);
    alert('Commit failed');
  }
}

// Commit button + Enter key
window.addEventListener("DOMContentLoaded", () => {
  renderVersionHistory();
  document.querySelector(".commit-btn").addEventListener("click", addCommit);
  document.getElementById("commitMessage").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      addCommit();
    }
  });
});

// Zoom functionality
let zoomLevel = 100;
const zoomButtons = document.querySelectorAll(".zoom-control .toolbar-btn");
const zoomDisplay = document.querySelector(".zoom-control span");
const document_el = document.querySelector(".document");

zoomButtons[0].addEventListener("click", () => {
  if (zoomLevel > 50) {
    zoomLevel -= 10;
    updateZoom();
  }
});

zoomButtons[1].addEventListener("click", () => {
  if (zoomLevel < 200) {
    zoomLevel += 10;
    updateZoom();
  }
});

function updateZoom() {
  zoomDisplay.textContent = zoomLevel + "%";
  document_el.style.transform = `scale(${zoomLevel / 100})`;
  document_el.style.transformOrigin = "top center";
}
const collaborators = [
  { id: 1, name: "User 1 (You)", color: "#3b82f6", emoji: "👤", online: true },
  { id: 2, name: "User 2's Name", color: "#f97316", emoji: "👤", online: true },
  { id: 3, name: "User 3's Name", color: "#10b981", emoji: "👤", online: true },
  { id: 4, name: "AI", color: "#2563eb", emoji: "🤖", online: true },
];

// Render collaborators dynamically
function renderCollaborators() {
  const container = document.getElementById("collaboratorsList");
  if (!container) return;

  container.innerHTML = collaborators
    .map(
      (c) => `
        <div class="collaborator-item">
            <div class="collaborator-avatar" style="background: ${c.color}">
                ${c.emoji}
                ${c.online ? '<div class="online-indicator"></div>' : ""}
            </div>
            <span class="collaborator-name">${c.name}</span>
        </div>
    `
    )
    .join("");
}

// Collaborator hover effect
function enableCollaboratorClick() {
  const collabItems = document.querySelectorAll(".collaborator-item");
  collabItems.forEach((item) => {
    item.addEventListener("click", () => {
      collabItems.forEach((i) => (i.style.background = ""));
      item.style.background = "#f8f9fa";
      setTimeout(() => {
        item.style.background = "";
      }, 300);
    });
  });
}

// Run click behavior once rendered
window.addEventListener("DOMContentLoaded", () => {
  renderCollaborators();
  enableCollaboratorClick();
});

// --- Collaborative editor wiring (Channels /ws/editor/) ---
const editor = document.getElementById("document");
const saveBtn = document.getElementById("saveBtn");
const saveStatus = document.getElementById("saveStatus");
const connStatus = document.getElementById("connStatus");

// Parse room number from URL parameter
const urlParams = new URLSearchParams(window.location.search);
const room = urlParams.get('room') || 'default';

// Update project title with room number
const projectTitle = document.querySelector('.project-title');
if (projectTitle && room !== 'default') {
  projectTitle.textContent = `Project Room: ${room}`;
}


// Derive WebSocket endpoint based on current_endpoint
const wsBase = current_endpoint.replace(/^https?/, current_endpoint.startsWith('https') ? 'wss' : 'ws');

// Build the WebSocket URL
const wsUrl = room === 'default'
  ? `${wsBase}/ws/editor/`
  : `${wsBase}/ws/editor/${room}/`;

console.log('Connecting to room:', room, 'via', wsUrl);

console.log('Connecting to room:', room, 'via', wsUrl);

const clientId =
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
let ws;
let _reconnectAttempts = 0;
let _isConnecting = false;

function connect() {
  if (_isConnecting || (ws && ws.readyState === WebSocket.OPEN)) return;
  _isConnecting = true;
  try {
    ws = new WebSocket(wsUrl);
  } catch (err) {
    console.error('WebSocket construction error', err);
    _isConnecting = false;
    // Retry after delay
    const delay = Math.min(30000, 1000 * Math.pow(2, _reconnectAttempts));
    _reconnectAttempts += 1;
    setTimeout(connect, delay);
    return;
  }

  ws.onopen = () => {
    console.log('WebSocket open', wsUrl);
    console.log('WebSocket open', wsUrl);
    _reconnectAttempts = 0;
    _isConnecting = false;
    if (connStatus) {
      connStatus.textContent = "🟢Connected";
      connStatus.style.color = "#16a34a";
      connStatus.style.fontWeight = "700";
      connStatus.style.fontSize = "22px";
    }
    // On connect, server will send latest content automatically
    // Also request versions list when connected
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'list_versions' }));
  };

  ws.onerror = (err) => {
    console.error('WebSocket error', err);
    if (connStatus) {
      connStatus.textContent = "⚠️Connection error";
      connStatus.style.color = "#d97706";
    }
  };

  ws.onclose = () => {
    console.log('WebSocket closed', wsUrl, 'code=', ws.code, 'reason=', ws.reason);
    if (connStatus) {
      connStatus.textContent = "⛔Disconnected";
      connStatus.style.color = "#dc2626";
      connStatus.style.fontWeight = "700";
      connStatus.style.fontSize = "22px";
    }
    _isConnecting = false;
    // Reconnect with exponential backoff
    const delay = Math.min(30000, 1000 * Math.pow(2, _reconnectAttempts));
    _reconnectAttempts += 1;
    setTimeout(connect, delay);
  };

  ws.onmessage = (event) => {
      let data = null;
      try {
        data = JSON.parse(event.data);
        if (data.type === "edit") {
          // Process edits quickly and defer heavy markdown parsing/highlighting.
          const raw = String(data.content ?? "");

          // If raw looks like HTML, update immediately (fast path).
          const looksHtml = /^\s*<[^>]+>/.test(raw);
          if (looksHtml) {
            if (editor.innerHTML !== raw) editor.innerHTML = raw;
          } else {
            // Debounce and schedule parsing of the latest content on idle.
            scheduleParseAndRender(raw);
          }
        }
      if (data.type === 'versions_list') {
        // Received versions list from server, render into timeline
        const container = document.getElementById('versionHistory');
        const list = data.versions || [];
        // Normalize and sort versions newest-first by timestamp
        versions = (list || []).slice().sort((a,b) => {
          try { return new Date(b.timestamp) - new Date(a.timestamp); } catch(e) { return 0; }
        });
        // If no version selected yet, default to the most recent (first) version
        if (!currentVersionId && versions.length > 0) currentVersionId = versions[0].id;
        if (!container) return;
        container.innerHTML = versions
          .map((v) => {
            // format time safely (assume UTC timestamps)
            let ts = '';
            try { ts = new Date(v.timestamp).toLocaleString(); } catch(e) { ts = v.timestamp; }
            const authorLabel = (currentUser && v.author === currentUser.username) ? `${escapeHtml(v.author)} (you)` : escapeHtml(v.author || 'User');
            const isCurrent = currentVersionId === v.id;
            return `
            <div class="timeline-item ${isCurrent ? 'selected' : ''}" data-version-id="${v.id}" style="position:relative;">
              <div class="timeline-dot"></div>
              <div class="timeline-content">
                <div class="timeline-title">${escapeHtml(v.message || '(no message)')}</div>
                <div class="timeline-meta">${ts}</div>
                <div class="timeline-meta">by ${authorLabel}</div>
              </div>
              <button class="delete-version-btn" data-version-id="${v.id}" title="Delete" style="position:absolute;right:8px;top:8px;background:transparent;border:none;cursor:pointer;">
                <!-- trash icon -->
                <img src="icons8-delete-512.svg" alt="Delete" width="18" height="18" />
              </button>
              ${isCurrent ? '<div class="current-indicator" style="position:absolute;left:-25px;top:8px;">-></div>' : ''}
            </div>
          `}).join('');

        // Attach click handlers
        // Click to load
        container.querySelectorAll('.timeline-item').forEach(item => {
          item.addEventListener('click', () => {
            const vid = item.getAttribute('data-version-id');
            if (!vid) return;
            if (!ws || ws.readyState !== WebSocket.OPEN) return;
            ws.send(JSON.stringify({ type: 'get_version', version_id: vid }));
            // optimistic highlight
            currentVersionId = vid;
            // re-render highlight
            renderVersionHistory();
          });
        });

        // Delete buttons
        container.querySelectorAll('.delete-version-btn').forEach(btn => {
          btn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const vid = btn.getAttribute('data-version-id');
            if (!vid) return;
            if (!ws || ws.readyState !== WebSocket.OPEN) {
              alert('Not connected');
              return;
            }
            if (!confirm('Delete this commit? This action cannot be undone.')) return;
            ws.send(JSON.stringify({ type: 'delete_version', version_id: vid }));
          });
        });
      }

      if (data.type === 'version_committed') {
        // Optionally show a toast and refresh versions list
        if (data.version) {
          // server will decide author; if it matches current user, mark as current
          showNotification('Version saved', 'success');
          currentVersionId = data.version.id;
        } else {
          showNotification('Failed to save version', 'info');
        }
        // Ask server for updated list
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'list_versions' }));
      }

      if (data.type === 'chat_ack') {
        console.log('[CHAT ACK RECV]', data);
        // Optionally show a tiny UI confirmation; for now just log it
      }

      if (data.type === 'chat_history') {
        try {
          const msgs = data.messages || [];
          console.log('[CHAT HISTORY] count=', msgs.length);
          msgs.forEach(m => {
            const username = m.username || 'User';
            const text = m.message || m.text || '';
            const ts = m.timestamp || new Date().toISOString();
            const isMe = currentUser && username === currentUser.username;
            renderChatMessage({ username, text, timestamp: ts, isMe });
          });
        } catch (e) {
          console.warn('Failed to render chat history', e);
        }
      }

      if (data.type === 'chat') {
        const username = data.username || (data.user && data.user.username) || 'User';
        const text = data.message || data.text || '';
        const ts = data.timestamp || new Date().toISOString();
        const isMe = currentUser && username === currentUser.username;
        console.log('[CHAT INCOMING]', 'room=', room, 'username=', username, 'text=', text, 'isMe=', isMe);
        renderChatMessage({ username, text, timestamp: ts, isMe });
      }

      if (data.type === 'version_data') {
        const v = data.version;
        if (!v) {
          showNotification('Version not found', 'info');
          return;
        }
        if (editor) {
          editor.innerHTML = v.content || '';
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'edit', content: editor.innerHTML, clientId }));
          }
          currentVersionId = v.id;
          showNotification('Loaded version: ' + (v.message || v.id), 'success');
          // re-render timeline to reflect current indicator
          renderVersionHistory();
        }
      }
      if (data.type === "saved") {
        if (data.ok) {
          saveStatus.textContent = `Saved to ${data.path}`;
          saveStatus.style.color = "#16a34a";
        } else {
          saveStatus.textContent = `Save error: ${data.error}`;
          saveStatus.style.color = "#dc2626";
        }
        setTimeout(() => {
          saveStatus.textContent = "";
        }, 2000);
      }
      if (data.type === "users_list" || data.type === "user_joined" || data.type === "user_left") {
        updateCollaboratorsList(data.users);
        
        if (data.type === "user_joined") {
          showNotification(`${data.user.username} joined`, "success");
        } else if (data.type === "user_left") {
          showNotification(`${data.user.username} left`, "info");
        }
      }
    } catch (e) {
      console.warn("WS message parse error", e);
    }

    if (!data) return;

    if (data.type === 'me') {
      currentUser = data.user;
      console.log('Connected as', currentUser);
    }

    if (data.type === 'version_deleted') {
      if (data.ok) {
        showNotification('Version deleted', 'info');
        // if we deleted the currently active version, clear currentVersionId
        if (currentVersionId === data.version_id) currentVersionId = null;
        // re-request versions list
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'list_versions' }));
      } else {
        showNotification('Failed to delete version', 'info');
      }
    }
  };
}

function updateCollaboratorsList(users) {
  const collabsList = document.getElementById('collaboratorsList');
  if (!collabsList || !users) return;
  
  collabsList.innerHTML = users.map(user => `
    <div style="display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 8px; background: #f3f4f6; margin-bottom: 8px;">
      <div style="width: 36px; height: 36px; border-radius: 50%; background: ${user.avatarColor}; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 14px;">
        ${user.username.charAt(0).toUpperCase()}
      </div>
      <span style="font-weight: 500; font-size: 14px;">${user.username}</span>
    </div>
  `).join('');
}

function showNotification(message, type = "info") {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    background: ${type === 'success' ? '#10b981' : '#3b82f6'};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

connect();

// ---------------- Floating prompt (bottom) ----------------
// If there's already a floating prompt, don't recreate it
function ensureFloatingPrompt() {
  if (document.getElementById('floatingPrompt')) return;

  const wrapper = document.createElement('div');
  wrapper.id = 'floatingPrompt';
  wrapper.className = 'floating-prompt';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Enter a prompt to generate content...';
  input.id = 'floatingPromptInput';

  const btn = document.createElement('button');
  btn.className = 'generate-btn';
  btn.textContent = 'Generate';

  // Loading overlay utilities
  function showLoading(message = 'Generating…') {
    let overlay = document.getElementById('aiLoadingOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'aiLoadingOverlay';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:100000;';
      const box = document.createElement('div');
      box.style.cssText = 'background:white;padding:20px 30px;border-radius:12px;display:flex;align-items:center;gap:12px;box-shadow:0 6px 24px rgba(0,0,0,0.2);';
      const spinner = document.createElement('div');
      spinner.style.cssText = 'width:28px;height:28px;border-radius:50%;border:4px solid #f3f4f6;border-top-color:#3b82f6;animation:spin 1s linear infinite';
      const text = document.createElement('div');
      text.id = 'aiLoadingText';
      text.textContent = message;
      box.appendChild(spinner);
      box.appendChild(text);
      overlay.appendChild(box);
      document.body.appendChild(overlay);

      // add keyframes
      const style = document.createElement('style');
      style.textContent = '@keyframes spin { to { transform: rotate(360deg) } }';
      document.head.appendChild(style);
    } else {
      const text = document.getElementById('aiLoadingText');
      if (text) text.textContent = message;
      overlay.style.display = 'flex';
    }
  }

  function hideLoading() {
    const overlay = document.getElementById('aiLoadingOverlay');
    if (overlay) overlay.style.display = 'none';
  }

  btn.onclick = async () => {
    const prompt = input.value.trim();
    if (!prompt) return;

    btn.disabled = true;
    showLoading();

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const room = urlParams.get('room');
      if (!room) {
        showNotification('No project room specified', 'info');
        return;
      }

      const endpoint = `${current_endpoint}/api/projects/${room}/ai_prompt_commit/`;
      const resp = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt, content: editor ? editor.innerText || editor.innerHTML : '' })
      });

      let data = {};
      try {
        data = await resp.json();
      } catch (err) {
        const txt = await resp.text().catch(() => '');
        console.error('AI prompt commit non-JSON response', resp.status, txt);
        if (resp.status === 404 && txt.includes('Project')) {
          showNotification('Project not found on server. Open or create the project first.', 'info');
          return;
        }
        showNotification('AI request failed', 'info');
        return;
      }
      if (!resp.ok) {
        console.error('AI prompt commit failed', resp.status, data);
        if (resp.status === 404 && data && data.error && data.error.includes('not found')) {
          showNotification('Project not found on server. Open or create the project first.', 'info');
          return;
        }
        showNotification('AI request failed', 'info');
        return;
      }

      // If server returned version metadata, add it locally to versions and make it current
      if (data && data.version) {
        // insert at front, dedupe by id
        const existing = (versions || []).find(v => v.id === data.version.id);
        if (!existing) versions = [data.version, ...(versions || [])];
        else {
          // replace existing with latest
          versions = [data.version, ...versions.filter(v => v.id !== data.version.id)];
        }
        currentVersionId = data.version.id;
        renderVersionHistory();
      }

      // ask server for authoritative versions list too
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'list_versions' }));

      showNotification('AI response added as a new commit', 'success');

      // Clear input only after successful generate per your request
      input.value = '';

    } catch (err) {
      console.error('AI prompt commit error', err);
      showNotification('AI request error', 'info');
    } finally {
      btn.disabled = false;
      hideLoading();
    }
  };

  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      btn.click();
    }
  });

  // Auto-send disabled: typing will no longer automatically POST to the AI endpoint.
  // Only the explicit "Generate" button will call the AI and create a commit.

  wrapper.appendChild(input);
  wrapper.appendChild(btn);
  document.body.appendChild(wrapper);
}

// Ensure the prompt is created after DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  ensureFloatingPrompt();
});

// Debounced send of edits
let editTimeout;
editor.addEventListener("input", () => {
  clearTimeout(editTimeout);
  editTimeout = setTimeout(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({ type: "edit", content: editor.innerHTML, clientId })
      );
    }
  }, 200);
});

// Parsing scheduler: keeps only the latest content and parses it on idle to avoid blocking the WS message handler.
let _scheduledContent = null;
let _parseTimeout = null;
function scheduleParseAndRender(content) {
  _scheduledContent = content;
  // If requestIdleCallback is available, use it; otherwise batch with setTimeout.
  if (typeof window.requestIdleCallback === 'function') {
    try {
      window.requestIdleCallback(() => {
        const c = _scheduledContent;
        _scheduledContent = null;
        _doParseAndRender(c);
      }, { timeout: 200 });
      return;
    } catch (e) {
      // fall through to setTimeout fallback
    }
  }
  clearTimeout(_parseTimeout);
  _parseTimeout = setTimeout(() => {
    const c = _scheduledContent;
    _scheduledContent = null;
    _doParseAndRender(c);
  }, 50);
}

function _doParseAndRender(raw) {
  if (raw == null) return;
  let content = raw;
  if (typeof marked !== 'undefined') {
    // Unwrap fenced block if present
    const fencedBlock = /^\s*```[a-zA-Z0-9_-]*\n([\s\S]*?)\n```\s*$/.exec(content);
    if (fencedBlock) content = fencedBlock[1];

    try {
      marked.setOptions({ breaks: true, gfm: true, headerIds: true, mangle: false });
      content = marked.parse(content);
    } catch (e) {
      console.warn('Markdown parse failed, falling back to plain text', e);
      content = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
    }
  } else {
    content = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  }

  // Update DOM
  if (editor.innerHTML !== content) editor.innerHTML = content;

  // Highlight on next tick to avoid blocking
  setTimeout(() => {
    if (typeof hljs !== 'undefined') {
      document.querySelectorAll('pre code').forEach((block) => { try { hljs.highlightElement(block); } catch (e) {} });
    }
  }, 30);
}

// Save button
if (saveBtn) {
  saveBtn.addEventListener("click", () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    saveStatus.textContent = "Saving...";
    saveStatus.style.color = "#6b7280";
    ws.send(
      JSON.stringify({ type: "save", content: editor.innerHTML, clientId })
    );
  });
}

// Download PDF button wiring
const downloadPdfBtn = document.getElementById('downloadPdfBtn');
if (downloadPdfBtn) {
  downloadPdfBtn.addEventListener('click', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const room = urlParams.get('room');
    if (!room) {
      alert('No project room specified');
      return;
    }

    try {
      // Call Django backend directly 
      const resp = await fetch(`${current_endpoint}/api/projects/${room}/download_pdf/`, {
        credentials: 'include'
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        alert('PDF generation failed: ' + (err.error || resp.statusText));
        return;
      }

      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `project_${room}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download PDF error', err);
      alert('Failed to download PDF');
    }
  });
}

// ---------------- Chat wiring (show username + message) ----------------
// Renders a single chat message into the chat area.
function renderChatMessage({ username = 'User', text = '', timestamp = null, isMe = false } = {}) {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  const msgEl = document.createElement('div');
  msgEl.className = 'chat-message' + (isMe ? ' me' : ' other');

  const avatar = document.createElement('div');
  avatar.className = 'chat-avatar';
  avatar.textContent = (username || 'U').charAt(0).toUpperCase();

  const body = document.createElement('div');
  body.className = 'chat-body';

  const nameEl = document.createElement('div');
  nameEl.className = 'chat-username';
  nameEl.textContent = username + (isMe ? ' (you)' : '');

  const textEl = document.createElement('div');
  textEl.className = 'chat-text';
  textEl.innerHTML = escapeHtml(text).replace(/\n/g, '<br>');

  body.appendChild(nameEl);
  body.appendChild(textEl);

  msgEl.appendChild(avatar);
  msgEl.appendChild(body);

  container.appendChild(msgEl);
  // auto-scroll to bottom
  container.scrollTop = container.scrollHeight;
}

// Ensure there's a display name for the current user. If ws provided one, it'll be used; otherwise prompt once and persist to localStorage.
function ensureDisplayName() {
  if (currentUser && currentUser.username) return currentUser.username;
  let stored = window.localStorage.getItem('codora_display_name') || '';
  if (!stored) {
    stored = (window.prompt('Enter display name for chat (this will be saved locally):', 'You') || 'You').trim();
    try { window.localStorage.setItem('codora_display_name', stored); } catch(e){}
  }
  currentUser = currentUser || {};
  currentUser.username = stored;
  return stored;
}

// Send chat message from input
function sendChatMessage() {
  const input = document.getElementById('chatInput');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  const username = ensureDisplayName();

  // render locally as "me"
  renderChatMessage({ username, text, timestamp: new Date().toISOString(), isMe: true });
  console.log('[CHAT SEND] room=', room, 'username=', username, 'message=', text);
  input.value = '';

  // Send to server if connected (non-breaking if server doesn't handle it)
  try {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'chat', username, message: text, timestamp: new Date().toISOString() }));
    } else {
      console.warn('[CHAT SEND] ws not open readyState=', ws ? ws.readyState : 'no-ws');
    }
  } catch (e) {
    console.warn('Failed to send chat over WS', e);
  }
}

// Attach handlers to chat input and button
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');
if (chatSendBtn && chatInput) {
  chatSendBtn.addEventListener('click', (e) => { e.preventDefault(); sendChatMessage(); });
  chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); sendChatMessage(); } });
}

// Chat is handled in the central ws.onmessage handler above; no additional
// message event listeners or polling are attached to avoid duplicate renders.

