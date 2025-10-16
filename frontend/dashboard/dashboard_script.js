// Check authentication on page load
let currentUser = null;
const local_endpoint = 'http://127.0.0.1:8000';
const production_endpoint = 'https://codora-vk5z.onrender.com';
const current_endpoint = production_endpoint;
async function checkAuth() {
    // Check if we recently authenticated (within last 2 seconds)
    const lastCheck = sessionStorage.getItem('last_auth_check');
    const now = Date.now();
    
    if (lastCheck && (now - parseInt(lastCheck)) < 2000) {
        console.log('Recently checked auth, using cached result');
        const cachedUser = sessionStorage.getItem('cached_user');
        if (cachedUser) {
            currentUser = JSON.parse(cachedUser);
            updateUserUI();
            return true;
        }
    }
    
    try {
        const response = await fetch(`${current_endpoint}/api/auth/me/`, {
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (!data.authenticated) {
            // Not logged in - create guest user
            console.log('Not authenticated, creating guest session');
            await createGuestSession();
            return true;
        }
        
        console.log('Authenticated as:', data.user.username);
        currentUser = data.user;
        
        // Cache the result
        sessionStorage.setItem('last_auth_check', Date.now().toString());
        sessionStorage.setItem('cached_user', JSON.stringify(data.user));
        
        updateUserUI();
        return true;
    } catch (error) {
        console.error('Auth check failed:', error);
        // Create guest session on error
        await createGuestSession();
        return true;
    }
}

async function createGuestSession() {
    try {
        const response = await fetch(`${current_endpoint}/api/auth/guest/`, {
            method: 'POST',
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.ok) {
            currentUser = data.user;
            sessionStorage.setItem('cached_user', JSON.stringify(data.user));
            sessionStorage.setItem('last_auth_check', Date.now().toString());
            updateUserUI();
        }
    } catch (error) {
        console.error('Failed to create guest session:', error);
    }
}

function updateUserUI() {
    const userAvatar = document.querySelector('.user-avatar');
    console.log('updateUserUI called, currentUser:', currentUser);
    console.log('userAvatar element:', userAvatar);
    
    if (userAvatar && currentUser) {
        const isGuest = currentUser.username.startsWith('Guest');
        console.log('Is guest user:', isGuest);
        
        if (isGuest) {
            // Guest user - show login button
            userAvatar.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 40px; height: 40px; border-radius: 50%; background: ${currentUser.avatarColor}; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 18px;">
                        ${currentUser.username.charAt(0).toUpperCase()}
                    </div>
                    <span style="font-weight: 800; color: black;">${currentUser.username}</span>
                    <button id="login-btn" style="padding: 6px 12px; background: #5eb3f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;">Login</button>
                </div>
            `;
            
            const loginBtn = document.getElementById('login-btn');
            if (loginBtn) {
                loginBtn.addEventListener('click', () => {
                    window.location.href = '../login_page/login.html';
                });
            }
        } else {
            // Registered user - show logout button
            userAvatar.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 40px; height: 40px; border-radius: 50%; background: ${currentUser.avatarColor}; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 18px;">
                        ${currentUser.username.charAt(0).toUpperCase()}
                    </div>
                    <span style="font-weight: 800; color: black;">${currentUser.username}</span>
                    <button id="logout-btn" style="padding: 6px 12px; background: #dc2626; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">Logout</button>
                </div>
            `;
            
            const logoutBtn = document.getElementById('logout-btn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', logout);
            }
        }
    } else {
        console.warn('Cannot update user UI: userAvatar or currentUser is null');
    }
}

async function logout() {
    try {
        await fetch(`${current_endpoint}/api/auth/logout/`, {
            method: 'POST',
            credentials: 'include'
        });
        
        localStorage.removeItem('user');
        window.location.href = '../login_page/login.html';
    } catch (error) {
        console.error('Logout error:', error);
    }
}


// Load projects from backend
async function loadProjects() {
    const grid = document.getElementById('projectsGrid');
    if (!grid) return;

    try {
        const response = await fetch(`${current_endpoint}/api/projects/list/`);
        
        if (!response.ok) {
            console.error('Failed to load projects');
            return;
        }
        
        const projects = await response.json();
        console.log('Loaded projects:', projects);
        
        renderProjects(projects);
    } catch (error) {
        console.error('Error loading projects:', error);
    }
}

// Render projects
function renderProjects(projects) {
    const grid = document.getElementById('projectsGrid');
    if (!grid) return;

    if (projects.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #6b7280;">
                <p style="font-size: 18px; margin-bottom: 10px;">No projects yet</p>
                <p>Enter a prompt above and select a type to create your first project!</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = projects.map(project => {
        const typeLabel = {
            'doc': '📄 Document',
            'code': '💻 Code',
            'lesson': '📚 Lesson'
        }[project.type] || project.type;
        
        const editorUrl = {
            'doc': '../doc_editor/doc_editor.html',
            'code': '../code_editor/code_editor.html',
            'lesson': '../lesson_planner/lesson_planner.html'
        }[project.type] || '../doc_editor/doc_editor.html';
        
        // Format date
        const date = new Date(project.updatedAt);
        const timeAgo = getTimeAgo(date);
        
        return `
            <div class="project-card" onclick="openProject('${project.room}', '${project.type}')">
                <div class="copy-icon" onclick="event.stopPropagation(); copyRoomNumber('${project.room}')" title="Copy room number">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                </div>
                <div class="project-preview ${project.type}">
                    <div style="font-size: 14px; color: #5eb3f6; margin-bottom: 8px; font-weight: 600;">${typeLabel}</div>
                    <div style="font-size: 12px; color: #999; margin-bottom: 8px;">Room: ${project.room}</div>
                    ${project.preview}
                </div>
                <div class="project-info">
                    <div class="project-title">${project.title}</div>
                    <div class="project-meta">last edited: ${timeAgo}</div>
                </div>
            </div>
        `;
    }).join('');
}

// Helper function to calculate time ago
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + ' years ago';
    
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + ' months ago';
    
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + ' days ago';
    
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + ' hours ago';
    
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + ' minutes ago';
    
    return 'just now';
}

// Open project by room number
function openProject(room, type) {
    console.log('Opening project:', room, type);
    
    const editorUrl = {
        'doc': '../doc_editor/doc_editor.html',
        'code': '../code_editor/code_editor.html',
        'lesson': '../lesson_planner/lesson_planner.html'
    }[type] || '../doc_editor/doc_editor.html';
    
    window.location.href = `${editorUrl}?room=${room}`;
}

// Fetch the latest project (most recently updated) from backend
async function fetchLatestProject() {
    try {
        const response = await fetch(`${current_endpoint}/api/projects/list/`);
        if (!response.ok) {
            throw new Error('Failed to fetch projects list');
        }

        const projects = await response.json();
        if (!Array.isArray(projects) || projects.length === 0) return null;

        // Sort by updatedAt descending and return the first
        projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        return projects[0];
    } catch (err) {
        console.error('fetchLatestProject error:', err);
        throw err;
    }
}

// Copy room number to clipboard
function copyRoomNumber(room) {
    navigator.clipboard.writeText(room).then(() => {
        alert(`Room number ${room} copied to clipboard!`);
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}

// Join project by room number
async function joinByRoom() {
    const roomInput = prompt('Enter a 6-digit room number:');
    
    if (!roomInput) return;
    
    const room = roomInput.trim();
    
    if (!/^\d{6}$/.test(room)) {
        alert('Please enter a valid 6-digit room number');
        return;
    }
    
    try {
        const response = await fetch(`${current_endpoint}/api/projects/${room}/`);
        
        if (!response.ok) {
            alert('Project not found. Please check the room number.');
            return;
        }
        
        const project = await response.json();
        console.log('Found project:', project);
        
        openProject(project.room, project.type);
        
    } catch (error) {
        console.error('Error joining room:', error);
        alert('Failed to join room. Please try again.');
    }
}

// We'll initialize interactive elements after DOMContentLoaded to avoid null-query errors
let selectedType = null;

function selectType(type) {
    selectedType = type;

    // Visual feedback - highlight selected button
    document.querySelectorAll('.btn-icon').forEach(btn => {
        btn.style.background = '';
        btn.style.border = '2px solid transparent';
    });

    const typeMap = {
        'doc': '.btn-document',
        'document': '.btn-document',
        'code': '.btn-code',
        'lesson': '.btn-content',
        'content': '.btn-content'
    };

    const selectedBtn = document.querySelector(typeMap[type]);
    if (selectedBtn) {
        selectedBtn.style.background = '#e0f2fe';
        selectedBtn.style.border = '2px solid #5eb3f6';
    }

    console.log('Selected type:', type);
}

// Function to send prompt to backend and create project
async function processPrompt() {
    const prompt = promptInput.value.trim();
    
    if (!prompt) {
        alert('Please enter a prompt!');
        return;
    }
    
    if (!selectedType) {
        alert('Please select a project type (Document, Code, or Lesson)!');
        return;
    }

    // Disable button and input, show loading state
    goButton.disabled = true;
    promptInput.disabled = true;
    goButton.textContent = '✨ Processing...';
    goButton.style.opacity = '0.7';
    
    try {
        console.log('Creating project:', { type: selectedType, prompt }); // Debug log

        const response = await fetch(`${current_endpoint}/api/projects/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ type: selectedType, prompt: prompt })
        });

        console.log('Response status:', response.status); // Debug log
        console.log('Response ok:', response.ok); // Debug log

        const data = await response.json();
        console.log('Response data:', data); // Debug log

        // Check if response is successful
        if (response.ok && data.ok) {
            console.log('SUCCESS! Project created:', data.room); // Debug log

            // Show success state
            goButton.textContent = '✅ Done!';
            goButton.style.opacity = '1';
            goButton.style.backgroundColor = '#10b981';

            // Prefer backend-provided redirect if present
            if (data.redirect) {
                console.log('🚀 Redirecting to backend-provided URL:', data.redirect);
                setTimeout(() => {
                    window.location.href = data.redirect;
                }, 500);
                return;
            }

            // If backend did not provide a redirect, fetch the latest projects and redirect to the newest one
            try {
                const latest = await fetchLatestProject();
                if (latest && latest.room) {
                    const editorUrl = {
                        'doc': '../doc_editor/doc_editor.html',
                        'code': '../code_editor/code_editor.html',
                        'lesson': '../lesson_planner/lesson_planner.html'
                    }[latest.type] || '../doc_editor/doc_editor.html';

                    const dest = `${editorUrl}?room=${latest.room}`;
                    console.log('🚀 Redirecting to latest project:', dest);
                    setTimeout(() => { window.location.href = dest; }, 500);
                    return;
                }
            } catch (err) {
                console.error('Failed to fetch latest project for redirect:', err);
            }

            // Final fallback - if response returned a room value, open that
            if (data.room) {
                const fallbackUrl = `../doc_editor/doc_editor.html?room=${data.room}`;
                console.log('🚀 Fallback redirect to room:', fallbackUrl);
                setTimeout(() => { window.location.href = fallbackUrl; }, 500);
                return;
            }

            // If all else fails, re-enable controls and show error
            alert('Project created but could not determine where to redirect. Please open the workspace to find your project.');
            goButton.disabled = false;
            promptInput.disabled = false;
            goButton.textContent = 'Go!';
            goButton.style.opacity = '1';

        } else {
            console.error('❌ Failed! response.ok:', response.ok, 'data.ok:', data.ok);
            console.error('Error from backend:', data.error);
            alert('Error: ' + (data.error || 'Failed to create project'));
            // Re-enable button on error
            goButton.disabled = false;
            promptInput.disabled = false;
            goButton.textContent = 'Go!';
            goButton.style.opacity = '1';
        }
    } catch (error) {
        console.error('Network error:', error);
        alert('Failed to connect to backend. Make sure the server is running on ${current_endpoint}\n\nError details: ' + error.message);
        // Re-enable button on error
        goButton.disabled = false;
        promptInput.disabled = false;
        goButton.textContent = 'Go!';
        goButton.style.opacity = '1';
    }
}



promptInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        processPrompt();
    }
});

// Initialize - guard against multiple executions using sessionStorage
window.addEventListener('DOMContentLoaded', async () => {
    console.log('=== Dashboard DOMContentLoaded event fired ===');
    
    // Check authentication first
    console.log('Checking authentication...');
    const isAuthenticated = await checkAuth();
    console.log('Auth check result:', isAuthenticated);
    
    if (!isAuthenticated) {
        console.log('Not authenticated, stopping initialization');
        return;
    }
    
    console.log('Loading projects...');
    await loadProjects();
    
    console.log('Dashboard initialization complete');
    
    // Add "Join Room" button if it doesn't exist
    const workspace = document.querySelector('.workspace');
    if (workspace && !document.getElementById('joinRoomBtn')) {
        const workspaceTitle = workspace.querySelector('.workspace-title');
        if (workspaceTitle) {
            const joinBtn = document.createElement('button');
            joinBtn.id = 'joinRoomBtn';
            joinBtn.textContent = '🔗 Join Room';
            joinBtn.style.cssText = `
                float: right;
                padding: 8px 16px;
                background: #5eb3f6;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 600;
                transition: background 0.2s;
            `;
            joinBtn.onmouseover = () => joinBtn.style.background = '#3b82f6';
            joinBtn.onmouseout = () => joinBtn.style.background = '#5eb3f6';
            joinBtn.onclick = joinByRoom;
            
            workspaceTitle.appendChild(joinBtn);
        }
    }
    
    // Wire up prompt input and go button after DOM is ready
    const promptInput = document.getElementById('promptInput');
    const goButton = document.querySelector('.btn-go');

    if (goButton && promptInput) {
        goButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            processPrompt();
        });

        promptInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                processPrompt();
            }
        });
    } else {
        console.warn('Prompt input or Go button not found during initialization');
    }

    // Wire up type selection buttons safely
    const docBtn = document.querySelector('.btn-document');
    const codeBtn = document.querySelector('.btn-code');
    const contentBtn = document.querySelector('.btn-content');

    if (docBtn) {
        docBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            selectType('doc');
        });
    }

    if (codeBtn) {
        codeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            selectType('code');
        });
    }

    if (contentBtn) {
        contentBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            selectType('lesson');
        });
    }
});