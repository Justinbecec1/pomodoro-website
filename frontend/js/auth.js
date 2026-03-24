// ============================================
// Authentication Module with Supabase Backend API
// ============================================

class AuthManager {
    constructor() {
        this.sessionKey = 'pomodoro_session';
        this.userKey = 'pomodoro_user';
        this.rememberMeKey = 'pomodoro_remember_email';
        this.timerCacheKeyPrefix = 'pomodoro_timer_state_cache';
    }

    async register(email, password, displayName) {
        try {
            const normalizedEmail = this.normalizeEmail(email);

            if (!this.validateEmail(normalizedEmail)) {
                throw new Error('Invalid email format');
            }
            if (password.length < 6) {
                throw new Error('Password must be at least 6 characters');
            }
            if (!displayName || displayName.trim().length === 0) {
                throw new Error('Display name is required');
            }
            if (!window.api) {
                throw new Error('API client not loaded.');
            }

            const result = await window.api.signup({
                email: normalizedEmail,
                password,
                displayName: displayName.trim()
            });

            if (result.session && result.user) {
                this.storeSession(result.session, result.user, false);
            }

            return {
                success: true,
                message: result.message,
                requiresEmailConfirmation: !!result.requiresEmailConfirmation,
                user: result.user || null,
                session: result.session || null
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async login(email, password, rememberMe = false) {
        try {
            const normalizedEmail = this.normalizeEmail(email);

            if (!normalizedEmail || !password) {
                throw new Error('Email and password are required');
            }
            if (!window.api) {
                throw new Error('API client not loaded.');
            }

            const result = await window.api.login({
                email: normalizedEmail,
                password
            });

            this.storeSession(result.session, result.user, rememberMe);

            if (rememberMe) {
                localStorage.setItem(this.rememberMeKey, normalizedEmail);
            } else {
                localStorage.removeItem(this.rememberMeKey);
            }

            return {
                success: true,
                user: result.user,
                session: result.session
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async logout() {
        const session = this.getSession();

        try {
            if (session?.access_token && window.api) {
                await window.api.logout(session.access_token);
            }
        } catch (_error) {
            // Client-side cleanup still logs out the user even if backend token revocation fails.
        } finally {
            this.clearSession(localStorage);
            this.clearSession(sessionStorage);
            this.clearLegacyTimerCache();
        }

        return true;
    }

    getCurrentUser() {
        return this.getSessionValue(this.userKey);
    }

    getSession() {
        return this.getSessionValue(this.sessionKey);
    }

    getToken() {
        const session = this.getSession();
        return session?.access_token || null;
    }

    isAuthenticated() {
        const token = this.getToken();
        const user = this.getCurrentUser();
        return !!token && !!user;
    }

    getRememberedEmail() {
        return localStorage.getItem(this.rememberMeKey);
    }

    isAuthPage() {
        const path = window.location.pathname;
        return path.endsWith('/login.html') || path.endsWith('/register.html') || path === '/login.html' || path === '/register.html';
    }

    async fetchCurrentProfile() {
        const token = this.getToken();
        if (!token || !window.api) {
            return null;
        }

        let response;
        try {
            response = await window.api.me(token);
        } catch (error) {
            if (error.status === 401) {
                const refreshed = await this.refreshSession();
                if (!refreshed) {
                    return null;
                }

                response = await window.api.me(this.getToken());
            } else {
                throw error;
            }
        }

        const profile = response.user || null;
        if (profile) {
            this.storeUserProfile(profile);
        }

        return profile;
    }

    async refreshSession() {
        const session = this.getSession();
        const refreshToken = session?.refresh_token;

        if (!refreshToken || !window.api) {
            await this.logout();
            return false;
        }

        try {
            const refreshed = await window.api.refresh(refreshToken);
            this.updateStoredSession(refreshed.session, refreshed.user);
            return true;
        } catch (_error) {
            await this.logout();
            return false;
        }
    }

    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    normalizeEmail(email) {
        return typeof email === 'string' ? email.trim().toLowerCase() : '';
    }

    storeSession(session, user, rememberMe) {
        const storage = rememberMe ? localStorage : sessionStorage;
        const otherStorage = rememberMe ? sessionStorage : localStorage;

        this.clearSession(otherStorage);
        storage.setItem(this.sessionKey, JSON.stringify(session));
        storage.setItem(this.userKey, JSON.stringify(this.shapeUser(user)));
    }

    updateStoredSession(session, user) {
        const storage = this.getSessionStorage();
        storage.setItem(this.sessionKey, JSON.stringify(session));
        storage.setItem(this.userKey, JSON.stringify(this.shapeUser(user)));
    }

    storeUserProfile(profile) {
        const user = {
            id: profile.id,
            email: profile.email,
            displayName: profile.display_name || profile.email,
            createdAt: profile.created_at || null
        };

        if (sessionStorage.getItem(this.userKey)) {
            sessionStorage.setItem(this.userKey, JSON.stringify(user));
        } else if (localStorage.getItem(this.userKey)) {
            localStorage.setItem(this.userKey, JSON.stringify(user));
        }
    }

    shapeUser(user) {
        return {
            id: user.id,
            email: user.email,
            displayName: user.user_metadata?.display_name || user.display_name || user.email,
            createdAt: user.created_at || null
        };
    }

    getSessionValue(key) {
        const fromSession = this.readJson(sessionStorage, key);
        if (fromSession !== null) {
            return fromSession;
        }

        return this.readJson(localStorage, key);
    }

    getSessionStorage() {
        if (sessionStorage.getItem(this.sessionKey)) {
            return sessionStorage;
        }

        if (localStorage.getItem(this.sessionKey)) {
            return localStorage;
        }

        return sessionStorage;
    }

    readJson(store, key) {
        try {
            const value = store.getItem(key);
            return value ? JSON.parse(value) : null;
        } catch (_error) {
            store.removeItem(key);
            return null;
        }
    }

    clearSession(store) {
        store.removeItem(this.sessionKey);
        store.removeItem(this.userKey);
    }

    clearLegacyTimerCache() {
        const keysToRemove = [];

        for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i);
            if (key && key.startsWith(this.timerCacheKeyPrefix)) {
                keysToRemove.push(key);
            }
        }

        keysToRemove.forEach((key) => {
            localStorage.removeItem(key);
        });
    }
}

// Create global instance
const auth = new AuthManager();

// ============================================
// DOM Event Handlers
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on the login page
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        setupLoginForm();
    }

    setupForgotPasswordButton();

    if (auth.isAuthenticated() && auth.isAuthPage()) {
        redirectToDashboard();
    }
});

/**
 * Setup login form event listeners
 */
function setupLoginForm() {
    const form = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const rememberMeCheckbox = document.getElementById('remember-me');

    // Pre-fill email if remembered
    const rememberedEmail = auth.getRememberedEmail();
    if (rememberedEmail) {
        emailInput.value = rememberedEmail;
        rememberMeCheckbox.checked = true;
    }

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        handleLogin();
    });
}

