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

const initialContent = `// Welcome to AI Document Editor
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
