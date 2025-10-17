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
});
const editor = document.getElementById('editor');
const saveBtn = document.getElementById('saveBtn');
const saveStatus = document.getElementById('saveStatus');
const connStatus = document.getElementById('connStatus');

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
          editor.value = content;
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
            editor.value = content;
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
if (editor) {
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
  // Very small simulation: echo back first 1000 chars and pretend it's output
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
