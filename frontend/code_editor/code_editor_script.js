document
// --- Version history and prompt features from doc_editor ---
let versions = [];
let currentUser = null;
let currentVersionId = null;

function escapeHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

const local_endpoint = 'http://127.0.0.1:8000';
const production_endpoint = 'https://codora-vk5z.onrender.com';
const current_endpoint = production_endpoint;

async function renderVersionHistory() {
  const container = document.getElementById("versionHistory");
  if (!container) {
    console.log('renderVersionHistory: container not found');
    return;
  }
  try {
    console.log('renderVersionHistory: starting, ws exists:', !!ws, 'readyState:', ws ? ws.readyState : 'no ws');
    container.innerHTML = '<div style="padding:16px;color:#6b7280">Loading versions…</div>';
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log('renderVersionHistory: WebSocket is open, sending list_versions');
      ws.send(JSON.stringify({ type: 'list_versions' }));
    } else {
      console.log('renderVersionHistory: WebSocket not open, showing not connected');
      container.innerHTML = '<div style="padding:16px;color:#6b7280">Not connected</div>';
    }
  } catch (e) {
    console.error('renderVersionHistory: Failed to request versions', e);
    container.innerHTML = '<div style="padding:16px;color:#6b7280">Failed to fetch versions</div>';
  }
}

async function addCommit() {
  const input = document.getElementById("commitMessage");
  const message = input.value.trim();
  if (!message) return;
  try {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      alert('Not connected to server yet');
      return;
    }
    ws.send(JSON.stringify({ type: 'commit', message, content: editor ? editor.value : '' }));
    input.value = '';
  } catch (e) {
    console.error('Commit error', e);
    alert('Commit failed');
  }
}

window.addEventListener("DOMContentLoaded", () => {
  console.log('DOMContentLoaded: Initializing version history');
  renderVersionHistory();
  const commitBtn = document.querySelector(".commit-btn");
  if (commitBtn) commitBtn.addEventListener("click", addCommit);
  const commitInput = document.getElementById("commitMessage");
  if (commitInput) commitInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      addCommit();
    }
  });
});

// Floating prompt (bottom)
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

      const endpoint = `https://codora-vk5z.onrender.com/api/projects/${room}/ai_prompt_commit/`;
      const resp = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt, content: editor ? editor.value : '' })
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

      if (data && data.version) {
        const existing = (versions || []).find(v => v.id === data.version.id);
        if (!existing) versions = [data.version, ...(versions || [])];
        else {
          versions = [data.version, ...versions.filter(v => v.id !== data.version.id)];
        }
        currentVersionId = data.version.id;
        renderVersionHistory();
      }

      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'list_versions' }));

      showNotification('AI response added as a new commit', 'success');
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

  wrapper.appendChild(input);
  wrapper.appendChild(btn);
  document.body.appendChild(wrapper);
}

window.addEventListener('DOMContentLoaded', () => {
  ensureFloatingPrompt();
  // initialize highlight and line numbers
  try { updateHighlight(); } catch (e) { }
});
// --- Pyodide setup ---
// Load pyodide in the background; will enable running Python in the browser.
window.pyodide = null;
window.pyodideReady = false;

async function loadPyodideRuntime() {
  try {
    // load the script dynamically to avoid blocking page load
    if (!window.loadPyodide) {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
      s.onload = () => console.log('pyodide script loaded');
      document.head.appendChild(s);
      // wait until loadPyodide is available
      let attempts = 0;
      while (typeof window.loadPyodide !== 'function' && attempts < 50) {
        // small delay
        // eslint-disable-next-line no-await-in-loop
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }
    }
    if (typeof window.loadPyodide === 'function') {
      window.pyodide = await window.loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/' });
      window.pyodideReady = true;
      console.log('Pyodide ready');
    } else {
      console.warn('Pyodide failed to load');
    }
  } catch (e) {
    console.error('Failed to initialize pyodide', e);
  }
}

// Start loading in background
loadPyodideRuntime();
const editor = document.getElementById('editor');
const saveBtn = document.getElementById('saveBtn');
const saveStatus = document.getElementById('saveStatus');
const connStatus = document.getElementById('connStatus');

