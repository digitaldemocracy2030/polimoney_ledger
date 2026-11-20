'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';
import { useEffect } from 'react';

export function AuthCallback() {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState('');
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);

        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const errorDescription = params.get('error_description');

        if (errorDescription) {
          throw new Error(decodeURIComponent(errorDescription));
        }

        if (!accessToken) {
          throw new Error('認証トークンが見つかりません');
        }

        const response = await fetch('/api/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token: accessToken,
            refresh_token: refreshToken,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || '認証に失敗しました');
        }

        setStatus('success');

        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      } catch (error) {
        setStatus('error');
        setErrorMessage(
          error instanceof Error ? error.message : '認証に失敗しました',
        );
      }
    };

    handleCallback();
  }, [router]);

  if (status === 'processing') {
    return (
      <Stack align="center" gap="md">
        <Loader size="lg" />
        <Title order={3}>認証処理中...</Title>
        <Text c="dimmed">しばらくお待ちください。</Text>
      </Stack>
    );
  }

  if (status === 'success') {
    return (
      <Stack align="center" gap="md">
        <Text size="3rem">✅</Text>
        <Title order={3}>認証が完了しました</Title>
        <Text c="dimmed">ダッシュボードにリダイレクトします...</Text>
      </Stack>
    );
  }

  return (
    <Stack align="center" gap="md">
      <Text size="3rem">❌</Text>
      <Title order={3} c="red">認証に失敗しました</Title>
      <Text c="dimmed">{errorMessage}</Text>
      <Stack gap="xs" w="100%" maw={300}>
        <Button component="a" href="/login" fullWidth>
          ログインページへ
        </Button>
        <Button component="a" href="/register" variant="outline" fullWidth>
          新規登録
        </Button>
      </Stack>
    </Stack>
  );
}
