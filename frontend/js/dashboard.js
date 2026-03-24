// ============================================
// Dashboard Page Handler
// ============================================

const TIMER_CACHE_KEY_PREFIX = 'pomodoro_timer_state_cache';

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

        await loadDashboardStats();
    } else {
        window.location.href = 'login.html';
    }
}

async function loadDashboardStats() {
    const pomodorosElement = document.getElementById('todays-pomodoros-stat');
    const tasksCompletedElement = document.getElementById('tasks-completed-stat');
    const currentStreakElement = document.getElementById('current-streak-stat');
    const token = auth.getToken();

    if (!pomodorosElement || !token || !window.api) {
        return;
    }

    try {
        const [timer, progressSummary, streakData] = await Promise.all([
            window.api.getTimer(token),
            window.api.getProgressSummary(token, 'week'),
            typeof window.api.getCurrentStreak === 'function'
                ? window.api.getCurrentStreak(token)
                : Promise.resolve({ currentStreakDays: 0 })
        ]);

        const todaysPomodoros = Number.isInteger(timer?.todaysPomodoros) ? timer.todaysPomodoros : 0;
        const tasksCompleted = Number.isInteger(progressSummary?.tasksCompleted)
            ? progressSummary.tasksCompleted
            : 0;
        const currentStreakDays = Number.isInteger(streakData?.currentStreakDays)
            ? streakData.currentStreakDays
            : 0;

        pomodorosElement.textContent = String(todaysPomodoros);
        if (tasksCompletedElement) {
            tasksCompletedElement.textContent = String(tasksCompleted);
        }
        if (currentStreakElement) {
            currentStreakElement.textContent = `${currentStreakDays} days`;
        }
    } catch (error) {
        if (error && error.status === 401) {
            await auth.logout();
            window.location.href = 'login.html';
            return;
        }

        const cached = readTimerCache();
        const todaysPomodoros = Number.isInteger(cached?.todaysPomodoros) ? cached.todaysPomodoros : 0;

        pomodorosElement.textContent = String(todaysPomodoros);
        if (tasksCompletedElement) {
            tasksCompletedElement.textContent = '0';
        }
        if (currentStreakElement) {
            currentStreakElement.textContent = '0 days';
        }
    }
}

function readTimerCache() {
    const userId = auth.getCurrentUser()?.id;
    const scopedKey = userId ? `${TIMER_CACHE_KEY_PREFIX}_${userId}` : TIMER_CACHE_KEY_PREFIX;

    try {
        const scopedRaw = localStorage.getItem(scopedKey);
        if (scopedRaw) {
            return JSON.parse(scopedRaw);
        }

        const legacyRaw = localStorage.getItem(TIMER_CACHE_KEY_PREFIX);
        return legacyRaw ? JSON.parse(legacyRaw) : null;
    } catch (_error) {
        localStorage.removeItem(scopedKey);
        localStorage.removeItem(TIMER_CACHE_KEY_PREFIX);
        return null;
    }
}

