import { Router } from 'express';
import { createSupabaseAuthClient, createSupabaseUserClient, supabaseAdminClient } from '../config/supabase.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const AVATAR_BUCKET = process.env.SUPABASE_AVATAR_BUCKET || 'avatars';
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

function decodeBase64(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  try {
    return Buffer.from(value, 'base64');
  } catch (_error) {
    return null;
  }
}

async function createAvatarSignedUrl(path) {
  if (!path) {
    return null;
  }

  const { data, error } = await supabaseAdminClient.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(path, 60 * 60);

  if (error) {
    return null;
  }

  return data?.signedUrl || null;
}

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function normalizeDisplayName(displayName) {
  return typeof displayName === 'string' ? displayName.trim() : '';
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function resolveDisplayName(user, fallbackEmail) {
  const fromMetadata = user?.user_metadata?.display_name;
  if (typeof fromMetadata === 'string' && fromMetadata.trim()) {
    return fromMetadata.trim();
  }

  return normalizeDisplayName(fallbackEmail) || fallbackEmail;
}

async function ensureProfileRow(user, fallbackDisplayName) {
  if (!user?.id) {
    return;
  }

  await supabaseAdminClient
    .from('profiles')
    .upsert({
      id: user.id,
      email: normalizeEmail(user.email),
      display_name: normalizeDisplayName(fallbackDisplayName) || resolveDisplayName(user, user.email)
    });
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
      // Some providers can delay auth.users replication; profile can be healed on login/me.
      console.warn('Profile upsert failed during signup:', profileError.message);
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

  try {
    await ensureProfileRow(data.user, resolveDisplayName(data.user, email));
  } catch (profileError) {
    console.warn('Profile upsert failed during login:', profileError.message);
  }

  return res.status(200).json({
    message: 'Login successful.',
    user: data.user,
    session: data.session
  });
}));

router.post('/refresh', asyncHandler(async (req, res) => {
  const refreshToken = typeof req.body.refreshToken === 'string'
    ? req.body.refreshToken.trim()
    : '';

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required.' });
  }

  const supabaseAuthClient = createSupabaseAuthClient();
  const { data, error } = await supabaseAuthClient.auth.refreshSession({
    refresh_token: refreshToken
  });

  if (error || !data.session || !data.user) {
    return res.status(401).json({ error: error?.message || 'Unable to refresh session.' });
  }

  return res.status(200).json({
    message: 'Session refreshed.',
    user: data.user,
    session: data.session
  });
}));

router.post('/forgot-password', asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const redirectTo = typeof req.body.redirectTo === 'string' ? req.body.redirectTo.trim() : '';

  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  if (!validateEmail(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }

  const options = redirectTo ? { redirectTo } : undefined;
  const supabaseAuthClient = createSupabaseAuthClient();
  const { error } = await supabaseAuthClient.auth.resetPasswordForEmail(email, options);

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(200).json({
    message: 'If that email exists, a password reset link has been sent.'
  });
}));

router.post('/reset-password', requireAuth, asyncHandler(async (req, res) => {
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!password) {
    return res.status(400).json({ error: 'Password is required.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const { data, error } = await supabaseAdminClient.auth.admin.updateUserById(req.user.id, {
    password
  });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  try {
    await ensureProfileRow(data.user, resolveDisplayName(data.user, data.user?.email));
  } catch (profileError) {
    console.warn('Profile upsert failed during password reset:', profileError.message);
  }

  return res.status(200).json({ message: 'Password updated successfully.' });
}));

router.post('/logout', requireAuth, asyncHandler(async (req, res) => {
  // Signing out can fail if no refresh token is present; clearing client session still logs out the user.
  const supabaseUserClient = createSupabaseUserClient(req.accessToken);
  await supabaseUserClient.auth.signOut();

  return res.status(200).json({ message: 'Logout successful.' });
}));

