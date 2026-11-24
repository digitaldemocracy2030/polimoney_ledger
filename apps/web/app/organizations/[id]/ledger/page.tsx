'use client';

import { apiFetch } from '@/lib/api-client';
import { Suspense, useCallback, useEffect, useState } from 'react';
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
import { hasPermission, roleFromString } from '@polimoney-ledger/shared/permissions.ts';
import { JournalFormDrawer } from '@/components/journals/JournalFormDrawer';
import type {
  AccountCode as JournalAccountCode,
  Contact as JournalContact,
} from '@/components/journals/JournalForm';
import { JournalList } from '@/components/journals/JournalList';
import { YearSelector } from '@/components/closures/YearSelector';
import { ExportCSVButton } from '@/components/common/ExportCSVButton';
import { ReSyncButton } from '@/components/common/ReSyncButton';

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
  contacts: { name: string } | null;
}

/** Hub の勘定科目（report_category を category としても返す） */
type AccountCode = JournalAccountCode & { category: string };

type Contact = JournalContact;

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
  /** この台帳での自分のロール */
  myRole: string;
}

function OrganizationLedgerContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const organizationId = params?.id as string;
  const yearParam = searchParams?.get('year');
  const selectedYear = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  const [data, setData] = useState<PageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLedger = useCallback(async () => {
    if (!organizationId) return;
    try {
      const res = await apiFetch(
        `/v1/organizations/${organizationId}/ledger?year=${selectedYear}`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || '台帳データの取得に失敗しました');
      }
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [organizationId, selectedYear]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

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

  const {
    organization,
    journals,
    accountCodes,
    contacts,
    subAccounts,
    closureStatuses,
    years,
    ledgerId,
    myRole,
  } = data;
  const role = roleFromString(myRole);
  const currentStatus = closureStatuses.find((s) => s.fiscal_year === selectedYear);
  const isYearClosed = currentStatus?.status === 'closed' || currentStatus?.status === 'locked';
  const canSubmit = hasPermission(role, 'submitJournal');
  const canRegister = hasPermission(role, 'registerJournal');
  const canManageContacts = hasPermission(role, 'manageContacts');
  const canEditSettings = hasPermission(role, 'editLedgerSettings');

  return (
    <Stack>
      <Breadcrumbs>
        <Anchor component={Link} href="/organizations">
          政治団体一覧
        </Anchor>
        <Text>{organization.name}</Text>
      </Breadcrumbs>

      <YearSelector
        organizationId={organization.id}
        currentYear={selectedYear}
        years={years}
        closureStatuses={closureStatuses}
        canManageClosures={canEditSettings}
        onChanged={fetchLedger}
      />

      <Tabs defaultValue="ledger">
        <Tabs.List>
          <Tabs.Tab value="ledger">仕訳一覧</Tabs.Tab>
          <Tabs.Tab
            value="assets"
            renderRoot={(props) => <Link {...props} href={`/organizations/${organization.id}/assets`} />}
          >
            資産一覧
          </Tabs.Tab>
          <Tabs.Tab
            value="members"
            renderRoot={(props) => <Link {...props} href={`/organizations/${organization.id}/members`} />}
          >
            メンバー
          </Tabs.Tab>
          {canEditSettings && (
            <Tabs.Tab
              value="settings"
              renderRoot={(props) => <Link {...props} href={`/organizations/${organization.id}/settings`} />}
            >
              設定
            </Tabs.Tab>
          )}
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
          <Group gap="xs">
            <ExportCSVButton ledgerId={ledgerId} />
            {canSubmit && (
              <JournalFormDrawer
                ledgerType="organization"
                ledgerId={ledgerId}
                accountCodes={accountCodes}
                contacts={contacts}
                subAccounts={subAccounts}
                selectedYear={selectedYear}
                isReadOnly={isYearClosed}
                canRegister={canRegister}
                canManageContacts={canManageContacts}
                onSuccess={fetchLedger}
              />
            )}
          </Group>
        </Group>
        <JournalList
          journals={journals}
          basePath={`/organizations/${organization.id}/ledger`}
          accountCodes={accountCodes}
        />
      </Card>

      {canEditSettings && (
        <ReSyncButton ledgerType="organization" ledgerId={ledgerId} />
      )}
    </Stack>
  );
}

export default function OrganizationLedgerPage() {
  return (
    <Suspense fallback={<Stack align="center" py="xl"><Loader /></Stack>}>
      <OrganizationLedgerContent />
    </Suspense>
  );
}
