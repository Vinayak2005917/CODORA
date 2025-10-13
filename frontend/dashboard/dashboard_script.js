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

goButton.addEventListener('click', () => {
    const prompt = promptInput.value.trim();
    if (prompt) {
        console.log('Processing prompt:', prompt);
        // Add prompt processing logic here
    }
});

promptInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        goButton.click();
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