const DEFAULT_TIMER_SECONDS = 1500;
const DEFAULT_BREAK_SECONDS = 300;
const MAX_TIMER_SECONDS = 86400;
const TIMER_CACHE_KEY_PREFIX = 'pomodoro_timer_state_cache';

let timerSeconds = DEFAULT_TIMER_SECONDS;
let timerIntervalId = null;
let saveTimeoutId = null;
let currentMode = 'work';
let currentWorkSessionSeconds = DEFAULT_TIMER_SECONDS;

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
        // Keep the user on the timer tab if profile refresh temporarily fails.
    }

    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    setupLogoutButton();
    await setupTimer();
    setupPageExitSave();
});

function setupLogoutButton() {
    const logoutButton = document.getElementById('logout-button');

    if (!logoutButton) {
        return;
    }

    logoutButton.addEventListener('click', handleLogout);
}

async function setupTimer() {
    const display = document.getElementById('timer-display');
    const modeLabel = document.getElementById('timer-mode-label');
    const startPauseButton = document.getElementById('timer-start-pause');
    const plusThirtyButton = document.getElementById('timer-plus-30');
    const resetButton = document.getElementById('timer-reset');
    const setWorkButton = document.getElementById('timer-set-work');
    const setBreakButton = document.getElementById('timer-set-break');
    const applyButton = document.getElementById('timer-apply');
    const input = document.getElementById('timer-seconds-input');

    if (!display || !modeLabel || !startPauseButton || !plusThirtyButton || !resetButton || !setWorkButton || !setBreakButton || !applyButton || !input) {
        return;
    }

    try {
        const token = auth.getToken();

        if (!token || !window.api) {
            return;
        }

        const cached = readTimerCache();
        const timer = await window.api.getTimer(token);
        const initialState = chooseInitialTimerState(timer, cached);

        timerSeconds = clampSeconds(initialState?.remainingSeconds);
        currentMode = normalizeMode(initialState?.currentMode);
        if (Number.isInteger(initialState?.lastWorkSeconds) && initialState.lastWorkSeconds > 0) {
            currentWorkSessionSeconds = clampSeconds(initialState.lastWorkSeconds);
        }

        input.value = String(timerSeconds);
        renderTimer();
        renderMode();
        writeTimerCache(initialState || timer);
        showSaveStatus(initialState === cached ? 'Loaded latest local time.' : 'Loaded saved time.');
    } catch (error) {
        if (error && error.status === 401) {
            await auth.logout();
            window.location.href = 'login.html';
            return;
        }

        const cached = readTimerCache();
        timerSeconds = clampSeconds(cached?.remainingSeconds);
        currentMode = normalizeMode(cached?.currentMode);
        currentWorkSessionSeconds = clampSeconds(cached?.lastWorkSeconds || DEFAULT_TIMER_SECONDS);

        if (!cached) {
            timerSeconds = DEFAULT_TIMER_SECONDS;
            currentMode = 'work';
            currentWorkSessionSeconds = DEFAULT_TIMER_SECONDS;
        }

        input.value = String(timerSeconds);
        renderTimer();
        renderMode();
        showSaveStatus(getFriendlyTimerStatus(error, 'Using cached/default time.'));
    }

    startPauseButton.addEventListener('click', function() {
        if (timerIntervalId) {
            stopTimer();
            showSaveStatus('Paused.');
            saveTimerState();
            return;
        }

        if (timerSeconds <= 0) {
            return;
        }

        timerIntervalId = window.setInterval(function() {
            if (timerSeconds <= 0) {
                stopTimer();
                handleSessionFinished();
                return;
            }

            timerSeconds -= 1;
            renderTimer();

            // Keep local progress in sync each second so refresh can restore recent progress.
            writeTimerCache({
                remainingSeconds: timerSeconds,
                currentMode,
                lastWorkSeconds: currentWorkSessionSeconds,
                isLocalFallback: true
            });
            queueSave();
        }, 1000);

        updateStartPauseLabel();
        showSaveStatus('Running...');
    });

    plusThirtyButton.addEventListener('click', function() {
        timerSeconds = clampSeconds(timerSeconds + 30);
        if (currentMode === 'work') {
            currentWorkSessionSeconds = clampSeconds(currentWorkSessionSeconds + 30);
        }

        input.value = String(timerSeconds);
        renderTimer();
        queueSave();
    });

    resetButton.addEventListener('click', function() {
        currentMode = 'work';
        timerSeconds = DEFAULT_TIMER_SECONDS;
        currentWorkSessionSeconds = DEFAULT_TIMER_SECONDS;
        input.value = String(timerSeconds);
        renderTimer();
        renderMode();
        stopTimer();
        saveTimerState();
    });

    setWorkButton.addEventListener('click', function() {
        applyModePreset('work', DEFAULT_TIMER_SECONDS, input);
    });

    setBreakButton.addEventListener('click', function() {
        applyModePreset('break', DEFAULT_BREAK_SECONDS, input);
    });

    applyButton.addEventListener('click', function() {
        const parsed = Number.parseInt(input.value, 10);

        if (!Number.isInteger(parsed) || parsed < 0 || parsed > MAX_TIMER_SECONDS) {
            showSaveStatus('Enter a valid number (0-86400).');
            return;
        }

        timerSeconds = parsed;
        if (currentMode === 'work') {
            currentWorkSessionSeconds = parsed;
        }

        renderTimer();
        stopTimer();
        saveTimerState();
    });

    renderMode();
}

