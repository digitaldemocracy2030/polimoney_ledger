'use client';

import { apiFetch } from '@/lib/api-client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Alert,
  Badge,
  Button,
  Loader,
  SegmentedControl,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import Link from 'next/link';

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
  ledger_id: string | null;
  contact_id: string | null;
  created_at: string;
  journal_entries: JournalEntry[];
  contacts: { name: string } | null;
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('ja-JP').format(amount);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function calculateTotal(entries: JournalEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.debit_amount, 0);
}

function JournalsContent() {
  const searchParams = useSearchParams();
  const filterParam = searchParams?.get('filter') || 'all';

  const [journals, setJournals] = useState<Journal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const url = filterParam !== 'all' ? `/v1/journals?filter=${filterParam}` : '/v1/journals';
        const res = await apiFetch(url);
        if (!res.ok) throw new Error('仕訳の取得に失敗しました');
        const data = await res.json();
        setJournals(data.journals ?? data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'エラーが発生しました');
      } finally {
        setLoading(false);
      }
    })();
  }, [filterParam]);

  if (loading) {
    return (
      <Stack align="center" py="xl">
        <Loader />
      </Stack>
    );
  }

  const draftCount = journals.filter((j) => j.status === 'draft').length;
  const approvedCount = journals.filter((j) => j.status === 'approved').length;

  return (
    <Stack>
      <SegmentedControl
        value={filterParam}
        onChange={(v) => {
          const url = v === 'all' ? '/journals' : `/journals?filter=${v}`;
          window.location.href = url;
        }}
        data={[
          { label: `すべて (${journals.length})`, value: 'all' },
          { label: `下書き ${draftCount}`, value: 'draft' },
          { label: `承認済 ${approvedCount}`, value: 'approved' },
        ]}
      />

      {error && <Alert color="red">{error}</Alert>}

      {journals.length === 0 ? (
        <Stack align="center" py="xl">
          <Text size="3rem">📋</Text>
          <Text c="dimmed">仕訳がありません</Text>
        </Stack>
      ) : (
        <Table.ScrollContainer minWidth={600}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>日付</Table.Th>
                <Table.Th>摘要</Table.Th>
                <Table.Th>関係者</Table.Th>
                <Table.Th ta="right">金額</Table.Th>
                <Table.Th>ステータス</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {journals.map((journal) => (
                <Table.Tr key={journal.id}>
                  <Table.Td style={{ whiteSpace: 'nowrap' }}>
                    {formatDate(journal.journal_date)}
                  </Table.Td>
                  <Table.Td>
                    <Text truncate="end" maw={200}>{journal.description}</Text>
                  </Table.Td>
                  <Table.Td>
                    {journal.contacts?.name || <Text c="dimmed">-</Text>}
                  </Table.Td>
                  <Table.Td ta="right" ff="monospace">
                    ¥{formatAmount(calculateTotal(journal.journal_entries))}
                  </Table.Td>
                  <Table.Td>
                    <Badge color={journal.status === 'approved' ? 'green' : 'yellow'} size="sm">
                      {journal.status === 'approved' ? '承認済' : '下書き'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Button component={Link} href={`/journals/${journal.id}`} variant="subtle" size="xs">
                      詳細
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Stack>
  );
}

export default function JournalsPage() {
  return (
    <Suspense fallback={<Stack align="center" py="xl"><Loader /></Stack>}>
      <JournalsContent />
    </Suspense>
  );
}
