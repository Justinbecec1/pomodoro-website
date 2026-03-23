import { Router } from 'express';
import { createSupabaseAuthClient, createSupabaseUserClient, supabaseAdminClient } from '../config/supabase.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function normalizeDisplayName(displayName) {
  return typeof displayName === 'string' ? displayName.trim() : '';
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post('/signup', asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const displayName = normalizeDisplayName(req.body.displayName);

  if (!email || !password || !displayName) {
    return res.status(400).json({ error: 'Email, password, and displayName are required.' });
  }

  if (!validateEmail(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const supabaseAuthClient = createSupabaseAuthClient();

  const { data, error } = await supabaseAuthClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName
      }
    }
  });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  if (data.user) {
    const { error: profileError } = await supabaseAdminClient
      .from('profiles')
      .upsert({
        id: data.user.id,
        email: data.user.email,
        display_name: displayName
      });

    if (profileError) {
      return res.status(500).json({ error: profileError.message });
    }
  }

  const requiresEmailConfirmation = !data.session;

  return res.status(201).json({
    message: requiresEmailConfirmation
      ? 'Signup successful. Check your email to confirm your account.'
      : 'Signup successful.',
    requiresEmailConfirmation,
    user: data.user,
    session: data.session
  });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  if (!validateEmail(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }

  const supabaseAuthClient = createSupabaseAuthClient();

  const { data, error } = await supabaseAuthClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    return res.status(401).json({ error: error.message });
  }

  return res.status(200).json({
    message: 'Login successful.',
    user: data.user,
    session: data.session
  });
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const supabaseUserClient = createSupabaseUserClient(req.accessToken);
  const { data, error } = await supabaseUserClient
    .from('profiles')
    .select('id, email, display_name, created_at')
    .eq('id', req.user.id)
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ user: data });
}));

export default router;
