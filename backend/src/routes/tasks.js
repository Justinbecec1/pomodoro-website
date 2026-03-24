import { Router } from 'express';
import { createSupabaseUserClient } from '../config/supabase.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const MAX_TITLE_LENGTH = 140;

function resolveDueAt(body) {
  const dueAtInput = body?.dueAt ?? body?.due_at;

  if (dueAtInput === undefined) {
    return { provided: false, value: null, error: null };
  }

  if (dueAtInput === null) {
    return { provided: true, value: null, error: null };
  }

  if (typeof dueAtInput !== 'string') {
    return { provided: true, value: null, error: 'Due date must be a valid ISO datetime string or null.' };
  }

  const trimmed = dueAtInput.trim();
  if (!trimmed) {
    return { provided: true, value: null, error: null };
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return { provided: true, value: null, error: 'Due date is invalid.' };
  }

  return { provided: true, value: parsed.toISOString(), error: null };
}

function normalizeDescription(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveDescription(body) {
  const description = normalizeDescription(body?.description);
  const title = normalizeDescription(body?.title);
  return description || title;
}

function toTaskResponse(task) {
  return {
    id: task.id,
    description: task.title,
    title: task.title,
    completed: task.completed,
    dueAt: task.due_at,
    createdAt: task.created_at,
    updatedAt: task.updated_at
  };
}

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const supabaseUserClient = createSupabaseUserClient(req.accessToken);
  const { data, error } = await supabaseUserClient
    .from('tasks')
    .select('id, title, completed, due_at, created_at, updated_at')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ tasks: (data || []).map(toTaskResponse) });
}));

router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const description = resolveDescription(req.body);
  const dueAt = resolveDueAt(req.body);

  if (!description) {
    return res.status(400).json({ error: 'Task description is required.' });
  }

  if (dueAt.error) {
    return res.status(400).json({ error: dueAt.error });
  }

  if (description.length > MAX_TITLE_LENGTH) {
    return res.status(400).json({ error: `Task description must be at most ${MAX_TITLE_LENGTH} characters.` });
  }

  const supabaseUserClient = createSupabaseUserClient(req.accessToken);
  const { data, error } = await supabaseUserClient
    .from('tasks')
    .insert({
      user_id: req.user.id,
      title: description,
      completed: false,
      due_at: dueAt.value,
      updated_at: new Date().toISOString()
    })
    .select('id, title, completed, due_at, created_at, updated_at')
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(201).json({ task: toTaskResponse(data) });
}));

router.put('/:taskId', requireAuth, asyncHandler(async (req, res) => {
  const descriptionProvided = Object.prototype.hasOwnProperty.call(req.body, 'description')
    || Object.prototype.hasOwnProperty.call(req.body, 'title');
  const completedProvided = Object.prototype.hasOwnProperty.call(req.body, 'completed');
  const dueAt = resolveDueAt(req.body);

  if (!descriptionProvided && !completedProvided && !dueAt.provided) {
    return res.status(400).json({ error: 'Provide description, completed, and/or dueAt to update.' });
  }

  if (dueAt.error) {
    return res.status(400).json({ error: dueAt.error });
  }

  const updates = {
    updated_at: new Date().toISOString()
  };

  if (descriptionProvided) {
    const description = resolveDescription(req.body);
    if (!description) {
      return res.status(400).json({ error: 'Task description cannot be empty.' });
    }

    if (description.length > MAX_TITLE_LENGTH) {
      return res.status(400).json({ error: `Task description must be at most ${MAX_TITLE_LENGTH} characters.` });
    }

    updates.title = description;
  }

  if (completedProvided) {
    updates.completed = Boolean(req.body.completed);
  }

  if (dueAt.provided) {
    updates.due_at = dueAt.value;
  }

  const supabaseUserClient = createSupabaseUserClient(req.accessToken);
  const { data, error } = await supabaseUserClient
    .from('tasks')
    .update(updates)
    .eq('id', req.params.taskId)
    .eq('user_id', req.user.id)
    .select('id, title, completed, due_at, created_at, updated_at')
    .maybeSingle();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  if (!data) {
    return res.status(404).json({ error: 'Task not found.' });
  }

  return res.status(200).json({ task: toTaskResponse(data) });
}));

router.delete('/:taskId', requireAuth, asyncHandler(async (req, res) => {
  const supabaseUserClient = createSupabaseUserClient(req.accessToken);
  const { data, error } = await supabaseUserClient
    .from('tasks')
    .delete()
    .eq('id', req.params.taskId)
    .eq('user_id', req.user.id)
    .select('id')
    .maybeSingle();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  if (!data) {
    return res.status(404).json({ error: 'Task not found.' });
  }

  return res.status(200).json({ message: 'Task deleted.' });
}));

export default router;