/**
 * Setup the placeholder forgot password button.
 */
function setupForgotPasswordButton() {
    const forgotPasswordButton = document.querySelector('.forgot-password');

    if (!forgotPasswordButton) {
        return;
    }

    forgotPasswordButton.addEventListener('click', function() {
        showErrorMessage('Forgot password is not implemented yet.');
    });
}

/**
 * Handle login form submission
 */
async function handleLogin() {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('remember-me').checked;

    // Clear messages
    clearMessages();

    // Attempt login
    const result = await auth.login(email, password, rememberMe);

    if (result.success) {
        showSuccessMessage('Login successful! Redirecting...');
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1500);
    } else {
        showErrorMessage(result.error);
    }
}

/**
 * Handle logout
 */
function handleLogout() {
    auth.logout().finally(() => {
        window.location.href = 'login.html';
    });
}

/**
 * Show error message
 */
function showErrorMessage(message) {
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    } else {
        alert('Error: ' + message);
    }
}

/**
 * Show success message
 */
function showSuccessMessage(message) {
    const successDiv = document.getElementById('success-message');
    if (successDiv) {
        successDiv.textContent = message;
        successDiv.style.display = 'block';
    }
}

/**
 * Clear all messages
 */
function clearMessages() {
    const errorDiv = document.getElementById('error-message');
    const successDiv = document.getElementById('success-message');
    
    if (errorDiv) {
        errorDiv.textContent = '';
        errorDiv.style.display = 'none';
    }

    if (successDiv) {
        successDiv.textContent = '';
        successDiv.style.display = 'none';
    }
}

/**
 * Redirect to dashboard if authenticated
 */
function redirectToDashboard() {
    if (auth.isAuthPage()) {
        window.location.href = 'dashboard.html';
    }
}

/**
 * Check authentication on protected pages
 */
function requireAuth() {
    if (!auth.isAuthenticated()) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}
