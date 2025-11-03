// === Elements ===
const form = document.getElementById("login-form");
const errorBox = document.getElementById("error-message");
const successBox = document.getElementById("success-message");

// === Helper functions ===
function showError(message) {
    errorBox.style.display = "block";
    errorBox.textContent = message;
    successBox.style.display = "none";
}

function showSuccess(message) {
    successBox.style.display = "block";
    successBox.textContent = message;
    errorBox.style.display = "none";
}

// === Function to login/register user ===
async function loginUser(username, password) {
    const response = await fetch("http://127.0.0.1:8000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include" // important for JWT cookie
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg = errorData.detail || "Invalid username or password";
        throw new Error(msg);
    }

    const data = await response.json();
    return data;
}

// === Form submission handler ===
form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!username || !password) {
        showError("Please enter both username and password.");
        return;
    }

    try {
        const data = await loginUser(username, password);

        // Store token in localStorage as a backup (optional)
        if (data.token) localStorage.setItem("token", data.token);

        showSuccess("Login successful! Redirecting...");
        console.log("JWT token:", data.token);

        // Redirect after short delay. Use a relative URL so it resolves correctly whether
        // the login page is served from /frontend/login_page/ or a different path.
        setTimeout(() => {
            const dashboardUrl = new URL('../dashboard/dashboard.html', window.location.href).href;
            window.location.href = dashboardUrl;
        }, 100);

    } catch (err) {
        showError(err.message || "Something went wrong. Try again.");
    }
});
