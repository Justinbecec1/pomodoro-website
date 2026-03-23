// ============================================
// Dashboard Page Handler
// ============================================

document.addEventListener('DOMContentLoaded', async function() {
    // Require authentication to access dashboard
    if (!requireAuth()) {
        return;
    }

    setupLogoutButton();

    // Load user data
    await loadUserData();
});

/**
 * Attach logout behavior without inline HTML handlers.
 */
function setupLogoutButton() {
    const logoutButton = document.getElementById('logout-button');

    if (!logoutButton) {
        return;
    }

    logoutButton.addEventListener('click', handleLogout);
}

/**
 * Load and display user data
 */
async function loadUserData() {
    const cachedUser = auth.getCurrentUser();
    const user = cachedUser || (await auth.fetchCurrentProfile());
    
    if (user) {
        // Display user's display name
        const displayNameElement = document.getElementById('user-display-name');
        if (displayNameElement) {
            displayNameElement.textContent = user.displayName || user.display_name || user.email;
        }

        // Here you would load stats from localStorage or backend
        // For now, we'll just show placeholder values
    } else {
        window.location.href = 'login.html';
    }
}