function applyModePreset(mode, seconds, input) {
    currentMode = normalizeMode(mode);
    timerSeconds = clampSeconds(seconds);

    if (currentMode === 'work') {
        currentWorkSessionSeconds = timerSeconds;
    }

    if (input) {
        input.value = String(timerSeconds);
    }

    stopTimer();
    renderMode();
    renderTimer();
    saveTimerState();
}

function handleSessionFinished() {
    if (currentMode === 'work') {
        completeWorkCycle();
        return;
    }

    completeBreakCycle();
}

async function completeWorkCycle() {
    const token = auth.getToken();
    const completedWorkSeconds = currentWorkSessionSeconds;

    if (!token || !window.api) {
        return;
    }

    try {
        const response = await window.api.completeWork(token, completedWorkSeconds);
        currentMode = normalizeMode(response.currentMode);
        timerSeconds = clampSeconds(response.remainingSeconds);
        writeTimerCache(response);

        renderMode();
        renderTimer();

        const input = document.getElementById('timer-seconds-input');
        if (input) {
            input.value = String(timerSeconds);
        }

        showSaveStatus('Work complete. Break started.');
    } catch (error) {
        if (error && error.status === 401) {
            await auth.logout();
            window.location.href = 'login.html';
            return;
        }

        const cached = readTimerCache();
        const priorWorkedSeconds = Number.isInteger(cached?.timeWorkedSeconds) ? cached.timeWorkedSeconds : 0;
        const priorPomodoros = Number.isInteger(cached?.todaysPomodoros) ? cached.todaysPomodoros : 0;

        currentMode = 'break';
        timerSeconds = DEFAULT_BREAK_SECONDS;
        writeTimerCache({
            remainingSeconds: timerSeconds,
            currentMode,
            lastWorkSeconds: completedWorkSeconds,
            todaysPomodoros: priorPomodoros,
            timeWorkedSeconds: priorWorkedSeconds + completedWorkSeconds,
            isLocalFallback: true
        });

        renderMode();
        renderTimer();

        const input = document.getElementById('timer-seconds-input');
        if (input) {
            input.value = String(timerSeconds);
        }

        showSaveStatus(getFriendlyTimerStatus(error, 'Work completed locally. Break started.'));
    }
}

