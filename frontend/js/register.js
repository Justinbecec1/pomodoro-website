// ============================================
// Registration Form Handler
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        setupRegisterForm();
    }

    // Redirect if already logged in
    if (auth.isAuthenticated()) {
        window.location.href = 'dashboard.html';
    }
});

/**
 * Setup register form event listeners
 */
function setupRegisterForm() {
    const form = document.getElementById('register-form');
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        handleRegister();
    });
}

/**
 * Handle registration form submission
 */
async function handleRegister() {
    const displayName = document.getElementById('display-name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    // Clear messages
    clearMessages();

    // Validation
    if (!displayName) {
        showErrorMessage('Please enter your full name');
        return;
    }

    if (!email) {
        showErrorMessage('Please enter your email');
        return;
    }

    if (password.length < 6) {
        showErrorMessage('Password must be at least 6 characters');
        return;
    }

    if (password !== confirmPassword) {
        showErrorMessage('Passwords do not match');
        return;
    }

    // Attempt registration
    const result = await auth.register(email, password, displayName);

    if (result.success) {
        if (result.requiresEmailConfirmation) {
            showSuccessMessage('Account created. Check your email to verify your account, then sign in.');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2200);
            return;
        }

        showSuccessMessage('Account created successfully! Redirecting to dashboard...');
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1200);
    } else {
        showErrorMessage(result.error);
    }
}
