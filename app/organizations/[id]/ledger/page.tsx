'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  Alert,
  Anchor,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  Group,
  Loader,
  Stack,
  Tabs,
  Text,
  Title,
} from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import Link from 'next/link';

interface Organization {
  id: string;
  name: string;
}

interface JournalEntry {
  id: string;
  account_code: string;
  debit_amount: number;
  credit_amount: number;
}

interface Journal {
  id: string;
  journal_date: string;
  description: string;
  status: 'draft' | 'approved';
  contact_id: string | null;
  created_at: string;
  journal_entries: JournalEntry[];
  contacts: { name: string }[] | null;
}

interface AccountCode {
  code: string;
  name: string;
  category: string;
}

interface Contact {
  id: string;
  name: string;
  contact_type: string;
}

interface SubAccount {
  id: string;
  name: string;
  parent_account_code: string;
}

interface YearClosureStatus {
  fiscal_year: number;
  status: 'open' | 'closed' | 'locked' | 'temporary_unlock';
  closed_at?: string;
}

interface PageData {
  organization: Organization;
  journals: Journal[];
  accountCodes: AccountCode[];
  contacts: Contact[];
  subAccounts: SubAccount[];
  years: number[];
  currentYear: number;
  closureStatuses: YearClosureStatus[];
  ledgerId: string;
}

export default function OrganizationLedgerPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const organizationId = params?.id as string;
  const yearParam = searchParams?.get('year');
  const selectedYear = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  const [data, setData] = useState<PageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organizationId) return;
    (async () => {
      try {
        const res = await fetch(
          `/api/organizations/${organizationId}/ledger?year=${selectedYear}`,
        );
        if (!res.ok) throw new Error('台帳データの取得に失敗しました');
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'エラーが発生しました');
      } finally {
        setLoading(false);
      }
    })();
  }, [organizationId, selectedYear]);

  if (loading) {
    return (
      <Stack align="center" py="xl">
        <Loader />
      </Stack>
    );
  }

  if (error || !data?.organization) {
    return (
      <Stack>
        <Alert color="red">{error || '政治団体が見つかりません'}</Alert>
        <Button component={Link} href="/organizations" variant="outline">
          ← 政治団体一覧に戻る
        </Button>
      </Stack>
    );
  }

  const { organization, journals, accountCodes, closureStatuses, years, ledgerId } = data;
  const currentStatus = closureStatuses.find((s) => s.fiscal_year === selectedYear);
  const isReadOnly = currentStatus?.status === 'closed' || currentStatus?.status === 'locked';

  return (
    <Stack>
      <Breadcrumbs>
        <Anchor component={Link} href="/organizations">
          政治団体一覧
        </Anchor>
        <Text>{organization.name}</Text>
      </Breadcrumbs>

      <Tabs defaultValue="ledger">
        <Tabs.List>
          <Tabs.Tab value="ledger">仕訳一覧</Tabs.Tab>
          <Tabs.Tab
            value="assets"
            component={Link}
            href={`/organizations/${organization.id}/assets`}
          >
            資産一覧
          </Tabs.Tab>
          <Tabs.Tab
            value="members"
            component={Link}
            href={`/organizations/${organization.id}/members`}
          >
            メンバー
          </Tabs.Tab>
          <Tabs.Tab
            value="settings"
            component={Link}
            href={`/organizations/${organization.id}/settings`}
          >
            設定
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {accountCodes.length === 0 && (
        <Alert color="yellow" icon={<IconAlertTriangle />}>
          勘定科目マスタの取得に失敗しました。仕訳登録には勘定科目が必要です。
        </Alert>
      )}

      <Card withBorder>
        <Group justify="space-between" mb="md">
          <Group>
            <Title order={4}>仕訳一覧</Title>
            <Badge variant="light">{journals.length}件</Badge>
          </Group>
        </Group>
        {journals.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            仕訳がありません
          </Text>
        ) : (
          <Stack gap="xs">
            {journals.map((journal) => (
              <Card key={journal.id} withBorder p="sm">
                <Group justify="space-between">
                  <div>
                    <Text size="sm" c="dimmed">
                      {journal.journal_date}
                    </Text>
                    <Text>{journal.description}</Text>
                    {journal.contacts?.[0] && (
                      <Text size="sm" c="dimmed">
                        {journal.contacts[0].name}
                      </Text>
                    )}
                  </div>
                  <Badge color={journal.status === 'approved' ? 'green' : 'gray'}>
                    {journal.status === 'approved' ? '承認済' : '下書き'}
                  </Badge>
                </Group>
              </Card>
            ))}
          </Stack>
        )}
      </Card>
    </Stack>
  );
}
