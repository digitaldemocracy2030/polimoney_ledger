'use client';

/** /forgot-password - パスワード再設定メールの送信 */

import { useState } from 'react';
import { Alert, Anchor, Button, Card, Stack, Text, TextInput, Title } from '@mantine/core';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('メールアドレスを入力してください');
      return;
    }

    setLoading(true);
    try {
      const { error: authError } = await getSupabaseBrowserClient().auth.resetPasswordForEmail(
        email,
        { redirectTo: `${window.location.origin}/auth/callback?next=/reset-password` },
      );
      if (authError) {
        setError(authError.message);
        return;
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '送信に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card shadow="xl" padding="xl" radius="md" w="100%" maw={420}>
      <Stack align="center" mb="md">
        <Title order={2}>パスワードの再設定</Title>
      </Stack>

      {sent ? (
        <Stack gap="md">
          <Alert color="green" icon={<IconCheck />}>
            <Text size="sm">
              {email} 宛にパスワード再設定用のメールを送信しました。メール内のリンクから新しいパスワードを設定してください。
            </Text>
          </Alert>
          <Button component="a" href="/login" fullWidth>
            ログインページへ
          </Button>
        </Stack>
      ) : (
        <>
          {error && (
            <Alert color="red" icon={<IconAlertCircle />} mb="md">
              {error}
            </Alert>
          )}
          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                登録済みのメールアドレスを入力してください。パスワード再設定用のリンクをお送りします。
              </Text>
              <TextInput
                label="メールアドレス"
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                required
              />
              <Button type="submit" fullWidth loading={loading}>
                再設定メールを送信
              </Button>
              <Anchor href="/login" size="sm" ta="center">
                ログインページへ戻る
              </Anchor>
            </Stack>
          </form>
        </>
      )}
    </Card>
  );
}
