'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, TextInput, PasswordInput, Button, Text, Group, Image, Divider, Anchor, Alert, Stack } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { resolvePostLoginPath, safeRedirectPath } from '@/lib/supabase/auth';

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = safeRedirectPath(searchParams.get('redirect'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('メールアドレスとパスワードを入力してください');
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError(authError.message);
        return;
      }

      // 利用規約などに未同意（メール確認後の初回ログイン）なら同意画面へ
      window.location.href = await resolvePostLoginPath(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card shadow="xl" padding="xl" radius="md" w="100%" maw={420}>
      <Stack align="center" mb="lg">
        <Group gap="xs">
          <Image src="/logo-ledger.svg" alt="Polimoney Ledger" w={48} h={48} />
          <div>
            <Text fw={700} size="xl" c="violet.6">Polimoney</Text>
            <Text fw={500} size="sm" c="teal.6" mt={-4}>Ledger</Text>
          </div>
        </Group>
        <Text c="dimmed">ログインしてください</Text>
      </Stack>

      {error && (
        <Alert color="red" icon={<IconAlertCircle />} mb="md">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput
            label="メールアドレス"
            type="email"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            required
          />
          <PasswordInput
            label="パスワード"
            placeholder="パスワード"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            required
          />
          <Button type="submit" fullWidth loading={loading}>ログイン</Button>
          <Anchor href="/forgot-password" size="sm" ta="center">
            パスワードをお忘れの方
          </Anchor>
        </Stack>
      </form>

      <Divider label="または" labelPosition="center" my="lg" />

      <Stack align="center" gap={4}>
        <Text size="sm" c="dimmed">アカウントをお持ちでない場合は</Text>
        <Anchor href="/register">新規登録</Anchor>
      </Stack>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Text>読み込み中...</Text>}>
      <LoginForm />
    </Suspense>
  );
}
