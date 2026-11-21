'use client';

import { apiFetch } from '@/lib/api-client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import Link from 'next/link';
import { ApproveButton } from '@/components/common/ApproveButton';

interface JournalEntry {
  id: string;
  account_code: string;
  sub_account_id: string | null;
  debit_amount: number;
  credit_amount: number;
}

interface Journal {
  id: string;
  journal_date: string;
  description: string;
  status: 'draft' | 'approved';
  ledger_id: string | null;
  contact_id: string | null;
  classification: string | null;
  non_monetary_basis: string | null;
  notes: string | null;
  amount_public_subsidy: number | null;
  is_receipt_hard_to_collect: boolean;
  receipt_hard_to_collect_reason: string | null;
  created_at: string;
  approved_at: string | null;
  journal_entries: JournalEntry[];
  contacts: { name: string; contact_type: string; address: string | null } | null;
  political_organizations: { name: string } | null;
  elections: { election_name: string } | null;
}

const ACCOUNT_NAMES: Record<string, string> = {
  REV_INDIVIDUAL: '個人からの寄附',
  REV_CORPORATE: '法人からの寄附',
  REV_POLITICAL_PARTY: '政党からの寄附',
  REV_OTHER_ORG: 'その他団体からの寄附',
  REV_DUES: '党費・会費',
  REV_DONATION_IN_KIND: '寄附（金銭以外）',
  REV_OTHER: 'その他の収入',
  EXP_PERSONNEL: '人件費',
  EXP_OFFICE: '事務所費',
  EXP_UTILITIES: '光熱水費',
  EXP_COMMUNICATION: '通信費',
  EXP_TRAVEL: '交通費',
  EXP_PRINTING: '印刷費',
  EXP_ADVERTISING: '広告宣伝費',
  EXP_MEETING: '会議費',
  EXP_SUPPLIES: '備品・消耗品費',
  EXP_RESEARCH: '調査研究費',
  EXP_OTHER: 'その他の支出',
};

function getAccountName(code: string): string {
  return ACCOUNT_NAMES[code] || code;
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('ja-JP').format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function JournalDetailPage() {
  const params = useParams();
  const journalId = params?.id as string;

  const [journal, setJournal] = useState<Journal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchJournal = useCallback(async () => {
    if (!journalId) return;
    try {
      const res = await apiFetch(`/v1/journals/${journalId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || '仕訳が見つかりません');
      }
      const data = await res.json();
      setJournal(data.journal ?? data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [journalId]);

  useEffect(() => {
    fetchJournal();
  }, [fetchJournal]);

  if (loading) {
    return (
      <Stack align="center" py="xl">
        <Loader />
      </Stack>
    );
  }

  if (error || !journal) {
    return (
      <Stack>
        <Alert color="red">{error || '仕訳が見つかりません'}</Alert>
        <Button component={Link} href="/journals" variant="outline">
          ← 仕訳一覧に戻る
        </Button>
      </Stack>
    );
  }

  const totalDebit = journal.journal_entries.reduce((sum, e) => sum + e.debit_amount, 0);
  const totalCredit = journal.journal_entries.reduce((sum, e) => sum + e.credit_amount, 0);

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <Button component={Link} href="/journals" variant="subtle" size="sm">
            ← 戻る
          </Button>
          <Title order={3}>{formatDate(journal.journal_date)}</Title>
          <Badge color={journal.status === 'approved' ? 'green' : 'yellow'}>
            {journal.status === 'approved' ? '承認済' : '下書き'}
          </Badge>
        </Group>
        {/* 承認の権限・自己承認の可否は API 側で判定する */}
        {journal.status === 'draft' && (
          <ApproveButton journalId={journal.id} onApproved={fetchJournal} />
        )}
      </Group>

      <Card withBorder>
        <Title order={4} mb="md">基本情報</Title>
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          <div>
            <Text size="sm" c="dimmed">摘要</Text>
            <Text fw={500}>{journal.description}</Text>
          </div>
          {journal.contacts && (
            <div>
              <Text size="sm" c="dimmed">関係者</Text>
              <Text fw={500}>
                {journal.contacts.name}
                <Text span size="sm" c="dimmed" ml="xs">
                  ({journal.contacts.contact_type === 'person' ? '個人' : '法人'})
                </Text>
              </Text>
            </div>
          )}
          {journal.political_organizations && (
            <div>
              <Text size="sm" c="dimmed">政治団体</Text>
              <Text fw={500}>{journal.political_organizations.name}</Text>
            </div>
          )}
          {journal.elections && (
            <div>
              <Text size="sm" c="dimmed">選挙</Text>
              <Text fw={500}>{journal.elections.election_name}</Text>
            </div>
          )}
          {journal.classification && (
            <div>
              <Text size="sm" c="dimmed">活動区分</Text>
              <Text fw={500}>
                {journal.classification === 'campaign' ? '選挙運動期間中' : '選挙運動期間外'}
              </Text>
            </div>
          )}
          {journal.notes && (
            <div>
              <Text size="sm" c="dimmed">備考</Text>
              <Text fw={500}>{journal.notes}</Text>
            </div>
          )}
        </SimpleGrid>
      </Card>

      <Card withBorder>
        <Title order={4} mb="md">仕訳明細</Title>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>勘定科目</Table.Th>
              <Table.Th ta="right">借方</Table.Th>
              <Table.Th ta="right">貸方</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {journal.journal_entries.map((entry) => (
              <Table.Tr key={entry.id}>
                <Table.Td>{getAccountName(entry.account_code)}</Table.Td>
                <Table.Td ta="right" ff="monospace">
                  {entry.debit_amount > 0 ? `¥${formatAmount(entry.debit_amount)}` : ''}
                </Table.Td>
                <Table.Td ta="right" ff="monospace">
                  {entry.credit_amount > 0 ? `¥${formatAmount(entry.credit_amount)}` : ''}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
          <Table.Tfoot>
            <Table.Tr fw={700}>
              <Table.Td>合計</Table.Td>
              <Table.Td ta="right" ff="monospace">¥{formatAmount(totalDebit)}</Table.Td>
              <Table.Td ta="right" ff="monospace">¥{formatAmount(totalCredit)}</Table.Td>
            </Table.Tr>
          </Table.Tfoot>
        </Table>
      </Card>

      {(journal.amount_public_subsidy || journal.is_receipt_hard_to_collect || journal.non_monetary_basis) && (
        <Card withBorder>
          <Title order={4} mb="md">追加情報</Title>
          <Stack>
            {journal.amount_public_subsidy !== null && journal.amount_public_subsidy > 0 && (
              <div>
                <Text size="sm" c="dimmed">公費負担額</Text>
                <Text fw={500} ff="monospace">¥{formatAmount(journal.amount_public_subsidy)}</Text>
              </div>
            )}
            {journal.is_receipt_hard_to_collect && (
              <div>
                <Text size="sm" c="dimmed">証憑添付不可</Text>
                <Text fw={500}>{journal.receipt_hard_to_collect_reason || '理由未記載'}</Text>
              </div>
            )}
            {journal.non_monetary_basis && (
              <div>
                <Text size="sm" c="dimmed">金銭以外の寄附の見積根拠</Text>
                <Text fw={500}>{journal.non_monetary_basis}</Text>
              </div>
            )}
          </Stack>
        </Card>
      )}

      <Text size="sm" c="dimmed">
        作成日時: {formatDateTime(journal.created_at)}
        {journal.approved_at && <> / 承認日時: {formatDateTime(journal.approved_at)}</>}
      </Text>
    </Stack>
  );
}