// Highlighting and helpers
const highlighted = document.querySelector('#highlightedCode code');
const codeBlock = document.getElementById('highlightedCode');
const lineNumbersEl = document.getElementById('lineNumbers');

function updateLineNumbers() {
  if (!lineNumbersEl || !editor) return;
  const lines = (editor.value || '').split('\n').length || 1;
  let numbers = '';
  for (let i = 1; i <= lines; i++) numbers += i + '\n';
  lineNumbersEl.textContent = numbers;
  // sync scroll
  try { lineNumbersEl.scrollTop = editor.scrollTop; } catch (e) {}
}

function updateHighlight() {
  if (!editor || !highlighted || !codeBlock) return;
  // Escape HTML entities
  const escaped = (editor.value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  highlighted.innerHTML = escaped;
  try { Prism.highlightElement(highlighted); } catch (e) { /* Prism may not be loaded yet */ }

  // Sync scroll
  codeBlock.scrollTop = editor.scrollTop;
  codeBlock.scrollLeft = editor.scrollLeft;
  // also sync line numbers
  updateLineNumbers();
}

function setEditorContent(val) {
  if (!editor) return;
  editor.value = val;
  updateHighlight();
}

// Sync scrolling
if (editor) {
  editor.addEventListener('scroll', () => {
    if (codeBlock) {
      codeBlock.scrollTop = editor.scrollTop;
      codeBlock.scrollLeft = editor.scrollLeft;
    }
    if (lineNumbersEl) lineNumbersEl.scrollTop = editor.scrollTop;
  });

  // also update highlight on input (we keep existing debounce for edits later)
  editor.addEventListener('input', () => {
    updateHighlight();
  });
}

// Language selector hookup
const languageSelect = document.querySelector('.language-select');
if (languageSelect) {
  languageSelect.addEventListener('change', () => {
    const lang = languageSelect.value.toLowerCase();
    const pre = document.getElementById('highlightedCode');
    if (pre) pre.className = `language-${lang}`;
    // Try to load Prism language component for JS dynamically if needed
    if (lang === 'javascript' && typeof Prism !== 'undefined' && !Prism.languages.javascript) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-javascript.min.js';
      script.onload = () => updateHighlight();
      document.head.appendChild(script);
    } else {
      updateHighlight();
    }
  });
}

// Parse room number from URL
const urlParams = new URLSearchParams(window.location.search);
const room = urlParams.get('room') || 'default';

// Update project title/input
const projectNameInput = document.getElementById('projectName');
if (projectNameInput && room !== 'default') {
  projectNameInput.value = `Code Room: ${room}`;
}

// Build WebSocket URL
const wsUrl = room === 'default'
  ? `${current_endpoint}/ws/editor/`
  : `${current_endpoint}/ws/editor/${room}/`;

console.log('Connecting to code room:', room, 'via', wsUrl);

const clientId =
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
let ws;

