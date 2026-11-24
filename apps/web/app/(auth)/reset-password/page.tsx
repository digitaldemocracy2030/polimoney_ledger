'use client';

/**
 * /reset-password - 新しいパスワードの設定
 *
 * 再設定メールのリンク → /auth/callback でセッションが確立された状態で表示される。
 */

import { useState } from 'react';
import { Alert, Button, Card, PasswordInput, Stack, Title } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('パスワードは8文字以上で入力してください');
      return;
    }
    if (password !== confirmPassword) {
      setError('パスワードが一致しません');
      return;
    }

    setLoading(true);
    try {
      const { error: authError } = await getSupabaseBrowserClient().auth.updateUser({ password });
      if (authError) {
        setError(authError.message);
        return;
      }
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'パスワードの変更に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card shadow="xl" padding="xl" radius="md" w="100%" maw={420}>
      <Stack align="center" mb="md">
        <Title order={2}>新しいパスワードの設定</Title>
      </Stack>

      {error && (
        <Alert color="red" icon={<IconAlertCircle />} mb="md">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <PasswordInput
            label="新しいパスワード（8文字以上）"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            minLength={8}
            required
          />
          <PasswordInput
            label="新しいパスワード（確認）"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.currentTarget.value)}
            minLength={8}
            required
          />
          <Button type="submit" fullWidth loading={loading}>
            パスワードを変更する
          </Button>
        </Stack>
      </form>
    </Card>
  );
}
