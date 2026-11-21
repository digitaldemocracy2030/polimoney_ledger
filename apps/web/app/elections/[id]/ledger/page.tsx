'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Group, Loader, Stack, Tabs, Text, Title } from '@mantine/core';
import { IconAlertCircle, IconAlertTriangle } from '@tabler/icons-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { hasPermission, roleFromString } from '@polimoney-ledger/shared/permissions.ts';
import { JournalFormDrawer } from '@/components/journals/JournalFormDrawer';
import type {
  AccountCode as JournalAccountCode,
  Contact as JournalContact,
} from '@/components/journals/JournalForm';
import { JournalList } from '@/components/journals/JournalList';
import { ExportCSVButton } from '@/components/common/ExportCSVButton';
import { ReSyncButton } from '@/components/common/ReSyncButton';

interface Election {
  id: string;
  election_name: string;
  election_date: string;
  hub_politician_id: string | null;
}

/** Hub の勘定科目（report_category を category としても返す） */
type AccountCode = JournalAccountCode & { category: string };

type Contact = JournalContact;

interface SubAccount {
  id: string;
  name: string;
  parent_account_code: string;
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

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function ElectionLedgerPage() {
  const params = useParams();
  const electionId = params?.id as string;

  const [election, setElection] = useState<Election | null>(null);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [accountCodes, setAccountCodes] = useState<AccountCode[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [subAccounts, setSubAccounts] = useState<SubAccount[]>([]);
  const [ledgerId, setLedgerId] = useState<string>('');
  const [myRole, setMyRole] = useState<string>('viewer');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLedger = useCallback(async () => {
    if (!electionId) return;
    try {
      const res = await apiFetch(`/v1/elections/${electionId}/ledger`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || 'データの取得に失敗しました');
      }
      const data = await res.json();
      setElection(data.election ?? null);
      setJournals(data.journals ?? []);
      setAccountCodes(data.accountCodes ?? []);
      setContacts(data.contacts ?? []);
      setSubAccounts(data.subAccounts ?? []);
      setLedgerId(data.ledgerId ?? '');
      setMyRole(data.myRole ?? 'viewer');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [electionId]);

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

  if (error || !election) {
    return (
      <Stack>
        <Alert color="red" icon={<IconAlertCircle />}>
          {error || '選挙が見つかりません'}
        </Alert>
        <Button component={Link} href="/elections" variant="outline">
          ← 選挙一覧に戻る
        </Button>
      </Stack>
    );
  }

  const role = roleFromString(myRole);
  const canSubmit = hasPermission(role, 'submitJournal');
  const canRegister = hasPermission(role, 'registerJournal');
  const canManageContacts = hasPermission(role, 'manageContacts');
  const canEditSettings = hasPermission(role, 'editLedgerSettings');

  return (
    <Stack>
      <Group gap="xs">
        <Text component={Link} href="/elections" size="sm" c="blue">
          選挙一覧
        </Text>
        <Text size="sm" c="dimmed">/</Text>
        <Text size="sm">{election.election_name}</Text>
      </Group>

      <Badge variant="outline">{formatDate(election.election_date)}</Badge>

      <Tabs defaultValue="journals">
        <Tabs.List>
          <Tabs.Tab value="journals">仕訳一覧</Tabs.Tab>
          <Tabs.Tab
            value="assets"
            renderRoot={(props) => <Link {...props} href={`/elections/${election.id}/assets`} />}
          >
            資産一覧
          </Tabs.Tab>
          <Tabs.Tab
            value="members"
            renderRoot={(props) => <Link {...props} href={`/elections/${election.id}/members`} />}
          >
            メンバー
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {accountCodes.length === 0 && (
        <Alert color="yellow" icon={<IconAlertTriangle />}>
          勘定科目マスタの取得に失敗しました。仕訳登録には勘定科目が必要です。
        </Alert>
      )}

      <Card withBorder>
        <Stack>
          <Group justify="space-between">
            <Group>
              <Title order={4}>仕訳一覧</Title>
              <Badge variant="light">{journals.length}件</Badge>
            </Group>
            <Group gap="xs">
              <ExportCSVButton ledgerId={ledgerId} />
              {canSubmit && (
                <JournalFormDrawer
                  ledgerType="election"
                  ledgerId={ledgerId}
                  accountCodes={accountCodes}
                  contacts={contacts}
                  subAccounts={subAccounts}
                  canRegister={canRegister}
                  canManageContacts={canManageContacts}
                  onSuccess={fetchLedger}
                />
              )}
            </Group>
          </Group>

          <JournalList
            journals={journals}
            basePath={`/elections/${election.id}/ledger`}
            accountCodes={accountCodes}
          />
        </Stack>
      </Card>

      {canEditSettings && (
        <ReSyncButton ledgerType="election" ledgerId={ledgerId} />
      )}
    </Stack>
  );
}