function connectWS() {
  console.log('connectWS: Attempting to connect to', wsUrl);
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('WebSocket: Connection opened');
    if (connStatus) {
      connStatus.textContent = "🟢Connected";
      connStatus.style.color = "#16a34a";
    }
    // Try to load versions now that we're connected
    console.log('WebSocket: Connection opened, calling renderVersionHistory');
    renderVersionHistory();
  };

  ws.onclose = () => {
    console.log('WebSocket: Connection closed');
    if (connStatus) {
      connStatus.textContent = "⛔Disconnected";
      connStatus.style.color = "#dc2626";
    }
    setTimeout(connectWS, 1500);
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('WebSocket: Received message type:', data.type, data);
      if (data.type === "edit") {
        let content = data.content || "";
        // Unwrap code blocks: replace each ```...``` with the inner code, preserving any text before/after
        const codeBlockRegex = /```[\w]*\n?([\s\S]*?)\n?```/g;
        try {
          content = content.replace(codeBlockRegex, (m, inner) => (inner || '').trim());
        } catch (e) {
          console.warn('Failed to unwrap code blocks for edit message', e);
        }
        if (editor.value !== content) {
          setEditorContent(content);
        }
      }
      if (data.type === "saved") {
        if (saveStatus) {
          if (data.ok) {
            saveStatus.textContent = `Saved!`;
            saveStatus.style.color = "#16a34a";
          } else {
            saveStatus.textContent = `Save error`;
            saveStatus.style.color = "#dc2626";
          }
          setTimeout(() => {
            saveStatus.textContent = "";
          }, 2000);
        }
      }
      if (data.type === "users_list" || data.type === "user_joined" || data.type === "user_left") {
        updateCollaboratorsList(data.users);
        
        if (data.type === "user_joined") {
          showNotification(`${data.user.username} joined`, "success");
        } else if (data.type === "user_left") {
          showNotification(`${data.user.username} left`, "info");
        }
      }
      if (data.type === 'versions_list') {
        console.log('WebSocket: Received versions_list', data);
        // Received versions list from server, render into version history
        const container = document.getElementById('versionHistory');
        const list = data.versions || [];
        console.log('WebSocket: versions_list contains', list.length, 'versions');
        // Normalize and sort versions newest-first by timestamp
        versions = (list || []).slice().sort((a,b) => {
          try { return new Date(b.timestamp) - new Date(a.timestamp); } catch(e) { return 0; }
        });
        // If no version selected yet, default to the most recent (first) version
        const wasVersionSelected = !!currentVersionId;
        if (!currentVersionId && versions.length > 0) currentVersionId = versions[0].id;
        
        // If this is the first time loading versions and we have versions, auto-load the most recent one
        if (!wasVersionSelected && versions.length > 0 && ws && ws.readyState === WebSocket.OPEN) {
          console.log('Auto-loading most recent version:', currentVersionId);
          ws.send(JSON.stringify({ type: 'get_version', version_id: currentVersionId }));
        }
        if (!container) return;
        container.innerHTML = versions.length === 0 
          ? '<div style="padding:16px;color:#6b7280;text-align:center;">No versions yet</div>'
          : versions.map((v) => {
              // format time safely (assume UTC timestamps)
              let ts = '';
              try { ts = new Date(v.timestamp).toLocaleString(); } catch(e) { ts = v.timestamp; }
              const authorLabel = (currentUser && v.author === currentUser.username) ? `${escapeHtml(v.author)} (you)` : escapeHtml(v.author || 'User');
              const isCurrent = currentVersionId === v.id;
              return `
              <div class="timeline-item ${isCurrent ? 'selected' : ''}" data-version-id="${v.id}" onclick="loadVersion('${v.id}')" style="position:relative;">
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
              `;
            }).join('');

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
      if (data.type === 'version_data') {
        if (data.version && data.version.content) {
          // Unwrap code blocks: replace all ```...``` with the inner content while keeping text before/after
          let content = data.version.content;
          const codeBlockRegex = /```[\w]*\n?([\s\S]*?)\n?```/g;
          try {
            content = content.replace(codeBlockRegex, (m, inner) => (inner || '').trim());
          } catch (e) {
            console.warn('Failed to unwrap code blocks for version_data', e);
          }
          // Load the extracted content into the editor
          if (editor) {
            setEditorContent(content);
          }
        } else if (data.error) {
          alert('Version not found');
        }
      }
      if (data.type === 'version_committed') {
        // Handle successful commit
        if (data.version) {
          showNotification('Version saved', 'success');
          currentVersionId = data.version.id;
          // Refresh versions list
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'list_versions' }));
          }
        } else {
          showNotification('Failed to save version', 'error');
        }
      }
      if (data.type === 'version_deleted') {
        if (data.ok && data.version_id) {
          showNotification('Version deleted', 'success');
          // If the deleted version was current, reset to latest
          if (currentVersionId === data.version_id) {
            currentVersionId = versions.length > 0 ? versions[0].id : null;
          }
          // Refresh versions list
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'list_versions' }));
          }
        } else {
          showNotification('Failed to delete version', 'error');
        }
      }
    } catch (e) {
      console.warn("WS message parse error", e);
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

connectWS();
console.log('connectWS: Initial connection attempt made');

// Debounced send of edits
let editTimeout;
if (editor && !editor.readOnly) {
  editor.addEventListener("input", () => {
    clearTimeout(editTimeout);
    editTimeout = setTimeout(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({ type: "edit", content: editor.value, clientId })
        );
      }
    }, 300);
  });
} else {
  // Editor is read-only; do not attach live edit sender
  console.log('Editor is read-only; live edits are disabled');
}

