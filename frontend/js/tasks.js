const MAX_VISIBLE_TASKS = 10;
const TASKS_API_BASE_URL = window.APP_API_BASE_URL || 'http://localhost:3000/api';
let editingTaskId = null;

function formatDueInText(dueAt) {
    if (!dueAt) {
        return '';
    }

    const dueDate = new Date(dueAt);
    if (Number.isNaN(dueDate.getTime())) {
        return '';
    }

    const now = new Date();
    const diffMs = dueDate.getTime() - now.getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    const absDays = Math.ceil(Math.abs(diffMs) / dayMs);

    if (diffMs < 0) {
        if (absDays <= 1) {
            return 'Overdue';
        }
        return `Overdue ${absDays}d`;
    }

    if (absDays <= 1) {
        return 'Due today';
    }

    return `Due in ${absDays}d`;
}

async function taskRequest(path, token, options = {}) {
    const response = await fetch(`${TASKS_API_BASE_URL}${path}`, {
        method: options.method || 'GET',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    const payload = await response.json().catch(function() {
        return {};
    });

    if (!response.ok) {
        const error = new Error(payload.error || 'Request failed.');
        error.status = response.status;
        throw error;
    }

    return payload;
}

function getTasksApi(token) {
    return taskRequest('/tasks', token);
}

function createTaskApi(token, description) {
    return taskRequest('/tasks', token, {
        method: 'POST',
        body: { description, title: description }
    });
}

function updateTaskApi(token, taskId, updates) {
    const payload = { ...updates };
    if (typeof payload.description === 'string' && !payload.title) {
        payload.title = payload.description;
    }

    return taskRequest(`/tasks/${taskId}`, token, {
        method: 'PUT',
        body: payload
    });
}

function deleteTaskApi(token, taskId) {
    return taskRequest(`/tasks/${taskId}`, token, {
        method: 'DELETE'
    });
}

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
        // Keep the user on tasks tab if profile refresh briefly fails.
    }

    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }

    setupTaskForm();
    await loadTasks();
});

function setupTaskForm() {
    const form = document.getElementById('task-form');
    const input = document.getElementById('task-input');
    const submitButton = document.getElementById('task-submit-button');
    const cancelEditButton = document.getElementById('task-cancel-edit');

    if (!form || !input || !submitButton || !cancelEditButton) {
        return;
    }

    input.disabled = false;
    input.readOnly = false;
    resetEditState();

    input.addEventListener('input', function() {
        setTaskStatus('');
    });

    form.addEventListener('submit', async function(event) {
        event.preventDefault();

        const description = String(input.value || '').trim();
        if (!description) {
            setTaskStatus('Enter a task description first.');
            return;
        }

        const token = auth.getToken();
        if (!token) {
            return;
        }

        try {
            if (editingTaskId) {
                await updateTaskApi(token, editingTaskId, { description });
                setTaskStatus('Task updated.');
            } else {
                await createTaskApi(token, description);
                setTaskStatus('Task added.');
            }

            resetEditState();
            await loadTasks();
        } catch (error) {
            const errorMessage = typeof error?.message === 'string' ? error.message : '';

            // If edit target no longer exists, recover by creating a new task with current text.
            if (editingTaskId && error?.status === 404) {
                try {
                    await createTaskApi(token, description);
                    setTaskStatus('Task added.');
                    resetEditState();
                    await loadTasks();
                    return;
                } catch (createError) {
                    await handleTaskError(createError, 'Could not add task.');
                    return;
                }
            }

            // Some stale clients/servers can still bounce with required-message despite entered text.
            if (!editingTaskId && description && errorMessage.includes('Task description is required.')) {
                try {
                    await createTaskApi(token, description);
                    setTaskStatus('Task added.');
                    resetEditState();
                    await loadTasks();
                    return;
                } catch (retryError) {
                    await handleTaskError(retryError, 'Could not add task.');
                    return;
                }
            }

            await handleTaskError(error, editingTaskId ? 'Could not edit task.' : 'Could not add task.');
        }
    });

    cancelEditButton.addEventListener('click', function() {
        resetEditState();
        setTaskStatus('Edit canceled.');
    });
}

async function loadTasks() {
    const token = auth.getToken();
    const list = document.getElementById('task-list');

    if (!token || !list) {
        return;
    }

    try {
        const response = await getTasksApi(token);
        renderTaskList(Array.isArray(response.tasks) ? response.tasks : []);
    } catch (error) {
        await handleTaskError(error, 'Could not load tasks.');
    }
}

