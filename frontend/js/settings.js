const DEFAULT_AVATAR_DATA_URI = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" fill="%23eaf4ff"/><circle cx="120" cy="95" r="44" fill="%239fc7ee"/><rect x="52" y="152" width="136" height="58" rx="28" fill="%239fc7ee"/></svg>';

document.addEventListener('DOMContentLoaded', async function() {
    if (!requireAuth()) {
        return;
    }

    let user = auth.getCurrentUser();

    try {
        const latestProfile = await auth.fetchCurrentProfile();
        if (latestProfile) {
            user = latestProfile;
        }
    } catch (_error) {
        // Allow settings page to continue even if profile refresh briefly fails.
    }

    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }

    renderProfileBasics(user);
    await loadAvatar();
    setupAvatarUpload();
});

function renderProfileBasics(user) {
    const nameNode = document.getElementById('settings-profile-name');
    const emailNode = document.getElementById('settings-profile-email');

    if (nameNode) {
        nameNode.textContent = user.displayName || 'Profile';
    }

    if (emailNode) {
        emailNode.textContent = user.email || '';
    }
}

async function loadAvatar() {
    const token = auth.getToken();
    const avatarImage = document.getElementById('settings-avatar-image');

    if (!token || !avatarImage || !window.api) {
        return;
    }

    avatarImage.src = DEFAULT_AVATAR_DATA_URI;

    try {
        const profile = await window.api.me(token);
        const avatarUrl = profile?.user?.avatar_url || null;
        avatarImage.src = avatarUrl || DEFAULT_AVATAR_DATA_URI;
    } catch (_error) {
        avatarImage.src = DEFAULT_AVATAR_DATA_URI;
    }
}

function setupAvatarUpload() {
    const fileInput = document.getElementById('settings-avatar-file');
    const uploadButton = document.getElementById('settings-avatar-upload');
    const avatarImage = document.getElementById('settings-avatar-image');

    if (!fileInput || !uploadButton || !avatarImage) {
        return;
    }

    fileInput.addEventListener('change', function() {
        const file = fileInput.files && fileInput.files[0];
        if (!file) {
            return;
        }

        const previewUrl = URL.createObjectURL(file);
        avatarImage.src = previewUrl;
    });

    uploadButton.addEventListener('click', async function() {
        const token = auth.getToken();
        const file = fileInput.files && fileInput.files[0];

        if (!token || !file || !window.api) {
            setAvatarStatus('Choose an image file first.');
            return;
        }

        if (!file.type.startsWith('image/')) {
            setAvatarStatus('Only image files are supported.');
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            setAvatarStatus('Image must be 2MB or smaller.');
            return;
        }

        uploadButton.disabled = true;
        setAvatarStatus('Uploading...');

        try {
            const dataBase64 = await readFileAsBase64(file);
            const result = await window.api.uploadAvatar(token, {
                fileName: file.name,
                mimeType: file.type,
                dataBase64
            });

            avatarImage.src = result.avatarUrl || avatarImage.src;
            setAvatarStatus(result.message || 'Profile picture updated.');

            const refreshed = await auth.fetchCurrentProfile();
            if (refreshed) {
                renderProfileBasics(refreshed);
            }
        } catch (error) {
            setAvatarStatus(error?.message || 'Could not upload profile picture.');
        } finally {
            uploadButton.disabled = false;
        }
    });
}

function readFileAsBase64(file) {
    return new Promise(function(resolve, reject) {
        const reader = new FileReader();

        reader.onload = function() {
            const result = typeof reader.result === 'string' ? reader.result : '';
            const base64 = result.includes(',') ? result.split(',')[1] : '';
            if (!base64) {
                reject(new Error('Could not process image file.'));
                return;
            }
            resolve(base64);
        };

        reader.onerror = function() {
            reject(new Error('Could not read file.'));
        };

        reader.readAsDataURL(file);
    });
}

function setAvatarStatus(message) {
    const statusNode = document.getElementById('settings-avatar-status');
    if (!statusNode) {
        return;
    }

    statusNode.textContent = message;
}
