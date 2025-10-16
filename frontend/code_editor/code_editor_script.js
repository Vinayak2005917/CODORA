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
  if (!container) return;
  try {
    container.innerHTML = '<div style="padding:16px;color:#6b7280">Loading versions…</div>';
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'list_versions' }));
    } else {
      container.innerHTML = '<div style="padding:16px;color:#6b7280">Not connected</div>';
    }
  } catch (e) {
    console.error('Failed to request versions', e);
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
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    if (connStatus) {
      connStatus.textContent = "🟢Connected";
      connStatus.style.color = "#16a34a";
    }
  };

  ws.onclose = () => {
    if (connStatus) {
      connStatus.textContent = "⛔Disconnected";
      connStatus.style.color = "#dc2626";
    }
    setTimeout(connectWS, 1500);
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "edit") {
        const content = data.content || "";
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
