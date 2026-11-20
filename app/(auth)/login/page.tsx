'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, TextInput, PasswordInput, Button, Text, Group, Image, Divider, Anchor, Alert, Stack } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/dashboard';
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

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      setError('Supabase が設定されていません');
      return;
    }

    setLoading(true);
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    window.location.href = redirectTo;
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
