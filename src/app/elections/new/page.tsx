'use client';

import { useState, useEffect } from 'react';
import { Alert, Anchor, Button, Card, Group, List, Loader, Stack, Text, Title } from '@mantine/core';
import { IconAlertCircle, IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';
import Link from 'next/link';
import { NewElectionForm } from '@/components/elections/NewElectionForm';

interface VerifiedPolitician {
  id: string;
  name: string;
  name_kana: string | null;
  party: string | null;
}

interface Election {
  id: string;
  name: string;
  type: string;
  election_date: string;
}

export default function NewElectionPage() {
  const [hubElections, setHubElections] = useState<Election[]>([]);
  const [verifiedPolitician, setVerifiedPolitician] = useState<VerifiedPolitician | null>(null);
  const [canCreateElection, setCanCreateElection] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/elections/new-data');
        if (!res.ok) throw new Error('データの取得に失敗しました');
        const data = await res.json();
        setHubElections(data.hubElections ?? []);
        setVerifiedPolitician(data.verifiedPolitician ?? null);
        setCanCreateElection(data.canCreateElection ?? false);
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
      <Group gap="xs">
        <Anchor component={Link} href="/elections" size="sm">
          選挙台帳一覧
        </Anchor>
        <Text size="sm" c="dimmed">/</Text>
        <Text size="sm">新規作成</Text>
      </Group>

      {error && (
        <Alert color="red" icon={<IconAlertCircle />}>
          {error}
        </Alert>
      )}

      {!canCreateElection ? (
        <Card withBorder>
          <Stack>
            <Alert color="yellow" icon={<IconAlertTriangle />}>
              <Text fw={700}>選挙台帳を作成できません</Text>
              <Text size="sm" mt={4}>
                選挙台帳を作成するには、政治家として認証されている必要があります。
              </Text>
            </Alert>

            <Stack mt="md">
              <Title order={4}>選挙台帳を作成するには</Title>
              <List type="ordered" spacing="xs">
                <List.Item>
                  <Text fw={700} component="span">政治家として認証申請</Text>する（公式ドメインのメール認証が必要）
                </List.Item>
                <List.Item>
                  Hub管理者による<Text fw={700} component="span">承認</Text>を受ける
                </List.Item>
                <List.Item>
                  承認後、このページから選挙台帳を作成できるようになります
                </List.Item>
              </List>

              <Alert color="blue" icon={<IconInfoCircle />} mt="sm">
                認証済み政治家から招待されたメンバーも、権限に応じて台帳を操作できます。
              </Alert>
            </Stack>

            <Group justify="flex-end" mt="md">
              <Button component={Link} href="/settings">
                政治家認証を申請する
              </Button>
              <Button component={Link} href="/elections" variant="subtle">
                戻る
              </Button>
            </Group>
          </Stack>
        </Card>
      ) : (
        <Card withBorder>
          <Stack>
            {verifiedPolitician && (
              <Alert color="green" icon={<IconAlertCircle />}>
                <Text fw={700}>認証済み: {verifiedPolitician.name}</Text>
                {verifiedPolitician.party && (
                  <Text size="sm">{verifiedPolitician.party}</Text>
                )}
              </Alert>
            )}

            <Text c="dimmed">
              登録されている選挙から選択するか、該当する選挙がない場合は新規登録をリクエストしてください。
            </Text>
            <NewElectionForm
              hubElections={hubElections}
              verifiedPolitician={verifiedPolitician}
            />
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