async function completeBreakCycle() {
    const token = auth.getToken();

    if (!token || !window.api) {
        return;
    }

    try {
        const response = await window.api.completeBreak(token, currentWorkSessionSeconds);
        currentMode = normalizeMode(response.currentMode);
        timerSeconds = clampSeconds(response.remainingSeconds);
        currentWorkSessionSeconds = timerSeconds;
        writeTimerCache(response);

        renderMode();
        renderTimer();

        const input = document.getElementById('timer-seconds-input');
        if (input) {
            input.value = String(timerSeconds);
        }

        showSaveStatus('Break complete. Stats updated.');
    } catch (error) {
        if (error && error.status === 401) {
            await auth.logout();
            window.location.href = 'login.html';
            return;
        }

        const cached = readTimerCache();
        const priorPomodoros = Number.isInteger(cached?.todaysPomodoros) ? cached.todaysPomodoros : 0;
        const priorWorkedSeconds = Number.isInteger(cached?.timeWorkedSeconds) ? cached.timeWorkedSeconds : 0;

        currentMode = 'work';
        timerSeconds = DEFAULT_TIMER_SECONDS;
        currentWorkSessionSeconds = DEFAULT_TIMER_SECONDS;
        writeTimerCache({
            remainingSeconds: timerSeconds,
            currentMode,
            lastWorkSeconds: currentWorkSessionSeconds,
            todaysPomodoros: priorPomodoros + 1,
            timeWorkedSeconds: priorWorkedSeconds,
            isLocalFallback: true
        });
        renderMode();
        renderTimer();
        showSaveStatus(getFriendlyTimerStatus(error, 'Could not update break stats. Using local state.'));
    }
}

function stopTimer() {
    if (timerIntervalId) {
        clearInterval(timerIntervalId);
        timerIntervalId = null;
    }

    updateStartPauseLabel();
}

function updateStartPauseLabel() {
    const startPauseButton = document.getElementById('timer-start-pause');

    if (!startPauseButton) {
        return;
    }

    startPauseButton.textContent = timerIntervalId ? 'Pause' : 'Start';
}

function normalizeMode(mode) {
    return mode === 'break' ? 'break' : 'work';
}

function renderMode() {
    const modeLabel = document.getElementById('timer-mode-label');

    if (!modeLabel) {
        return;
    }

    modeLabel.textContent = currentMode === 'break' ? 'Break Session' : 'Work Session';
}

function clampSeconds(value) {
    const parsed = Number.parseInt(value, 10);

    if (!Number.isInteger(parsed)) {
        return DEFAULT_TIMER_SECONDS;
    }

    if (parsed < 0) {
        return 0;
    }

    if (parsed > MAX_TIMER_SECONDS) {
        return MAX_TIMER_SECONDS;
    }

    return parsed;
}

