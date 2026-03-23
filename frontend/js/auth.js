// ============================================
// Authentication Module with localStorage
// ============================================

class AuthManager {
    constructor() {
        this.userKey = 'pomodoro_user';
        this.tokenKey = 'pomodoro_token';
        this.usersKey = 'pomodoro_all_users';
        this.rememberMeKey = 'pomodoro_remember_email';
    }

    /**
     * Register a new user
     * @param {string} email - User email
     * @param {string} password - User password
     * @param {string} displayName - User display name
     * @returns {Object} - User object or error
     */
    register(email, password, displayName) {
        try {
            const normalizedEmail = this.normalizeEmail(email);

            // Validate inputs
            if (!this.validateEmail(normalizedEmail)) {
                throw new Error('Invalid email format');
            }
            if (password.length < 6) {
                throw new Error('Password must be at least 6 characters');
            }
            if (!displayName || displayName.trim().length === 0) {
                throw new Error('Display name is required');
            }

            // Check if user already exists
            if (this.userExists(normalizedEmail)) {
                throw new Error('User already exists with this email');
            }

            // Create user object
            const user = {
                id: this.generateUserId(),
                email: normalizedEmail,
                displayName: displayName.trim(),
                password: this.hashPassword(password),
                createdAt: new Date().toISOString(),
                lastLogin: null
            };

            // Get all users from localStorage
            const allUsers = this.getAllUsers();
            allUsers.push(user);
            this.safeSetItem(localStorage, this.usersKey, allUsers);

            // Return user (without password)
            const { password: _, ...userWithoutPassword } = user;
            return {
                success: true,
                user: userWithoutPassword
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Login user with email and password
     * @param {string} email - User email
     * @param {string} password - User password
     * @param {boolean} rememberMe - Save email for next login
     * @returns {Object} - Login result
     */
    login(email, password, rememberMe = false) {
        try {
            const normalizedEmail = this.normalizeEmail(email);

            if (!normalizedEmail || !password) {
                throw new Error('Email and password are required');
            }

            const user = this.findUserByEmail(normalizedEmail);
            if (!user) {
                throw new Error('User not found');
            }

            // Verify password
            if (!this.verifyPassword(password, user.password)) {
                throw new Error('Invalid password');
            }

            // Create token
            const token = this.generateToken(user.id);

            // Update last login
            const allUsers = this.getAllUsers();
            const userIndex = allUsers.findIndex(u => u.id === user.id);
            if (userIndex !== -1) {
                allUsers[userIndex].lastLogin = new Date().toISOString();
                this.safeSetItem(localStorage, this.usersKey, allUsers);
            }

            const sessionStore = rememberMe ? localStorage : sessionStorage;
            const otherStore = rememberMe ? sessionStorage : localStorage;
            const sessionUser = {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                createdAt: user.createdAt
            };

            // Store current user session in the chosen browser storage.
            this.clearSession(otherStore);
            this.safeSetItem(sessionStore, this.userKey, sessionUser);
            sessionStore.setItem(this.tokenKey, token);

            // Remember email if checked
            if (rememberMe) {
                localStorage.setItem(this.rememberMeKey, normalizedEmail);
            } else {
                localStorage.removeItem(this.rememberMeKey);
            }

            return {
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    displayName: user.displayName
                },
                token: token
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Logout user
     * @returns {boolean} - True if logout successful
     */
    logout() {
        this.clearSession(localStorage);
        this.clearSession(sessionStorage);
        return true;
    }

    /**
     * Get current logged-in user
     * @returns {Object|null} - Current user or null
     */
    getCurrentUser() {
        return this.getSessionValue(this.userKey);
    }

    /**
     * Get auth token
     * @returns {string|null} - Auth token or null
     */
    getToken() {
        return this.getSessionValue(this.tokenKey, false);
    }

    /**
     * Check if user is authenticated
     * @returns {boolean} - True if user is logged in
     */
    isAuthenticated() {
        const user = this.getCurrentUser();
        const token = this.getToken();
        return user !== null && token !== null;
    }

    /**
     * Get remembered email
     * @returns {string|null} - Remembered email or null
     */
    getRememberedEmail() {
        return localStorage.getItem(this.rememberMeKey);
    }

    /**
     * Check whether the current page is an auth page.
     */
    isAuthPage() {
        const path = window.location.pathname;
        return path.endsWith('/login.html') || path.endsWith('/register.html') || path === '/login.html' || path === '/register.html';
    }

    // ============================================
    // Private Helper Methods
    // ============================================

    /**
     * Validate email format
     */
    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Normalize email values for consistent matching.
     */
    normalizeEmail(email) {
        return typeof email === 'string' ? email.trim().toLowerCase() : '';
    }

    /**
     * Simple hash function (NOT production-ready)
     * For production, use bcrypt on the backend
     */
    hashPassword(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return 'hash_' + Math.abs(hash).toString(16);
    }

    /**
     * Verify password against hash
     */
    verifyPassword(password, hash) {
        return this.hashPassword(password) === hash;
    }

    /**
     * Generate unique user ID
     */
    generateUserId() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
        }

        return 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
    }

    /**
     * Generate auth token
     */
    generateToken(userId) {
        if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
            const values = new Uint32Array(2);
            window.crypto.getRandomValues(values);
            return 'token_' + userId + '_' + values[0].toString(36) + values[1].toString(36);
        }

        return 'token_' + userId + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
    }

    /**
     * Check if user exists by email
     */
    userExists(email) {
        return this.findUserByEmail(email) !== null;
    }

    /**
     * Find user by email
     */
    findUserByEmail(email) {
        const allUsers = this.getAllUsers();
        const normalizedEmail = this.normalizeEmail(email);
        return allUsers.find(user => user.email === normalizedEmail) || null;
    }

    /**
     * Get all users from localStorage
     */
    getAllUsers() {
        const users = this.safeReadJson(localStorage, this.usersKey, []);
        return Array.isArray(users) ? users : [];
    }

    /**
     * Read session value from sessionStorage first, then localStorage.
     */
    getSessionValue(key, parseJson = true) {
        const fromSession = this.readFromStore(sessionStorage, key, parseJson);
        if (fromSession !== null) {
            return fromSession;
        }

        return this.readFromStore(localStorage, key, parseJson);
    }

    /**
     * Read a single value from a storage object.
     */
    readFromStore(store, key, parseJson = true) {
        try {
            const value = store.getItem(key);
            if (value === null) {
                return null;
            }

            return parseJson ? JSON.parse(value) : value;
        } catch (error) {
            store.removeItem(key);
            return null;
        }
    }

    /**
     * Safely read JSON from browser storage.
     */
    safeReadJson(store, key, fallbackValue) {
        const value = this.readFromStore(store, key, true);
        return value === null ? fallbackValue : value;
    }

    /**
     * Safely write JSON to browser storage.
     */
    safeSetItem(store, key, value) {
        store.setItem(key, JSON.stringify(value));
    }

    /**
     * Clear auth session from a specific browser store.
     */
    clearSession(store) {
        store.removeItem(this.userKey);
        store.removeItem(this.tokenKey);
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

    // Only redirect away from login/register pages.
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
        showErrorMessage('Forgot password will be connected when Supabase auth is added.');
    });
}

/**
 * Handle login form submission
 */
function handleLogin() {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('remember-me').checked;

    // Clear messages
    clearMessages();

    // Attempt login
    const result = auth.login(email, password, rememberMe);

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
    if (confirm('Are you sure you want to logout?')) {
        auth.logout();
        window.location.href = 'login.html';
    }
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
