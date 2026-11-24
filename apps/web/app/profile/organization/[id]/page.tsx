'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Container, Loader, Center, Card, Title, Text, Stack, Group, Badge, Alert, Paper, SimpleGrid, Breadcrumbs, Anchor } from '@mantine/core';
import { IconAlertTriangle, IconShieldCheck } from '@tabler/icons-react';
import { Button } from '@mantine/core';
import { apiJson } from '@/lib/api-client';

export default function OrganizationProfileEditPage() {
  const params = useParams();
  const organizationId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiJson<any>(`/v1/profile/organization/${encodeURIComponent(organizationId)}`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : '政治団体の取得に失敗しました'))
      .finally(() => setLoading(false));
  }, [organizationId]);

  if (loading) return <Center h={400}><Loader /></Center>;
  if (error) return <Container size="sm"><Alert color="red" icon={<IconAlertTriangle />}>{error}</Alert></Container>;

  const organization = data?.organization;
  const isManager = data?.isManager;
  const verifiedDomain = data?.verifiedDomain;

  return (
    <Container size="sm">
      <Breadcrumbs mb="md">
        <Anchor href="/profile/organization">政治団体一覧</Anchor>
        <Text>{organization?.name || '詳細'}</Text>
      </Breadcrumbs>

      {!isManager ? (
        <Card withBorder>
          <Stack>
            <Alert icon={<IconAlertTriangle />} color="red" title="アクセス権限がありません">
              この政治団体を編集する権限がありません。
            </Alert>
            <Button component="a" href="/profile/organization" variant="default">一覧に戻る</Button>
          </Stack>
        </Card>
      ) : !organization ? (
        <Card withBorder>
          <Stack>
            <Alert icon={<IconAlertTriangle />} color="red" title="政治団体が見つかりません">
              指定された政治団体は存在しないか、削除されています。
            </Alert>
            <Button component="a" href="/profile/organization" variant="default">一覧に戻る</Button>
          </Stack>
        </Card>
      ) : (
        <Stack>
          <Paper p="md" bg="green.0" radius="md" withBorder>
            <Group>
              <IconShieldCheck size={24} color="var(--mantine-color-green-6)" />
              <div>
                <Text fw={700} c="green">管理者として認証済み</Text>
                <Text size="sm" c="dimmed">{organization.name}</Text>
              </div>
            </Group>
          </Paper>

          <Alert color="blue">
            政治団体の詳細設定フォーム（OrganizationSettingsForm）はこのページで使用されます。
          </Alert>
        </Stack>
      )}
    </Container>
  );
}