// Save button
if (saveBtn) {
  saveBtn.addEventListener("click", () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (saveStatus) {
      saveStatus.textContent = "Saving...";
      saveStatus.style.color = "#6b7280";
    }
    ws.send(
      JSON.stringify({ type: "save", content: editor.value, clientId })
    );
  });
}

// --- Run button behavior ---

function loadVersion(versionId) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert('Not connected to server');
        return;
    }
    ws.send(JSON.stringify({ type: 'get_version', version_id: versionId }));
    // optimistic highlight
    currentVersionId = versionId;
    // re-render highlight
    renderVersionHistory();
}

// --- Editable Block Context Menu ---
let blockMenu = null;
function showBlockMenu(x, y, line) {
  hideBlockMenu();
  blockMenu = document.createElement('div');
  blockMenu.className = 'block-menu';
  blockMenu.style.cssText = `position:fixed;left:${x}px;top:${y}px;z-index:10001;background:#fff;border:1px solid #3b82f6;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.12);padding:10px 18px;`;
  blockMenu.innerHTML = `<button id="createBlockBtn" style="background:#3b82f6;color:white;border:none;padding:8px 16px;border-radius:6px;font-weight:600;cursor:pointer;">Create Editable Block Here (Line ${line})</button>`;
  document.body.appendChild(blockMenu);
  document.getElementById('createBlockBtn').onclick = function() {
    hideBlockMenu();
    // Next step: insert editable block after this line
    window.insertEditableBlockAfterLine(line);
  };
}

function hideBlockMenu() {
  if (blockMenu) {
    blockMenu.remove();
    blockMenu = null;
  }
}

// Attach right-click handler to code area
window.addEventListener('DOMContentLoaded', () => {
  const codeArea = document.querySelector('.code-area');
  if (codeArea) {
    codeArea.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      // Find line number from click position
      const editorEl = document.getElementById('editor');
      if (!editorEl) return;
      const rect = editorEl.getBoundingClientRect();
      const relY = e.clientY - rect.top;
      const lineHeight = 24; // matches CSS line-height
      let line = Math.floor(relY / lineHeight) + 1;
      // Clamp to valid line range
      const totalLines = (editorEl.value || '').split('\n').length;
      if (line < 1) line = 1;
      if (line > totalLines) line = totalLines;
      showBlockMenu(e.clientX, e.clientY, line);
    });
  }
  // Hide menu on click elsewhere
  document.addEventListener('click', function(e) {
    if (blockMenu && !blockMenu.contains(e.target)) hideBlockMenu();
  });
});

// Placeholder for block insertion logic
window.insertEditableBlockAfterLine = function(line) {
  alert('Insert editable block after line ' + line + ' (next step)');
};

// --- Hovered line highlighting ---
let hoverLineEl = null;
let _lastMouseClientY = null;
let _lastMouseClientX = null;
function ensureHoverLine() {
  if (hoverLineEl) return hoverLineEl;
  const codeArea = document.querySelector('.code-area');
  if (!codeArea) return null;
  hoverLineEl = document.createElement('div');
  hoverLineEl.className = 'hover-line hidden';
  // Append as child of code-area so positioning is relative to it
  codeArea.appendChild(hoverLineEl);
  return hoverLineEl;
}

function updateHoverFromEvent(evt) {
  const editorEl = document.getElementById('editor');
  const codeBlockEl = document.getElementById('highlightedCode');
  if (!editorEl) return;
  const el = ensureHoverLine();
  if (!el) return;
  const rect = editorEl.getBoundingClientRect();
  // Save last mouse position for scroll-time updates
  if (evt && typeof evt.clientY === 'number') _lastMouseClientY = evt.clientY;
  if (evt && typeof evt.clientX === 'number') _lastMouseClientX = evt.clientX;
  if (_lastMouseClientY === null) return;
  let relY = _lastMouseClientY - rect.top;
  // account for padding top (16px)
  const paddingTop = 16;
  const lineHeight = 24;
  // If mouse is outside the editor vertical bounds, hide
  if (relY < paddingTop || relY > rect.height - 8) {
    el.classList.add('hidden');
    return;
  }
  // snap the top to the line grid relative to the editor's visible area
  const row = Math.floor((relY - paddingTop) / lineHeight);
  const totalLines = (editorEl.value || '').split('\n').length;
  let lineIndex = row + 1;
  if (lineIndex < 1) lineIndex = 1;
  if (lineIndex > totalLines) {
    el.classList.add('hidden');
    return;
  }
  const top = paddingTop + row * lineHeight;
  el.style.top = top + 'px';
  el.style.height = lineHeight + 'px';
  el.classList.remove('hidden');
}

