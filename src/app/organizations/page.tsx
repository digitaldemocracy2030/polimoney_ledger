'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconAlertCircle, IconPlus } from '@tabler/icons-react';
import Link from 'next/link';

interface UserOrganization {
  id: string;
  name: string;
  created_at: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<UserOrganization[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/organizations');
        if (!res.ok) throw new Error('政治団体台帳の取得に失敗しました');
        const data = await res.json();
        setOrganizations(data.organizations ?? data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'エラーが発生しました');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <Stack align="center" py="xl">
        <Loader />
      </Stack>
    );
  }

  return (
    <Stack>
      {error && (
        <Alert color="red" icon={<IconAlertCircle />}>
          {error}
        </Alert>
      )}

      <Group>
        <Button component={Link} href="/organizations/new" leftSection={<IconPlus size={18} />}>
          新しい政治団体台帳を作成
        </Button>
      </Group>

      {organizations.length === 0 ? (
        <Card withBorder p="xl">
          <Stack align="center" py="xl">
            <Text size="3rem">🏛️</Text>
            <Title order={3}>政治団体台帳がありません</Title>
            <Text c="dimmed">
              「新しい政治団体台帳を作成」ボタンから、政治団体を登録して台帳を作成しましょう。
            </Text>
          </Stack>
        </Card>
      ) : (
        <SimpleGrid cols={1}>
          {organizations.map((org) => (
            <Card key={org.id} withBorder>
              <Group justify="space-between" wrap="wrap">
                <div>
                  <Title order={4}>{org.name}</Title>
                  <Group gap="xs" mt="xs">
                    <Badge variant="outline">作成日: {formatDate(org.created_at)}</Badge>
                  </Group>
                </div>
                <Button component={Link} href={`/organizations/${org.id}/ledger`}>
                  台帳を開く
                </Button>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
