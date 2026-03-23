// ============================================
// Dashboard Page Handler
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    // Require authentication to access dashboard
    if (!requireAuth()) {
        return;
    }

    setupLogoutButton();

    // Load user data
    loadUserData();
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
function loadUserData() {
    const user = auth.getCurrentUser();
    
    if (user) {
        // Display user's display name
        const displayNameElement = document.getElementById('user-display-name');
        if (displayNameElement) {
            displayNameElement.textContent = user.displayName || user.email;
        }

        // Here you would load stats from localStorage or backend
        // For now, we'll just show placeholder values
    }
}
