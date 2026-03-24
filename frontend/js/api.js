const API_BASE_URL = window.APP_API_BASE_URL || 'http://localhost:3000/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
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
  }
};
