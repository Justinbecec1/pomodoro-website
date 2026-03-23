import { Router } from 'express';
import { createSupabaseUserClient } from '../config/supabase.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const DEFAULT_WORK_SECONDS = 1500;
const MAX_TIMER_SECONDS = 86400;
const VALID_MODES = new Set(['work', 'break']);

function todayUtcDateString() {
  return new Date().toISOString().slice(0, 10);
}

function toNonNegativeInteger(value, fallback) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function toPositiveInteger(value, fallback) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function normalizeMode(value, fallback = 'work') {
  return VALID_MODES.has(value) ? value : fallback;
}

function parseMode(value) {
  if (typeof value !== 'string') {
    return undefined;
  }

  return VALID_MODES.has(value) ? value : null;
}

function parseLastWorkSeconds(value) {
  if (typeof value === 'undefined') {
    return undefined;
  }

  const parsed = normalizeSeconds(value);
  if (parsed === null || parsed === 0) {
    return null;
  }

  return parsed;
}

function createDefaultState(userId) {
  return {
    user_id: userId,
    remaining_seconds: DEFAULT_WORK_SECONDS,
    current_mode: 'work',
    todays_pomodoros: 0,
    time_worked_seconds: 0,
    stats_date: todayUtcDateString(),
    last_work_seconds: DEFAULT_WORK_SECONDS,
    updated_at: new Date().toISOString()
  };
}

function normalizeState(state, userId) {
  const defaultState = createDefaultState(userId);

  return {
    user_id: userId,
    remaining_seconds: normalizeSeconds(state?.remaining_seconds) ?? defaultState.remaining_seconds,
    current_mode: normalizeMode(state?.current_mode, defaultState.current_mode),
    todays_pomodoros: toNonNegativeInteger(state?.todays_pomodoros, 0),
    time_worked_seconds: toNonNegativeInteger(state?.time_worked_seconds, 0),
    stats_date: typeof state?.stats_date === 'string' && state.stats_date ? state.stats_date : defaultState.stats_date,
    last_work_seconds: toPositiveInteger(state?.last_work_seconds, DEFAULT_WORK_SECONDS),
    updated_at: typeof state?.updated_at === 'string' && state.updated_at ? state.updated_at : defaultState.updated_at
  };
}

function resetStatsForNewDay(state) {
  const today = todayUtcDateString();

  if (state.stats_date === today) {
    return { state, changed: false };
  }

  return {
    state: {
      ...state,
      todays_pomodoros: 0,
      time_worked_seconds: 0,
      stats_date: today,
      updated_at: new Date().toISOString()
    },
    changed: true
  };
}

function toTimerResponse(state) {
  return {
    remainingSeconds: state.remaining_seconds,
    currentMode: state.current_mode,
    todaysPomodoros: state.todays_pomodoros,
    timeWorkedSeconds: state.time_worked_seconds,
    statsDate: state.stats_date,
    lastWorkSeconds: state.last_work_seconds,
    updatedAt: state.updated_at
  };
}

function normalizeSeconds(value) {
  const seconds = Number(value);

  if (!Number.isInteger(seconds)) {
    return null;
  }

  if (seconds < 0 || seconds > MAX_TIMER_SECONDS) {
    return null;
  }

  return seconds;
}

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const supabaseUserClient = createSupabaseUserClient(req.accessToken);
  const { data, error } = await supabaseUserClient
    .from('timer_state')
    .select('*')
    .eq('user_id', req.user.id)
    .maybeSingle();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  if (!data) {
    const newState = createDefaultState(req.user.id);
    const { error: insertError } = await supabaseUserClient
      .from('timer_state')
      .insert(newState);

    if (insertError) {
      return res.status(500).json({ error: insertError.message });
    }

    return res.status(200).json(toTimerResponse(newState));
  }

  let state = normalizeState(data, req.user.id);
  const resetResult = resetStatsForNewDay(state);
  state = resetResult.state;

  if (resetResult.changed) {
    const { error: resetError } = await supabaseUserClient
      .from('timer_state')
      .upsert(state, { onConflict: 'user_id' });

    if (resetError) {
      return res.status(500).json({ error: resetError.message });
    }
  }

  return res.status(200).json(toTimerResponse(state));
}));

router.put('/', requireAuth, asyncHandler(async (req, res) => {
  const remainingSeconds = normalizeSeconds(req.body.remainingSeconds);
  const currentMode = parseMode(req.body.currentMode);
  const lastWorkSeconds = parseLastWorkSeconds(req.body.lastWorkSeconds);

  if (remainingSeconds === null) {
    return res.status(400).json({ error: 'remainingSeconds must be an integer between 0 and 86400.' });
  }

  if (currentMode === null) {
    return res.status(400).json({ error: "currentMode must be either 'work' or 'break'." });
  }

  if (lastWorkSeconds === null) {
    return res.status(400).json({ error: 'lastWorkSeconds must be an integer between 1 and 86400.' });
  }

  const supabaseUserClient = createSupabaseUserClient(req.accessToken);
  const { data: existingData, error: existingError } = await supabaseUserClient
    .from('timer_state')
    .select('*')
    .eq('user_id', req.user.id)
    .maybeSingle();

  if (existingError) {
    return res.status(500).json({ error: existingError.message });
  }

  let baseState = normalizeState(existingData, req.user.id);
  baseState = resetStatsForNewDay(baseState).state;

  const payload = {
    ...baseState,
    remaining_seconds: remainingSeconds,
    current_mode: currentMode || baseState.current_mode,
    last_work_seconds: lastWorkSeconds || baseState.last_work_seconds,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabaseUserClient
    .from('timer_state')
    .upsert(payload, { onConflict: 'user_id' });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json(toTimerResponse(payload));
}));

router.post('/complete-break', requireAuth, asyncHandler(async (req, res) => {
  const workedSeconds = parseLastWorkSeconds(req.body.workedSeconds);

  if (workedSeconds === null) {
    return res.status(400).json({ error: 'workedSeconds must be an integer between 1 and 86400.' });
  }

  const supabaseUserClient = createSupabaseUserClient(req.accessToken);
  const { data, error } = await supabaseUserClient
    .from('timer_state')
    .select('*')
    .eq('user_id', req.user.id)
    .maybeSingle();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  let state = normalizeState(data, req.user.id);
  state = resetStatsForNewDay(state).state;
  const incrementSeconds = workedSeconds || state.last_work_seconds || DEFAULT_WORK_SECONDS;

  const payload = {
    ...state,
    current_mode: 'work',
    remaining_seconds: DEFAULT_WORK_SECONDS,
    todays_pomodoros: state.todays_pomodoros + 1,
    time_worked_seconds: state.time_worked_seconds + incrementSeconds,
    last_work_seconds: DEFAULT_WORK_SECONDS,
    updated_at: new Date().toISOString()
  };

  const { error: upsertError } = await supabaseUserClient
    .from('timer_state')
    .upsert(payload, { onConflict: 'user_id' });

  if (upsertError) {
    return res.status(500).json({ error: upsertError.message });
  }

  return res.status(200).json(toTimerResponse(payload));
}));

export default router;