function hideHoverLine() {
  if (!hoverLineEl) return;
  hoverLineEl.classList.add('hidden');
}

function initHoverListeners() {
  const editorEl = document.getElementById('editor');
  const codeBlockEl = document.getElementById('highlightedCode');
  if (!editorEl) return;
  ensureHoverLine();
  // mouse move inside editor
  editorEl.addEventListener('mousemove', (e) => updateHoverFromEvent(e));
  editorEl.addEventListener('mouseleave', (e) => { _lastMouseClientY = null; hideHoverLine(); });
  // also listen on highlighted code (so hovering over highlighted areas works)
  if (codeBlockEl) {
    codeBlockEl.addEventListener('mousemove', (e) => updateHoverFromEvent(e));
    codeBlockEl.addEventListener('mouseleave', (e) => { _lastMouseClientY = null; hideHoverLine(); });
  }
  // update overlay position when scrolling
  editorEl.addEventListener('scroll', () => {
    // If we have a last mouse position, recompute the hover position so it stays aligned
    if (_lastMouseClientY !== null) {
      updateHoverFromEvent({ clientY: _lastMouseClientY });
    }
  });
}

// initialize hover listeners after DOM load
window.addEventListener('DOMContentLoaded', () => {
  initHoverListeners();
});

function showRunOutput(outputText) {
  let panel = document.getElementById('runOutputPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'runOutputPanel';
    panel.className = 'run-output';
    panel.innerHTML = `
      <div class="run-header">
        <div>Run Output</div>
        <button class="close-run" id="closeRunBtn">Close</button>
      </div>
      <pre id="runOutputPre"></pre>
    `;
    document.body.appendChild(panel);
    document.getElementById('closeRunBtn').addEventListener('click', () => panel.remove());
  }
  const pre = document.getElementById('runOutputPre');
  if (pre) pre.textContent = outputText;
  panel.style.display = 'block';
}

function runCodeSimulation() {
  const code = editor ? editor.value : '';
  // If Pyodide is available, run using it; otherwise fall back to simulation
  if (window.pyodideReady && window.pyodide) {
    (async () => {
      try {
        showRunOutput('Running...');
        // Safely embed user code as a JS-escaped string and exec() it in Python.
        // Provide a simple browser-backed input() using js.prompt so scripts
        // that call input() work in the browser.
        const code_js = JSON.stringify(code || "");
        const wrapper = `import sys, io, contextlib, traceback, builtins, js\n_code = ${code_js}\n_buf = io.StringIO()\n# Provide input() via browser prompt\ndef _input(prompt=''):\n    res = js.prompt(prompt)\n    if res is None:\n        raise EOFError('input cancelled')\n    return res\nbuiltins.input = _input\ntry:\n    with contextlib.redirect_stdout(_buf):\n        exec(_code, {})\nexcept Exception:\n    _buf.write(traceback.format_exc())\n_out = _buf.getvalue()`;

        const result = await window.pyodide.runPythonAsync(wrapper + '\n_out');
        const text = (result === undefined || result === null) ? '' : String(result);
        showRunOutput(text);
      } catch (err) {
        try {
          showRunOutput(String(err));
        } catch (e) {
          showRunOutput('Error running Python: ' + String(err));
        }
      }
    })();
    return;
  }

  // Fallback: simple simulation when pyodide isn't ready
  const snippet = code ? code.substring(0, 1000) : '<no code to run>';
  const now = new Date().toLocaleTimeString();
  const output = `=== Run at ${now} ===\n\n${snippet}\n\n=== End ===`;
  showRunOutput(output);
}

// Attach run button + keyboard shortcut
window.addEventListener('DOMContentLoaded', () => {
  const runBtn = document.getElementById('runButton');
  if (runBtn) runBtn.addEventListener('click', runCodeSimulation);

  // Ctrl+Enter to run
  if (editor) {
    editor.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        runCodeSimulation();
      }
    });
  }
});
