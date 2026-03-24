import { getSupabaseAdminClient } from '../config/supabase.js';

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing bearer token.' });
    }

    const accessToken = authHeader.slice(7);
    const { data, error } = await getSupabaseAdminClient().auth.getUser(accessToken);

    if (error || !data.user) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }

    req.user = data.user;
    req.accessToken = accessToken;
    next();
  } catch (error) {
    next(error);
  }
}