router.post('/avatar', requireAuth, asyncHandler(async (req, res) => {
  const fileName = typeof req.body.fileName === 'string' ? req.body.fileName.trim() : '';
  const mimeType = typeof req.body.mimeType === 'string' ? req.body.mimeType.trim() : '';
  const dataBase64 = typeof req.body.dataBase64 === 'string' ? req.body.dataBase64.trim() : '';

  if (!fileName || !mimeType || !dataBase64) {
    return res.status(400).json({ error: 'fileName, mimeType, and dataBase64 are required.' });
  }

  if (!mimeType.startsWith('image/')) {
    return res.status(400).json({ error: 'Only image uploads are allowed.' });
  }

  const binary = decodeBase64(dataBase64);
  if (!binary) {
    return res.status(400).json({ error: 'Invalid image payload.' });
  }

  if (binary.length > MAX_AVATAR_BYTES) {
    return res.status(400).json({ error: 'Image must be 2MB or smaller.' });
  }

  const safeName = fileName.toLowerCase().replace(/[^a-z0-9_.-]/g, '-');
  const extension = safeName.includes('.') ? safeName.split('.').pop() : 'png';
  const objectPath = `${req.user.id}/avatar.${extension}`;

  const { error: uploadError } = await supabaseAdminClient.storage
    .from(AVATAR_BUCKET)
    .upload(objectPath, binary, {
      contentType: mimeType,
      upsert: true
    });

  if (uploadError) {
    const bucketMissing = /bucket.*not.*found/i.test(uploadError.message || '');
    if (bucketMissing) {
      return res.status(500).json({
        error: `Storage bucket '${AVATAR_BUCKET}' not found. Create it in Supabase Storage or set SUPABASE_AVATAR_BUCKET to an existing bucket name.`
      });
    }

    return res.status(500).json({ error: uploadError.message });
  }

  const avatarUpdatedAt = new Date().toISOString();
  const { error: profileError } = await supabaseAdminClient
    .from('profiles')
    .update({
      avatar_path: objectPath,
      avatar_updated_at: avatarUpdatedAt
    })
    .eq('id', req.user.id);

  if (profileError) {
    return res.status(500).json({ error: profileError.message });
  }

  const avatarUrl = await createAvatarSignedUrl(objectPath);

  return res.status(200).json({
    message: 'Profile picture updated.',
    avatarPath: objectPath,
    avatarUrl,
    avatarUpdatedAt
  });
}));

router.get('/avatar-url', requireAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdminClient
    .from('profiles')
    .select('avatar_path')
    .eq('id', req.user.id)
    .maybeSingle();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const avatarUrl = await createAvatarSignedUrl(data?.avatar_path || null);
  return res.status(200).json({ avatarUrl, avatarPath: data?.avatar_path || null });
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const supabaseUserClient = createSupabaseUserClient(req.accessToken);
  const { data, error } = await supabaseUserClient
    .from('profiles')
    .select('id, email, display_name, avatar_path, avatar_updated_at, created_at')
    .eq('id', req.user.id)
    .maybeSingle();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  if (!data) {
    try {
      await ensureProfileRow(req.user, resolveDisplayName(req.user, req.user.email));
    } catch (profileError) {
      return res.status(500).json({ error: profileError.message });
    }

    const { data: recoveredData, error: recoveredError } = await supabaseUserClient
      .from('profiles')
      .select('id, email, display_name, avatar_path, avatar_updated_at, created_at')
      .eq('id', req.user.id)
      .maybeSingle();

    if (recoveredError || !recoveredData) {
      return res.status(500).json({ error: recoveredError?.message || 'Unable to load profile.' });
    }

    const recoveredAvatarUrl = await createAvatarSignedUrl(recoveredData.avatar_path);
    return res.status(200).json({
      user: {
        ...recoveredData,
        avatar_url: recoveredAvatarUrl
      }
    });
  }

  const avatarUrl = await createAvatarSignedUrl(data.avatar_path);
  return res.status(200).json({
    user: {
      ...data,
      avatar_url: avatarUrl
    }
  });
}));

export default router;
