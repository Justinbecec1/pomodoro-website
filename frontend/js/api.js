// Production API endpoint for Netlify deployment.
const API_BASE_URL = window.APP_API_BASE_URL || 'https://pomodoro-website-production-97d7.up.railway.app/api';

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.error || 'Request failed.');
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

window.api = {
  signup({ email, password, displayName }) {
    return request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName })
    });
  },

  login({ email, password }) {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  },

  forgotPassword({ email, redirectTo }) {
    return request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email, redirectTo })
    });
  },

  resetPassword(accessToken, password) {
    return request('/auth/reset-password', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ password })
    });
  },

  refresh(refreshToken) {
    return request('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken })
    });
  },

  logout(accessToken) {
    return request('/auth/logout', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
  },

  me(accessToken) {
    return request('/auth/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
  },

  uploadAvatar(accessToken, payload) {
    return request('/auth/avatar', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify(payload)
    });
  },

  getAvatarUrl(accessToken) {
    return request('/auth/avatar-url', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
  },

  getTimer(accessToken) {
    return request('/timer', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
  },

  updateTimer(accessToken, remainingSeconds, currentMode, lastWorkSeconds) {
    return request('/timer', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ remainingSeconds, currentMode, lastWorkSeconds })
    });
  },

  completeWork(accessToken, workedSeconds) {
    return request('/timer/complete-work', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ workedSeconds })
    });
  },

  completeBreak(accessToken, workedSeconds) {
    return request('/timer/complete-break', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ workedSeconds })
    });
  },

  getTasks(accessToken) {
    return request('/tasks', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
  },

  createTask(accessToken, description) {
    return request('/tasks', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ description, title: description })
    });
  },

  updateTask(accessToken, taskId, updates) {
    const payload = { ...updates };
    if (typeof payload.description === 'string' && !payload.title) {
      payload.title = payload.description;
    }

    return request(`/tasks/${taskId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify(payload)
    });
  },

  deleteTask(accessToken, taskId) {
    return request(`/tasks/${taskId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
  },

  getProgressSummary(accessToken, range) {
    const query = range ? `?range=${encodeURIComponent(range)}` : '';
    return request(`/progress/summary${query}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
  },

  saveProgressNote(accessToken, range, content) {
    return request('/progress/notes', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ range, content })
    });
  },

  trackProgress(accessToken, seconds) {
    return request('/progress/track', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ seconds })
    });
  }
};
