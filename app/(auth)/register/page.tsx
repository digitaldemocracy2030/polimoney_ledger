'use client';

import { useState } from 'react';
import {
  Card, TextInput, PasswordInput, Button, Text, Divider, Anchor,
  Alert, Stack, Checkbox, Group, Title, Code,
} from '@mantine/core';
import { IconAlertCircle, IconAlertTriangle, IconInfoCircle, IconUserPlus } from '@tabler/icons-react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export default function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [tosAccepted, setTosAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!fullName || !email || !password) {
      setError('すべての必須項目を入力してください');
      return;
    }
    if (!tosAccepted) {
      setError('利用規約への同意が必要です');
      return;
    }
    if (!privacyAccepted) {
      setError('プライバシーポリシーへの同意が必要です');
      return;
    }
    if (password !== confirmPassword) {
      setError('パスワードが一致しません');
      return;
    }
    if (password.length < 8) {
      setError('パスワードは8文字以上で入力してください');
      return;
    }
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      setError('Supabase が設定されていません');
      return;
    }

    setLoading(true);
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    setSuccess(true);
  };

  if (success) {
    return (
      <Card shadow="xl" padding="xl" radius="md" w="100%" maw={420} ta="center">
        <Text size="3rem" mb="md">✉️</Text>
        <Title order={2} mb="md">確認メールを送信しました</Title>
        <Stack ta="left" gap="sm">
          <Text>
            <Text span fw={700}>{email}</Text> 宛に確認メールを送信しました。
          </Text>
          <Text size="sm" c="dimmed">
            メール内の「メールアドレスを確認する」ボタンをクリックして、確認を完了してください。
            確認が完了すると、ログインできるようになります。
          </Text>
          <Alert color="yellow" icon={<IconAlertTriangle />}>
            <Text size="xs" fw={700}>送信元について</Text>
            <Text size="xs">
              メールは <Code>noreply@mail.app.supabase.io</Code> から届きます。
              届かない場合は迷惑メールフォルダをご確認ください。
            </Text>
          </Alert>
          <Alert color="blue" icon={<IconInfoCircle />}>
            <Text size="xs" fw={700}>政治家認証について</Text>
            <Text size="xs">
              政治家本人として選挙台帳を作成するには、ログイン後に政治家認証を申請してください。
            </Text>
          </Alert>
        </Stack>
        <Button component="a" href="/login" mt="lg">ログインページへ</Button>
      </Card>
    );
  }

  return (
    <Card shadow="xl" padding="xl" radius="md" w="100%" maw={420}>
      <Stack align="center" mb="md">
        <Text size="3rem">📒</Text>
        <Title order={2}>Polimoney Ledger</Title>
        <Text c="dimmed">新規登録</Text>
      </Stack>

      {error && (
        <Alert color="red" icon={<IconAlertCircle />} mb="md">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput
            label="姓名（本名）"
            placeholder="山田 太郎"
            description="政治家認証などに使用されます。本名を入力してください。"
            value={fullName}
            onChange={(e) => setFullName(e.currentTarget.value)}
            required
          />
          <TextInput
            label="メールアドレス"
            type="email"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            required
          />
          <PasswordInput
            label="パスワード（8文字以上）"
            placeholder="パスワード"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            minLength={8}
            required
          />
          <PasswordInput
            label="パスワード（確認）"
            placeholder="パスワード（確認）"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.currentTarget.value)}
            minLength={8}
            required
          />

          <Divider label="同意事項" labelPosition="center" />

          <Alert color="blue" icon={<IconInfoCircle />}>
            <Text size="xs" fw={700}>フィッシングサイトにご注意ください</Text>
            <Text size="xs">
              Polimoney Ledger はオープンソースソフトウェアです。偽サイトに個人情報を入力しないよう、URLをご確認ください。
            </Text>
          </Alert>

          <Checkbox
            label={<><Anchor href="/terms" target="_blank">利用規約</Anchor>に同意する</>}
            checked={tosAccepted}
            onChange={(e) => setTosAccepted(e.currentTarget.checked)}
            required
          />
          <Checkbox
            label={<><Anchor href="/privacy" target="_blank">プライバシーポリシー</Anchor>に同意する</>}
            checked={privacyAccepted}
            onChange={(e) => setPrivacyAccepted(e.currentTarget.checked)}
            required
          />

          <Button type="submit" fullWidth loading={loading} leftSection={<IconUserPlus size={18} />}>
            登録する
          </Button>
        </Stack>
      </form>

      <Divider label="または" labelPosition="center" my="lg" />

      <Stack align="center" gap={4}>
        <Text size="sm" c="dimmed">すでにアカウントをお持ちの場合は</Text>
        <Anchor href="/login">ログイン</Anchor>
      </Stack>
    </Card>
  );
}
