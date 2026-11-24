'use client';

/** /logout - サインアウトしてログイン画面へ遷移する */

import { useEffect } from 'react';
import { Loader, Stack, Text } from '@mantine/core';
import { signOutAndRedirect } from '@/lib/supabase/auth';

export default function LogoutPage() {
  useEffect(() => {
    signOutAndRedirect();
  }, []);

  return (
    <Stack align="center" gap="sm">
      <Loader />
      <Text c="dimmed">ログアウトしています...</Text>
    </Stack>
  );
}
