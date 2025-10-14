// Sample projects data
const projects = [
    {
        id: 1,
        type: 'document',
        title: 'Residential Lease Agreement',
        lastEdited: '3 days ago',
        preview: `RESIDENTIAL LEASE AGREEMENT
        
Note: This template was created and can only be used by the author in question. It will only ever be used for the publisher's benefit in all the time of use. It cannot be used for any individual and cannot be shared and distributed.

This Residential Lease Agreement ("agreement") is entered into by and between:

Landlord: [Landlord Full Name]
Address: [Property Address]

For both eventually interested...`
    },
    {
        id: 2,
        type: 'code',
        title: 'Positive numbers with C',
        lastEdited: '5 days ago',
        preview: `<span class="code-keyword">include</span> <span class="code-string">&lt;iostream&gt;</span>
<span class="code-keyword">using namespace</span> std;

<span class="code-keyword">int</span> <span class="code-function">main</span>()
{
    <span class="code-keyword">unsigned int</span> n;
    <span class="code-keyword">unsigned long long</span> factorial = <span class="code-number">1</span>;
    
    cout <span class="code-keyword">&lt;&lt;</span> <span class="code-string">"Enter a positive integer: "</span>;
    cin <span class="code-keyword">&gt;&gt;</span> n;
    
    <span class="code-keyword">for</span>(<span class="code-keyword">int</span> i = <span class="code-number">1</span>; i &lt;= n; ++i)
}`
    },
    {
        id: 3,
        type: 'document',
        title: '(Old) Residential Lease Agreement',
        lastEdited: '10 days ago',
        preview: `RESIDENTIAL LEASE AGREEMENT
(Single-Family Home)

Note: This template was created and can only be used by the author in question. It will only ever be used for the publisher's benefit...

This Residential Lease Agreement ("agreement") is entered into by and between:

For both eventually interested, real advice gets and calculus combinations, for...`
    }
];

// Render projects
function renderProjects() {
    const grid = document.getElementById('projectsGrid');
    if (!grid) return;

    // If static anchors already exist (your clickable cards), don't overwrite them.
    if (grid.querySelector('a.project-card')) {
        return;
    }

    grid.innerHTML = projects.map(project => `
        <div class="project-card" onclick="openProject(${project.id})">
            <div class="copy-icon" onclick="event.stopPropagation(); copyProject(${project.id})">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
            </div>
            <div class="project-preview ${project.type}">
                ${project.preview}
            </div>
            <div class="project-info">
                <div class="project-title">${project.title}</div>
                <div class="project-meta">last edited: ${project.lastEdited}</div>
            </div>
        </div>
    `).join('');
}

// Open project
function openProject(id) {
    console.log('Opening project:', id);
    // Add navigation logic here
}

// Copy project
function copyProject(id) {
    console.log('Copying project:', id);
    // Add copy logic here
}

// Handle prompt input
const promptInput = document.getElementById('promptInput');
const goButton = document.querySelector('.btn-go');

// Function to send prompt to backend
async function processPrompt() {
    const prompt = promptInput.value.trim();
    if (!prompt) return;

    // Disable button and input, show loading state
    goButton.disabled = true;
    promptInput.disabled = true;
    goButton.textContent = '✨ Processing...';
    goButton.style.opacity = '0.7';
    
    try {
        console.log('Sending prompt to backend:', prompt); // Debug log
        
        const response = await fetch('http://127.0.0.1:8000/api/process-prompt/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt: prompt })
        });

        console.log('Response status:', response.status); // Debug log
        console.log('Response ok:', response.ok); // Debug log

        const data = await response.json();
        console.log('Response data:', data); // Debug log
        console.log('data.success value:', data.success); // Debug log
        console.log('Condition check (response.ok && data.success):', response.ok && data.success); // Debug log

        // Check if response is successful
        if (response.ok && data.success === true) {
            console.log('SUCCESS! AI Response received!'); // Debug log
            
            // Show success state
            goButton.textContent = '✅ Done!';
            goButton.style.opacity = '1';
            goButton.style.backgroundColor = '#10b981';
            
            console.log('🚀 REDIRECTING IMMEDIATELY!'); // Debug log
            
            // Redirect immediately using multiple methods to ensure it works
            window.location.replace('../doc_editor/doc_editor.html');
            // Fallback
            window.location.href = '../doc_editor/doc_editor.html';

        } else {
            console.error('❌ Condition failed! response.ok:', response.ok, 'data.success:', data.success);
            console.error('Error from backend:', data.error);
            alert('Error: ' + (data.error || 'Failed to process prompt'));
            // Re-enable button on error
            goButton.disabled = false;
            promptInput.disabled = false;
            goButton.textContent = 'Go!';
            goButton.style.opacity = '1';
        }
    } catch (error) {
        console.error('Network error:', error);
        alert('Failed to connect to backend. Make sure the server is running on http://127.0.0.1:8000\n\nError details: ' + error.message);
        // Re-enable button on error
        goButton.disabled = false;
        promptInput.disabled = false;
        goButton.textContent = 'Go!';
        goButton.style.opacity = '1';
    }
}

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

// Icon button handlers
document.querySelector('.btn-document').addEventListener('click', (e) => {
    e.stopPropagation();
    console.log('Opening document editor');
    // Navigate to document editor
});

document.querySelector('.btn-code').addEventListener('click', (e) => {
    e.stopPropagation();
    console.log('Opening code editor');
    // Navigate to code editor
});

document.querySelector('.btn-content').addEventListener('click', (e) => {
    e.stopPropagation();
    console.log('Opening content generator');
    // Navigate to content generator
});

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    renderProjects();
});