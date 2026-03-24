import { Router } from 'express';
import { createSupabaseUserClient } from '../config/supabase.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const MAX_TITLE_LENGTH = 140;

function normalizeTitle(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function toTaskResponse(task) {
  return {
    id: task.id,
    title: task.title,
    completed: task.completed,
    createdAt: task.created_at,
    updatedAt: task.updated_at
  };
}

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const supabaseUserClient = createSupabaseUserClient(req.accessToken);
  const { data, error } = await supabaseUserClient
    .from('tasks')
    .select('id, title, completed, created_at, updated_at')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ tasks: (data || []).map(toTaskResponse) });
}));

router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const title = normalizeTitle(req.body.title);

  if (!title) {
    return res.status(400).json({ error: 'Task title is required.' });
  }

  if (title.length > MAX_TITLE_LENGTH) {
    return res.status(400).json({ error: `Task title must be at most ${MAX_TITLE_LENGTH} characters.` });
  }

  const supabaseUserClient = createSupabaseUserClient(req.accessToken);
  const { data, error } = await supabaseUserClient
    .from('tasks')
    .insert({
      user_id: req.user.id,
      title,
      completed: false,
      updated_at: new Date().toISOString()
    })
    .select('id, title, completed, created_at, updated_at')
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(201).json({ task: toTaskResponse(data) });
}));

router.put('/:taskId', requireAuth, asyncHandler(async (req, res) => {
  const titleProvided = Object.prototype.hasOwnProperty.call(req.body, 'title');
  const completedProvided = Object.prototype.hasOwnProperty.call(req.body, 'completed');

  if (!titleProvided && !completedProvided) {
    return res.status(400).json({ error: 'Provide title and/or completed to update.' });
  }

  const updates = {
    updated_at: new Date().toISOString()
  };

  if (titleProvided) {
    const title = normalizeTitle(req.body.title);
    if (!title) {
      return res.status(400).json({ error: 'Task title cannot be empty.' });
    }

    if (title.length > MAX_TITLE_LENGTH) {
      return res.status(400).json({ error: `Task title must be at most ${MAX_TITLE_LENGTH} characters.` });
    }

    updates.title = title;
  }

  if (completedProvided) {
    updates.completed = Boolean(req.body.completed);
  }

  const supabaseUserClient = createSupabaseUserClient(req.accessToken);
  const { data, error } = await supabaseUserClient
    .from('tasks')
    .update(updates)
    .eq('id', req.params.taskId)
    .eq('user_id', req.user.id)
    .select('id, title, completed, created_at, updated_at')
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
