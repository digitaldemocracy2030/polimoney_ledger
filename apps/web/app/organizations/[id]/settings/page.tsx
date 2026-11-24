'use client';

import { apiFetch } from '@/lib/api-client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Alert,
  Anchor,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  Group,
  List,
  Loader,
  Stack,
  Tabs,
  Text,
  Title,
} from '@mantine/core';
import { IconAlertTriangle, IconCircleCheck } from '@tabler/icons-react';
import Link from 'next/link';
import { OrganizationSettingsForm } from '@/components/organizations/OrganizationSettingsForm';

interface LocalOrganization {
  id: string;
  name: string;
  hub_organization_id: string | null;
}

interface HubOrganization {
  id: string;
  name: string;
  type: string;
  official_url: string | null;
  registration_authority: string | null;
  established_date: string | null;
  office_address: string | null;
  representative_name: string | null;
  accountant_name: string | null;
  contact_email: string | null;
  description: string | null;
  sns_x: string | null;
  sns_instagram: string | null;
  sns_facebook: string | null;
  sns_tiktok: string | null;
  manager_verified_at: string | null;
  manager_verified_domain: string | null;
}

export default function OrganizationSettingsPage() {
  const params = useParams();
  const organizationId = params?.id as string;

  const [organization, setOrganization] = useState<LocalOrganization | null>(null);
  const [hubOrganization, setHubOrganization] = useState<HubOrganization | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organizationId) return;
    (async () => {
      try {
        const res = await apiFetch(`/v1/organizations/${organizationId}/settings`);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || '政治団体の取得に失敗しました');
        }
        const data = await res.json();
        setOrganization(data.organization);
        setHubOrganization(data.hubOrganization);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'エラーが発生しました');
      } finally {
        setLoading(false);
      }
    })();
  }, [organizationId]);

  if (loading) {
    return (
      <Stack align="center" py="xl">
        <Loader />
      </Stack>
    );
  }

  if (!organization) {
    return (
      <Alert color="red">{error || '政治団体が見つかりません'}</Alert>
    );
  }

  return (
    <Stack>
      <Breadcrumbs>
        <Anchor component={Link} href="/organizations">
          政治団体一覧
        </Anchor>
        <Text>{organization.name}</Text>
      </Breadcrumbs>

      <Tabs defaultValue="settings">
        <Tabs.List>
          <Tabs.Tab value="ledger" renderRoot={(props) => <Link href={`/organizations/${organization.id}/ledger`} {...props} />}>仕訳一覧</Tabs.Tab>
          <Tabs.Tab value="assets" renderRoot={(props) => <Link href={`/organizations/${organization.id}/assets`} {...props} />}>資産一覧</Tabs.Tab>
          <Tabs.Tab value="members" renderRoot={(props) => <Link href={`/organizations/${organization.id}/members`} {...props} />}>メンバー</Tabs.Tab>
          <Tabs.Tab value="settings">設定</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {error && (
        <Alert color="yellow">{error}</Alert>
      )}

      {!hubOrganization ? (
        <Card withBorder>
          <Stack>
            <Alert color="yellow" icon={<IconAlertTriangle />} title="政治団体認証が必要です">
              <Text size="sm">
                この政治団体は Hub
                に認証されていません。詳細情報を編集するには、まず政治団体管理者認証を完了してください。
              </Text>
            </Alert>
            <Group justify="flex-end">
              <Button component={Link} href="/settings">
                認証申請へ
              </Button>
            </Group>
          </Stack>
        </Card>
      ) : (
        <>
          <Group gap="sm">
            <Badge color="green" leftSection={<IconCircleCheck size={14} />}>
              認証済み
            </Badge>
            <Text size="sm" c="dimmed">
              認証日:{' '}
              {hubOrganization.manager_verified_at
                ? new Date(hubOrganization.manager_verified_at).toLocaleDateString('ja-JP')
                : '-'}
            </Text>
            <Text size="sm" c="dimmed">
              認証ドメイン: {hubOrganization.manager_verified_domain || '-'}
            </Text>
          </Group>

          <OrganizationSettingsForm
            organizationId={hubOrganization.id}
            initialData={{
              name: hubOrganization.name,
              type: hubOrganization.type,
              official_url: hubOrganization.official_url || '',
              registration_authority: hubOrganization.registration_authority || '',
              established_date: hubOrganization.established_date || '',
              office_address: hubOrganization.office_address || '',
              representative_name: hubOrganization.representative_name || '',
              accountant_name: hubOrganization.accountant_name || '',
              sns_x: hubOrganization.sns_x || '',
              sns_instagram: hubOrganization.sns_instagram || '',
              sns_facebook: hubOrganization.sns_facebook || '',
              sns_tiktok: hubOrganization.sns_tiktok || '',
            }}
          />
        </>
      )}
    </Stack>
  );
}
