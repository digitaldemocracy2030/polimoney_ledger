'use client';

import { useState, useEffect } from 'react';
import { Alert, Badge, Button, Card, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { IconAlertCircle, IconPlus } from '@tabler/icons-react';
import Link from 'next/link';

interface UserElection {
  id: string;
  election_name: string;
  election_date: string;
  created_at: string;
  hub_politician_id: string | null;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function ElectionsPage() {
  const [elections, setElections] = useState<UserElection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/elections');
        if (!res.ok) throw new Error('選挙台帳の取得に失敗しました');
        const data = await res.json();
        setElections(data.elections ?? data ?? []);
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
        <Button component={Link} href="/elections/new" leftSection={<IconPlus size={18} />}>
          新しい選挙台帳を作成
        </Button>
      </Group>

      {elections.length === 0 ? (
        <Card withBorder>
          <Stack align="center" py="xl">
            <Text size="3rem">🗳️</Text>
            <Title order={3}>選挙台帳がありません</Title>
            <Text c="dimmed">
              「新しい選挙台帳を作成」ボタンから、選挙を登録して台帳を作成しましょう。
            </Text>
          </Stack>
        </Card>
      ) : (
        <Stack>
          {elections.map((election) => (
            <Card key={election.id} withBorder>
              <Group justify="space-between" wrap="wrap">
                <div>
                  <Title order={4}>{election.election_name}</Title>
                  <Group gap="xs" mt="xs">
                    <Badge variant="outline">{formatDate(election.election_date)}</Badge>
                  </Group>
                </div>
                <Button component={Link} href={`/elections/${election.id}/ledger`}>
                  台帳を開く
                </Button>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
