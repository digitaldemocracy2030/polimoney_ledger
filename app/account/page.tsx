'use client';

import { useState, useEffect } from 'react';
import { Container, Loader, Center, Card, Title, Text, Stack, Group, Button, Alert, Anchor } from '@mantine/core';
import { IconLock, IconAlertTriangle } from '@tabler/icons-react';
import { ProfileEditor } from '@/components/profile/ProfileEditor';
import { EmailChangeForm } from '@/components/profile/EmailChangeForm';

export default function AccountPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ email: string; displayName: string } | null>(null);

  useEffect(() => {
    fetch('/api/account')
      .then((res) => res.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Center h={400}><Loader /></Center>;
  if (!data) return null;

  return (
    <Container size="sm">
      <Stack>
        <ProfileEditor initialDisplayName={data.displayName} />
        <EmailChangeForm currentEmail={data.email} />

        <Card withBorder>
          <Title order={3}><Group gap="xs"><IconLock size={24} />セキュリティ</Group></Title>
          <Text c="dimmed" mb="md">パスワードの変更やアカウントの削除ができます。</Text>
          <Button component="a" href="/auth/reset-password" variant="outline">パスワードを変更</Button>
        </Card>

        <Card withBorder style={{ borderColor: 'var(--mantine-color-red-3)' }}>
          <Title order={3} c="red"><Group gap="xs"><IconAlertTriangle size={24} />危険な操作</Group></Title>
          <Text c="dimmed" mb="md">
            アカウントを削除すると、すべてのデータが完全に削除されます。この操作は取り消せません。
          </Text>
          <Button color="red" variant="outline" disabled>アカウントを削除（準備中）</Button>
        </Card>
      </Stack>
    </Container>
  );
}
