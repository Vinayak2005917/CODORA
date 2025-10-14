// mockup commit data
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

const collaborators = [
  { id: 1, name: "User 1 (You)", color: "#3b82f6", emoji: "👤", online: true },
  { id: 2, name: "User 2's Name", color: "#f97316", emoji: "👤", online: true },
  { id: 3, name: "User 3's Name", color: "#10b981", emoji: "👤", online: true },
  { id: 4, name: "AI", color: "#2563eb", emoji: "🤖", online: true },
];

const initialContent = `// Welcome to Codora's AI Document Editor
// Start by entering a prompt to generate content

function example() {
  console.log("Your AI-generated content will appear here");
}`;

// initialization
document.getElementById("editor").value = initialContent;
updateLineNumbers();
renderVersionHistory();
renderCollaborators();

// editor functionality
document.getElementById("editor").addEventListener("input", updateLineNumbers);
document.getElementById("editor").addEventListener("scroll", function () {
  document.getElementById("lineNumbers").scrollTop = this.scrollTop;
});

document
  .getElementById("promptInput")
  .addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      generateContent();
    }
  });

function updateLineNumbers() {
  const editor = document.getElementById("editor");
  const lineNumbers = document.getElementById("lineNumbers");
  const lines = editor.value.split("\n").length;
  lineNumbers.innerHTML = Array.from({ length: lines }, (_, i) => i + 1).join(
    "\n"
  );
}

function renderVersionHistory() {
  const container = document.getElementById("versionHistory");
  container.innerHTML = versions
    .map(
      (v) => `
        <div class="version-item">
            <div class="version-dot"><div class="version-dot-inner"></div></div>
            <div class="version-info">
                <div class="version-message">${v.message}</div>
                <div class="version-meta">${v.time}</div>
                <div class="version-meta">by ${v.user}</div>
            </div>
        </div>
    `
    )
    .join("");
}

function renderCollaborators() {
  const container = document.getElementById("collaboratorsList");
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

function togglePromptPanel() {
  const section = document.getElementById("aiPromptSection");
  const btn = document.getElementById("showPromptBtn");

  if (section.classList.contains("hidden")) {
    section.classList.remove("hidden");
    btn.classList.add("hidden");
  } else {
    section.classList.add("hidden");
    btn.classList.remove("hidden");
  }
}

function generateContent() {
  const prompt = document.getElementById("promptInput").value.trim();
  if (!prompt) return;

  const btn = document.getElementById("generateBtn");
  const text = document.getElementById("generateText");

  // disable button and show loading
  btn.disabled = true;
  text.textContent = "Generating...";

  // simulate AI generation
  setTimeout(() => {
    const editor = document.getElementById("editor");
    const newContent = `// Generated content based on: "${prompt}"\n\n${editor.value}`;
    editor.value = newContent;
    updateLineNumbers();

    // add to version history
    const now = new Date();
    const newVersion = {
      id: versions[0].id + 1,
      message: `Generated: ${prompt.substring(0, 30)}${
        prompt.length > 30 ? "..." : ""
      }`,
      time: now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
      user: "AI",
    };
    versions.unshift(newVersion);
    renderVersionHistory();

    // reset button
    btn.disabled = false;
    text.textContent = "Generate";
    document.getElementById("promptInput").value = "";
  }, 2000);
}

function addCommit() {
  const message = document.getElementById("commitMessage").value.trim();
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
  document.getElementById("commitMessage").value = "";
}

// --- WebSocket collaborative editing ---
const editor = document.getElementById('codeEditor');
const saveBtn = document.getElementById('saveBtn');
const saveStatus = document.getElementById('saveStatus');
const connStatus = document.getElementById('connStatus');

// Parse room number from URL
const urlParams = new URLSearchParams(window.location.search);
const room = urlParams.get('room') || 'default';

// Update project title
const projectTitle = document.querySelector('.project-title');
if (projectTitle && room !== 'default') {
  projectTitle.textContent = `Code Room: ${room}`;
}

// Build WebSocket URL
const wsUrl = room === 'default'
  ? "ws://127.0.0.1:8000/ws/editor/"
  : `ws://127.0.0.1:8000/ws/editor/${room}/`;

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
