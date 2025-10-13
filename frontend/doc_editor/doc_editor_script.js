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

// Use deployed backend on Render
const wsUrl = "wss://codora-vk5z.onrender.com/ws/editor/";

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
        // Update contenteditable only if content changed to avoid flicker
        if (editor.innerHTML !== data.content) {
          editor.innerHTML = data.content;
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
    } catch (e) {
      console.warn("WS message parse error", e);
    }
  };
}

connect();

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
