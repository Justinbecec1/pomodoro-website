let currentRange = 'day';

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
        // Keep user on page during transient profile failures.
    }

    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }

    setupRangeButtons();
    setupNoteSave();
    await loadProgressSummary(currentRange);
});

function setupRangeButtons() {
    const buttons = document.querySelectorAll('.progress-range-btn');

    buttons.forEach(function(button) {
        button.addEventListener('click', async function() {
            const nextRange = button.dataset.range;
            if (!nextRange || nextRange === currentRange) {
                return;
            }

            currentRange = nextRange;
            updateRangeButtonState();
            setNoteStatus('Loading...');
            await loadProgressSummary(currentRange);
        });
    });
}

function updateRangeButtonState() {
    const buttons = document.querySelectorAll('.progress-range-btn');
    buttons.forEach(function(button) {
        const isActive = button.dataset.range === currentRange;
        button.classList.toggle('active', isActive);
    });
}

function setupNoteSave() {
    const saveButton = document.getElementById('progress-note-save');

    if (!saveButton) {
        return;
    }

    saveButton.addEventListener('click', async function() {
        const token = auth.getToken();
        const noteInput = document.getElementById('progress-note-input');

        if (!token || !noteInput || !window.api) {
            return;
        }

        try {
            const result = await window.api.saveProgressNote(token, currentRange, noteInput.value || '');
            renderSavedNotes(currentRange, result.note || noteInput.value || '', result.noteUpdatedAt || null);
            setNoteStatus(result.message || 'Note saved.');
        } catch (error) {
            await handleProgressError(error, 'Could not save note.');
        }
    });
}

async function loadProgressSummary(range) {
    const token = auth.getToken();

    if (!token || !window.api) {
        return;
    }

    try {
        const summary = await window.api.getProgressSummary(token, range);
        renderSummary(summary);
        setNoteStatus('');
    } catch (error) {
        await handleProgressError(error, 'Could not load progress data.');
    }
}

function renderSummary(summary) {
    const tasksCompletedNode = document.getElementById('progress-tasks-completed');
    const timeSpentNode = document.getElementById('progress-time-spent');
    const sinceNode = document.getElementById('progress-since');
    const noteInput = document.getElementById('progress-note-input');

    if (tasksCompletedNode) {
        tasksCompletedNode.textContent = String(summary.tasksCompleted || 0);
    }

    if (timeSpentNode) {
        timeSpentNode.textContent = formatDuration(summary.timeSpentSeconds || 0);
    }

    if (sinceNode) {
        sinceNode.textContent = summary.sinceDate
            ? `Showing data since ${summary.sinceDate}`
            : 'Showing data for selected range.';
    }

    if (noteInput) {
        noteInput.value = summary.note || '';
    }

    renderSavedNotes(currentRange, summary.note || '', summary.noteUpdatedAt || null);
}

function renderSavedNotes(range, note, noteUpdatedAt) {
    const list = document.getElementById('progress-saved-list');
    if (!list) {
        return;
    }

    list.innerHTML = '';

    const trimmed = String(note || '').trim();
    if (!trimmed) {
        const empty = document.createElement('li');
        empty.className = 'progress-saved-empty';
        empty.textContent = `No saved note for ${rangeLabel(range)} yet.`;
        list.appendChild(empty);
        return;
    }

    const item = document.createElement('li');
    item.className = 'progress-saved-item';

    const title = document.createElement('p');
    title.className = 'progress-saved-title';
    title.textContent = `${rangeLabel(range)} Note`;

    const body = document.createElement('p');
    body.className = 'progress-saved-content';
    body.textContent = trimmed;

    const meta = document.createElement('p');
    meta.className = 'progress-saved-meta';
    meta.textContent = noteUpdatedAt
        ? `Saved: ${new Date(noteUpdatedAt).toLocaleString()}`
        : 'Saved to database';

    item.appendChild(title);
    item.appendChild(body);
    item.appendChild(meta);
    list.appendChild(item);
}

function rangeLabel(range) {
    if (range === 'day') {
        return 'Past Day';
    }

    if (range === 'month') {
        return 'Past Month';
    }

    return 'Past Week';
}

function formatDuration(totalSeconds) {
    const seconds = Math.max(0, Number.parseInt(totalSeconds, 10) || 0);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }

    return `${minutes}m`;
}

function setNoteStatus(message) {
    const statusNode = document.getElementById('progress-note-status');
    if (!statusNode) {
        return;
    }

    statusNode.textContent = message;
}

async function handleProgressError(error, fallbackMessage) {
    if (error && error.status === 401) {
        await auth.logout();
        window.location.href = 'login.html';
        return;
    }

    const message = typeof error?.message === 'string' ? error.message : '';

    if (message.includes("Could not find the table 'public.activity_daily'")) {
        setNoteStatus('Progress tables are not set up yet. Run supabase/schema.sql and reload this page.');
        return;
    }

    setNoteStatus(message || fallbackMessage);
}
