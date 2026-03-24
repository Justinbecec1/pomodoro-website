import { Router } from 'express';
import { createSupabaseUserClient } from '../config/supabase.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const ALLOWED_RANGES = new Set(['day', 'week', 'month']);

function parseRange(rawRange) {
  const value = typeof rawRange === 'string' ? rawRange.trim().toLowerCase() : '';
  return ALLOWED_RANGES.has(value) ? value : 'week';
}

function getRangeDays(range) {
  if (range === 'day') {
    return 1;
  }

  if (range === 'month') {
    return 30;
  }

  return 7;
}

function getSinceDateIso(days) {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));
  return since.toISOString().slice(0, 10);
}

function previousDateIso(isoDate) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function calculateCurrentStreak(activityDates) {
  const dateSet = new Set(activityDates || []);
  if (dateSet.size === 0) {
    return 0;
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const yesterdayIso = previousDateIso(todayIso);

  // Start from today if there is activity, otherwise allow the streak to continue from yesterday.
  let cursor = dateSet.has(todayIso) ? todayIso : yesterdayIso;
  let streak = 0;

  while (dateSet.has(cursor)) {
    streak += 1;
    cursor = previousDateIso(cursor);
  }

  return streak;
}

router.post('/track', requireAuth, asyncHandler(async (req, res) => {
  const secondsRaw = Number.parseInt(req.body.seconds, 10);
  const seconds = Number.isInteger(secondsRaw) ? Math.max(5, Math.min(secondsRaw, 300)) : 30;
  const nowIso = new Date().toISOString();
  const todayIso = nowIso.slice(0, 10);

  const supabaseUserClient = createSupabaseUserClient(req.accessToken);
  const { data: existing, error: readError } = await supabaseUserClient
    .from('activity_daily')
    .select('seconds_spent')
    .eq('user_id', req.user.id)
    .eq('activity_date', todayIso)
    .maybeSingle();

  if (readError) {
    return res.status(500).json({ error: readError.message });
  }

  const nextSeconds = (existing?.seconds_spent || 0) + seconds;
  const { error: upsertError } = await supabaseUserClient
    .from('activity_daily')
    .upsert({
      user_id: req.user.id,
      activity_date: todayIso,
      seconds_spent: nextSeconds,
      updated_at: nowIso
    });

  if (upsertError) {
    return res.status(500).json({ error: upsertError.message });
  }

  return res.status(200).json({ message: 'Tracked.', secondsAdded: seconds });
}));

router.get('/summary', requireAuth, asyncHandler(async (req, res) => {
  const range = parseRange(req.query.range);
  const days = getRangeDays(range);
  const sinceDate = getSinceDateIso(days);

  const supabaseUserClient = createSupabaseUserClient(req.accessToken);

  const { data: completedRows, error: tasksError } = await supabaseUserClient
    .from('tasks')
    .select('id')
    .eq('user_id', req.user.id)
    .eq('completed', true)
    .gte('updated_at', `${sinceDate}T00:00:00.000Z`);

  if (tasksError) {
    return res.status(500).json({ error: tasksError.message });
  }

  const { data: activityRows, error: activityError } = await supabaseUserClient
    .from('activity_daily')
    .select('seconds_spent')
    .eq('user_id', req.user.id)
    .gte('activity_date', sinceDate);

  if (activityError) {
    return res.status(500).json({ error: activityError.message });
  }

  const { data: noteRow, error: noteError } = await supabaseUserClient
    .from('progress_notes')
    .select('content, updated_at')
    .eq('user_id', req.user.id)
    .eq('range_key', range)
    .maybeSingle();

  if (noteError) {
    return res.status(500).json({ error: noteError.message });
  }

  const timeSpentSeconds = (activityRows || []).reduce((sum, row) => sum + (row.seconds_spent || 0), 0);

  return res.status(200).json({
    range,
    sinceDate,
    tasksCompleted: (completedRows || []).length,
    timeSpentSeconds,
    note: noteRow?.content || '',
    noteUpdatedAt: noteRow?.updated_at || null
  });
}));

router.get('/completed-count', requireAuth, asyncHandler(async (req, res) => {
  const range = parseRange(req.query.range);
  const days = getRangeDays(range);
  const sinceDate = getSinceDateIso(days);

  const supabaseUserClient = createSupabaseUserClient(req.accessToken);
  const { data, error } = await supabaseUserClient
    .from('tasks')
    .select('id')
    .eq('user_id', req.user.id)
    .eq('completed', true)
    .gte('updated_at', `${sinceDate}T00:00:00.000Z`);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ range, tasksCompleted: (data || []).length });
}));

router.get('/streak', requireAuth, asyncHandler(async (req, res) => {
  const supabaseUserClient = createSupabaseUserClient(req.accessToken);
  const { data, error } = await supabaseUserClient
    .from('activity_daily')
    .select('activity_date, seconds_spent')
    .eq('user_id', req.user.id)
    .gt('seconds_spent', 0);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const uniqueDates = Array.from(
    new Set((data || []).map((row) => row.activity_date).filter(Boolean))
  );
  const currentStreakDays = calculateCurrentStreak(uniqueDates);

  return res.status(200).json({ currentStreakDays });
}));

router.post('/notes', requireAuth, asyncHandler(async (req, res) => {
  const range = parseRange(req.body.range);
  const contentRaw = typeof req.body.content === 'string' ? req.body.content : '';
  const content = contentRaw.slice(0, 4000);
  const nowIso = new Date().toISOString();

  const supabaseUserClient = createSupabaseUserClient(req.accessToken);
  const { data, error } = await supabaseUserClient
    .from('progress_notes')
    .upsert({
      user_id: req.user.id,
      range_key: range,
      content,
      updated_at: nowIso
    })
    .select('content, updated_at')
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({
    message: 'Note saved.',
    note: data.content,
    noteUpdatedAt: data.updated_at,
    range
  });
}));

export default router;