function formatSeconds(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function renderTimer() {
    const display = document.getElementById('timer-display');

    if (!display) {
        return;
    }

    display.textContent = formatSeconds(timerSeconds);
}

function queueSave() {
    if (saveTimeoutId) {
        clearTimeout(saveTimeoutId);
    }

    saveTimeoutId = window.setTimeout(function() {
        saveTimerState();
    }, 350);
}

async function saveTimerState() {
    const token = auth.getToken();

    if (!token || !window.api) {
        return;
    }

    try {
        const safeRemainingSeconds = clampSeconds(timerSeconds);
        const safeLastWorkSeconds = clampSeconds(currentWorkSessionSeconds || DEFAULT_TIMER_SECONDS);
        timerSeconds = safeRemainingSeconds;
        currentWorkSessionSeconds = safeLastWorkSeconds;

        const response = await window.api.updateTimer(token, safeRemainingSeconds, currentMode, safeLastWorkSeconds);
        writeTimerCache(response);
        showSaveStatus('Saved.');
    } catch (error) {
        if (error && error.status === 401) {
            await auth.logout();
            window.location.href = 'login.html';
            return;
        }

        writeTimerCache({
            remainingSeconds: timerSeconds,
            currentMode,
            lastWorkSeconds: currentWorkSessionSeconds,
            isLocalFallback: true
        });
        showSaveStatus(getFriendlyTimerStatus(error, 'Save failed. Saved locally only.'));
    }
}

function showSaveStatus(message) {
    const status = document.getElementById('timer-save-status');

    if (!status) {
        return;
    }

    status.textContent = message;
}

function getFriendlyTimerStatus(error, fallbackMessage) {
    const rawMessage = typeof error?.message === 'string' ? error.message : '';
    if (!rawMessage) {
        return fallbackMessage;
    }

    if (rawMessage.includes('remainingSeconds must be an integer between 0 and 86400.')) {
        return fallbackMessage;
    }

    return fallbackMessage;
}

function readTimerCache() {
    const key = getTimerCacheKey();

    try {
        const scopedRaw = localStorage.getItem(key);
        if (scopedRaw) {
            return JSON.parse(scopedRaw);
        }

        // Backward-compatible fallback for previously saved global cache.
        const legacyRaw = localStorage.getItem(TIMER_CACHE_KEY_PREFIX);
        return legacyRaw ? JSON.parse(legacyRaw) : null;
    } catch (_error) {
        localStorage.removeItem(key);
        localStorage.removeItem(TIMER_CACHE_KEY_PREFIX);
        return null;
    }
}

function writeTimerCache(state) {
    const key = getTimerCacheKey();
    const existing = readTimerCache();

    const payload = {
        remainingSeconds: clampSeconds(state?.remainingSeconds),
        currentMode: normalizeMode(state?.currentMode),
        lastWorkSeconds: clampSeconds(state?.lastWorkSeconds || currentWorkSessionSeconds || DEFAULT_TIMER_SECONDS),
        todaysPomodoros: Number.isInteger(state?.todaysPomodoros)
            ? state.todaysPomodoros
            : (Number.isInteger(existing?.todaysPomodoros) ? existing.todaysPomodoros : 0),
        timeWorkedSeconds: Number.isInteger(state?.timeWorkedSeconds)
            ? state.timeWorkedSeconds
            : (Number.isInteger(existing?.timeWorkedSeconds) ? existing.timeWorkedSeconds : 0),
        updatedAt: typeof state?.updatedAt === 'string' && state.updatedAt ? state.updatedAt : new Date().toISOString(),
        isLocalFallback: Boolean(state?.isLocalFallback)
    };

    localStorage.setItem(key, JSON.stringify(payload));
    // Remove legacy cache key once we have scoped cache.
    localStorage.removeItem(TIMER_CACHE_KEY_PREFIX);
}

function chooseInitialTimerState(remote, cached) {
    if (!remote) {
        return cached;
    }

    if (!cached) {
        return remote;
    }

    const remoteIsDefaultWork = normalizeMode(remote.currentMode) === 'work'
        && clampSeconds(remote.remainingSeconds) === DEFAULT_TIMER_SECONDS;
    const cachedMode = normalizeMode(cached.currentMode);
    const cachedRemaining = clampSeconds(cached.remainingSeconds);
    const cachedUpdatedTime = Date.parse(cached.updatedAt || '');
    const cacheIsRecent = Number.isFinite(cachedUpdatedTime)
        && (Date.now() - cachedUpdatedTime) < (30 * 60 * 1000);

    if (remoteIsDefaultWork && cachedMode === 'work' && cachedRemaining < DEFAULT_TIMER_SECONDS && cacheIsRecent) {
        return cached;
    }

    return remote;
}

function getTimerCacheKey() {
    const userId = auth.getCurrentUser()?.id;
    return userId ? `${TIMER_CACHE_KEY_PREFIX}_${userId}` : TIMER_CACHE_KEY_PREFIX;
}

function setupPageExitSave() {
    const flushState = function() {
        if (timerIntervalId || timerSeconds !== DEFAULT_TIMER_SECONDS || currentMode !== 'work') {
            saveTimerState();
        }
    };

    window.addEventListener('pagehide', flushState);
    window.addEventListener('beforeunload', flushState);
}
