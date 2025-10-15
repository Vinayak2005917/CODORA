// ---------------- Timeline (Version History) ----------------
let versions = [
  {
    id: 7,
    message: "Add the conclusion section...",
    time: "3:30 A.M",
    user: "User 1",
  },
  {
    id: 6,
    message: "Add the conclusion section...",
    time: "3:30 A.M",
    user: "User 1",
  },
  {
    id: 5,
    message: "Add the conclusion section...",
    time: "3:30 A.M",
    user: "User 1",
  },
  {
    id: 4,
    message: "Add the conclusion section...",
    time: "3:30 A.M",
    user: "User 1",
  },
  {
    id: 3,
    message: "Add the conclusion section...",
    time: "3:30 A.M",
    user: "User 1",
  },
  {
    id: 2,
    message: "Add the conclusion section...",
    time: "3:30 A.M",
    user: "User 1",
  },
  { id: 1, message: "Initial commit", time: "3:00 A.M", user: "User 1" },
];

// Render timeline dynamically
function renderVersionHistory() {
  const container = document.getElementById("versionHistory");
  if (!container) return;

  container.innerHTML = versions
    .map(
      (v) => `
    <div class="timeline-item">
      <div class="timeline-dot"></div>
      <div class="timeline-content">
        <div class="timeline-title">${v.message}</div>
        <div class="timeline-meta">${v.time}</div>
        <div class="timeline-meta">by ${v.user}</div>
      </div>
    </div>
  `
    )
    .join("");
}

// Add commit to version history
function addCommit() {
  const input = document.getElementById("commitMessage");
  const message = input.value.trim();
  if (!message) return;

  const now = new Date();
  const newVersion = {
    id: versions[0].id + 1,
    message,
    time: now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }),
    user: "User 1",
  };
  versions.unshift(newVersion);
  renderVersionHistory();

  // Smooth fade animation
  const firstItem = document.querySelector(".timeline-item");
  if (firstItem) {
    firstItem.style.opacity = "0";
    firstItem.style.transform = "translateX(-20px)";
    setTimeout(() => {
      firstItem.style.transition = "all 0.3s ease";
      firstItem.style.opacity = "1";
      firstItem.style.transform = "translateX(0)";
    }, 10);
  }

  input.value = "";
}

// Commit button + Enter key
window.addEventListener("DOMContentLoaded", () => {
  renderVersionHistory();
  document.querySelector(".commit-btn").addEventListener("click", addCommit);
  document.getElementById("commitMessage").addEventListener("keypress", (e) => {
    if (e.key === "Enter") addCommit();
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

// Build WebSocket URL with room parameter
const wsUrl = room === 'default' 
  ? "ws://127.0.0.1:8000/ws/editor/"
  : `ws://127.0.0.1:8000/ws/editor/${room}/`;

console.log('Connecting to room:', room, 'via', wsUrl);

const clientId =
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
let ws;

function connect() {
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    if (connStatus) {
      connStatus.textContent = "🟢Connected";
      connStatus.style.color = "#16a34a";
      connStatus.style.fontWeight = "700";
      connStatus.style.fontSize = "22px";
    }
    // On connect, server will send latest content automatically
  };

  ws.onclose = () => {
    if (connStatus) {
      connStatus.textContent = "⛔Disconnected";
      connStatus.style.color = "#dc2626";
      connStatus.style.fontWeight = "700";
      connStatus.style.fontSize = "22px";
    }
    // Optional: reconnect after delay
    setTimeout(connect, 1500);
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "edit") {
        let content = String(data.content ?? "");

        // If server sent full HTML (starts with <html or <div etc.), just drop it in.
        const looksHtml = /^\s*<[^>]+>/.test(content);

        if (!looksHtml && typeof marked !== "undefined") {
          // Unwrap top-level fenced code blocks if the whole payload is fenced
          // ```lang\n...\n```
          const fencedBlock = /^\s*```[a-zA-Z0-9_-]*\n([\s\S]*?)\n```\s*$/.exec(content);
          if (fencedBlock) {
            content = fencedBlock[1];
          }

          // Configure marked once
          marked.setOptions({
            breaks: true,
            gfm: true,
            headerIds: true,
            mangle: false
          });

          try {
            content = marked.parse(content);
          } catch (e) {
            console.warn("Markdown parse failed, falling back to plain text", e);
            content = content
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/\n/g, "<br>");
          }

          // Syntax highlight after DOM update
          setTimeout(() => {
            if (typeof hljs !== "undefined") {
              document.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
              });
            }
          }, 50);
        }

        // Update editor HTML only if changed
        if (editor.innerHTML !== content) editor.innerHTML = content;
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

  btn.onclick = async () => {
    const prompt = input.value.trim();
    if (!prompt) return;

    btn.disabled = true;
    btn.textContent = 'Generating...';

    try {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert('Not connected to server yet. Please wait.');
        return;
      }

      ws.send(JSON.stringify({ type: 'prompt', prompt, clientId }));
      // Optionally clear input or keep it
      input.value = '';
      showNotification('Prompt sent — AI generating...', 'success');
    } catch (err) {
      console.error('Failed to send prompt:', err);
      showNotification('Failed to send prompt', 'info');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Generate';
    }
  };

  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') btn.click();
  });

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
      // Call Django backend directly (default dev server at 127.0.0.1:8000)
      const resp = await fetch(`http://127.0.0.1:8000/api/projects/${room}/download_pdf/`, {
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