function renderTaskList(tasks) {
    const list = document.getElementById('task-list');
    const shell = document.querySelector('.task-list-shell');

    if (!list || !shell) {
        return;
    }

    list.innerHTML = '';

    if (tasks.length === 0) {
        return;
    }

    // Keep roughly 10 tasks visible, with scroll for the rest.
    shell.style.maxHeight = `${MAX_VISIBLE_TASKS * 54}px`;

    tasks.forEach(function(task) {
        const item = document.createElement('li');
        item.className = 'task-item';

        const left = document.createElement('div');
        left.className = 'task-left';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'task-checkbox';
        checkbox.checked = Boolean(task.completed);
        checkbox.addEventListener('change', function() {
            onToggleTask(task, checkbox);
        });

        const title = document.createElement('span');
        title.className = `task-title${task.completed ? ' completed' : ''}`;
        title.textContent = task.description || task.title || '';

        left.appendChild(checkbox);
        left.appendChild(title);

        const actions = document.createElement('div');
        actions.className = 'task-actions';

        const dueText = formatDueInText(task.dueAt);
        if (dueText) {
            const dueBadge = document.createElement('span');
            dueBadge.className = 'task-due-badge';
            dueBadge.textContent = dueText;
            actions.appendChild(dueBadge);
        }

        const dueButton = document.createElement('button');
        dueButton.type = 'button';
        dueButton.className = 'task-btn due';
        dueButton.textContent = 'Due';
        dueButton.addEventListener('click', function() {
            onSetDueTask(task);
        });

        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.className = 'task-btn edit';
        editButton.textContent = 'Edit';
        editButton.addEventListener('click', function() {
            onEditTask(task);
        });

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'task-btn delete';
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', function() {
            onDeleteTask(task);
        });

        actions.appendChild(dueButton);
        actions.appendChild(editButton);
        actions.appendChild(deleteButton);

        item.appendChild(left);
        item.appendChild(actions);
        list.appendChild(item);
    });
}

async function onSetDueTask(task) {
    const currentDue = task.dueAt;
    const defaultDate = currentDue ? String(currentDue).slice(0, 10) : '';
    const userInput = window.prompt('Set due date (YYYY-MM-DD). Leave blank to remove due date.', defaultDate);
    const token = auth.getToken();

    if (!token) {
        return;
    }

    if (userInput === null) {
        return;
    }

    const trimmed = String(userInput).trim();
    if (!trimmed) {
        try {
            await updateTaskApi(token, task.id, { dueAt: null });
            setTaskStatus('Due date removed.');
            await loadTasks();
        } catch (error) {
            await handleTaskError(error, 'Could not remove due date.');
        }
        return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        setTaskStatus('Use YYYY-MM-DD for due date.');
        return;
    }

    const candidateDate = new Date(`${trimmed}T23:59:59`);
    if (Number.isNaN(candidateDate.getTime())) {
        setTaskStatus('That due date is invalid.');
        return;
    }

    try {
        await updateTaskApi(token, task.id, { dueAt: candidateDate.toISOString() });
        setTaskStatus('Due date saved.');
        await loadTasks();
    } catch (error) {
        await handleTaskError(error, 'Could not save due date.');
    }
}

async function onToggleTask(task, checkbox) {
    const token = auth.getToken();
    if (!token) {
        return;
    }

    const nextCompleted = checkbox.checked;

    try {
        await updateTaskApi(token, task.id, { completed: nextCompleted });
        setTaskStatus(nextCompleted ? 'Task completed.' : 'Task reopened.');
        await loadTasks();
    } catch (error) {
        checkbox.checked = !nextCompleted;
        await handleTaskError(error, 'Could not update task.');
    }
}

async function onEditTask(task) {
    const input = document.getElementById('task-input');
    const submitButton = document.getElementById('task-submit-button');
    const cancelEditButton = document.getElementById('task-cancel-edit');

    if (!input || !submitButton || !cancelEditButton) {
        return;
    }

    editingTaskId = task.id;
    input.value = task.description || task.title || '';
    input.placeholder = 'Edit task description...';
    submitButton.textContent = 'Save Edit';
    cancelEditButton.hidden = false;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    setTaskStatus('Editing task description. Update text and click Save Edit.');
}

async function onDeleteTask(task) {
    const token = auth.getToken();
    if (!token) {
        return;
    }

    const confirmed = window.confirm('Delete this task?');
    if (!confirmed) {
        return;
    }

    try {
        await deleteTaskApi(token, task.id);
        setTaskStatus('Task deleted.');
        await loadTasks();
    } catch (error) {
        await handleTaskError(error, 'Could not delete task.');
    }
}

function setTaskStatus(message) {
    const status = document.getElementById('task-status');
    if (!status) {
        return;
    }

    status.textContent = message;
}

async function handleTaskError(error, fallbackMessage) {
    if (error && error.status === 401) {
        await auth.logout();
        window.location.href = 'login.html';
        return;
    }

    const message = typeof error?.message === 'string' ? error.message : '';
    if (message.includes("Could not find the table 'public.tasks'")) {
        setTaskStatus('Tasks table is not set up yet. Run the SQL in supabase/schema.sql, then reload this page.');
        return;
    }

    setTaskStatus(message || fallbackMessage);
}

function resetEditState() {
    const input = document.getElementById('task-input');
    const submitButton = document.getElementById('task-submit-button');
    const cancelEditButton = document.getElementById('task-cancel-edit');

    editingTaskId = null;

    if (input) {
        input.value = '';
        input.placeholder = 'Type your task description here...';
    }

    if (submitButton) {
        submitButton.textContent = 'Add Task';
    }

    if (cancelEditButton) {
        cancelEditButton.hidden = true;
    }
}
