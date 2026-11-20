import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || '';

export const authRouter = new Hono();

authRouter.post('/callback', async (c) => {
  try {
    const { access_token, refresh_token } = await c.req.json();

    if (!access_token) {
      return c.json({ error: 'access_token is required' }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token: refresh_token || '',
    });

    if (error) {
      console.error('Failed to set session:', error);
      return c.json({ error: error.message }, 400);
    }

    if (!data.session) {
      return c.json({ error: 'Failed to create session' }, 400);
    }

    const headers = new Headers({
      'Content-Type': 'application/json',
    });

    headers.append(
      'Set-Cookie',
      `sb-access-token=${data.session.access_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600`,
    );

    if (data.session.refresh_token) {
      headers.append(
        'Set-Cookie',
        `sb-refresh-token=${data.session.refresh_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`,
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Auth callback error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
