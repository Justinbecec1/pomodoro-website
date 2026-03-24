const MAX_VISIBLE_TASKS = 10;

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

    if (!form || !input) {
        return;
    }

    form.addEventListener('submit', async function(event) {
        event.preventDefault();

        const title = input.value.trim();
        if (!title) {
            setTaskStatus('Enter a task title first.');
            return;
        }

        const token = auth.getToken();
        if (!token || !window.api) {
            return;
        }

        try {
            await window.api.createTask(token, title);
            input.value = '';
            setTaskStatus('Task added.');
            await loadTasks();
        } catch (error) {
            await handleTaskError(error, 'Could not add task.');
        }
    });
}

async function loadTasks() {
    const token = auth.getToken();
    const list = document.getElementById('task-list');

    if (!token || !window.api || !list) {
        return;
    }

    try {
        const response = await window.api.getTasks(token);
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
        const empty = document.createElement('li');
        empty.className = 'task-empty';
        empty.textContent = 'No tasks yet. Add your first task above.';
        list.appendChild(empty);
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
        title.textContent = task.title;

        left.appendChild(checkbox);
        left.appendChild(title);

        const actions = document.createElement('div');
        actions.className = 'task-actions';

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

        actions.appendChild(editButton);
        actions.appendChild(deleteButton);

        item.appendChild(left);
        item.appendChild(actions);
        list.appendChild(item);
    });
}

async function onToggleTask(task, checkbox) {
    const token = auth.getToken();
    if (!token || !window.api) {
        return;
    }

    const nextCompleted = checkbox.checked;
    const confirmed = window.confirm(nextCompleted ? 'Mark this task as completed?' : 'Mark this task as not completed?');

    if (!confirmed) {
        checkbox.checked = !nextCompleted;
        return;
    }

    try {
        await window.api.updateTask(token, task.id, { completed: nextCompleted });
        setTaskStatus(nextCompleted ? 'Task completed.' : 'Task reopened.');
        await loadTasks();
    } catch (error) {
        checkbox.checked = !nextCompleted;
        await handleTaskError(error, 'Could not update task.');
    }
}

async function onEditTask(task) {
    const token = auth.getToken();
    if (!token || !window.api) {
        return;
    }

    const updatedTitle = window.prompt('Edit task title:', task.title);
    if (updatedTitle === null) {
        return;
    }

    const title = updatedTitle.trim();
    if (!title) {
        setTaskStatus('Task title cannot be empty.');
        return;
    }

    try {
        await window.api.updateTask(token, task.id, { title });
        setTaskStatus('Task updated.');
        await loadTasks();
    } catch (error) {
        await handleTaskError(error, 'Could not edit task.');
    }
}

async function onDeleteTask(task) {
    const token = auth.getToken();
    if (!token || !window.api) {
        return;
    }

    const confirmed = window.confirm('Delete this task?');
    if (!confirmed) {
        return;
    }

    try {
        await window.api.deleteTask(token, task.id);
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
