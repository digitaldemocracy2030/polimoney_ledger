'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Anchor,
  Breadcrumbs,
  Button,
  Card,
  Group,
  List,
  Loader,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';
import Link from 'next/link';
import { NewOrganizationForm } from '@/components/organizations/NewOrganizationForm';

interface ManagedOrganization {
  id: string;
  name: string;
  type: string;
  verified_at: string;
  verified_domain: string;
}

export default function NewOrganizationPage() {
  const [managedOrganizations, setManagedOrganizations] = useState<ManagedOrganization[]>([]);
  const [canCreate, setCanCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/managed-organizations');
        if (!res.ok) throw new Error('政治団体一覧の取得に失敗しました');
        const data = await res.json();
        const orgs = data.organizations ?? data ?? [];
        setManagedOrganizations(orgs);
        setCanCreate(orgs.length > 0);
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
      <Breadcrumbs>
        <Anchor component={Link} href="/organizations">
          政治団体台帳一覧
        </Anchor>
        <Text>新規作成</Text>
      </Breadcrumbs>

      {error && (
        <Alert color="yellow" icon={<IconAlertTriangle />}>
          {error}
        </Alert>
      )}

      {!canCreate ? (
        <Card withBorder>
          <Stack>
            <Alert color="yellow" icon={<IconAlertTriangle />} title="政治団体台帳を作成できません">
              <Text size="sm" mt="xs">
                政治団体台帳を作成するには、政治団体の管理者として認証されている必要があります。
              </Text>
            </Alert>

            <div>
              <Title order={4}>政治団体台帳を作成するには</Title>
              <List type="ordered" mt="sm">
                <List.Item>
                  <Text fw={700} span>
                    政治団体の管理者として認証申請
                  </Text>
                  する（政治団体の公式ドメインのメール認証が必要）
                </List.Item>
                <List.Item>
                  Hub管理者による
                  <Text fw={700} span>
                    承認
                  </Text>
                  を受ける
                </List.Item>
                <List.Item>
                  承認後、このページから政治団体台帳を作成できるようになります
                </List.Item>
              </List>
            </div>

            <Alert color="blue" icon={<IconInfoCircle />}>
              認証済み管理者から招待されたメンバーも、権限に応じて台帳を操作できます。
            </Alert>

            <Group justify="flex-end">
              <Button component={Link} href="/settings">
                管理者認証を申請する
              </Button>
              <Button component={Link} href="/organizations" variant="subtle">
                戻る
              </Button>
            </Group>
          </Stack>
        </Card>
      ) : (
        <Card withBorder>
          <Stack>
            <Text c="dimmed">
              あなたが管理者として認証されている政治団体から選択してください。
            </Text>
            <NewOrganizationForm managedOrganizations={managedOrganizations} />
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
