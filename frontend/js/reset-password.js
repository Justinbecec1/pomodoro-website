function showResetError(message) {
    const errorDiv = document.getElementById('error-message');
    const successDiv = document.getElementById('success-message');

    if (successDiv) {
        successDiv.textContent = '';
        successDiv.style.display = 'none';
    }

    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
}

function showResetSuccess(message) {
    const errorDiv = document.getElementById('error-message');
    const successDiv = document.getElementById('success-message');

    if (errorDiv) {
        errorDiv.textContent = '';
        errorDiv.style.display = 'none';
    }

    if (successDiv) {
        successDiv.textContent = message;
        successDiv.style.display = 'block';
    }
}

function extractResetAccessToken() {
    const fromHash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const fromQuery = new URLSearchParams(window.location.search);

    return fromHash.get('access_token') || fromQuery.get('access_token') || '';
}

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('reset-password-form');

    if (!form) {
        return;
    }

    form.addEventListener('submit', async function(event) {
        event.preventDefault();

        const accessToken = extractResetAccessToken();
        if (!accessToken) {
            showResetError('This reset link is invalid or expired. Request a new one from login.');
            return;
        }

        const newPasswordInput = document.getElementById('new-password');
        const confirmPasswordInput = document.getElementById('confirm-password');
        const newPassword = newPasswordInput ? newPasswordInput.value : '';
        const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : '';

        if (!newPassword || !confirmPassword) {
            showResetError('Enter and confirm your new password.');
            return;
        }

        if (newPassword.length < 6) {
            showResetError('Password must be at least 6 characters.');
            return;
        }

        if (newPassword !== confirmPassword) {
            showResetError('Passwords do not match.');
            return;
        }

        try {
            await window.api.resetPassword(accessToken, newPassword);
            showResetSuccess('Password updated successfully. Redirecting to login...');
            setTimeout(function() {
                window.location.href = 'login.html';
            }, 1400);
        } catch (error) {
            showResetError(error.message || 'Could not update password.');
        }
    });
});
