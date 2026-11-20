'use client';

import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Group,
  SegmentedControl,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import Link from 'next/link';

interface AccountCode {
  code: string;
  name: string;
  type: string;
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

interface JournalListProps {
  journals: Journal[];
  basePath: string;
  accountCodes?: AccountCode[];
}

function createAccountNameGetter(accountCodes?: AccountCode[]): (code: string) => string {
  const accountMap = new Map<string, string>();
  if (accountCodes) {
    for (const ac of accountCodes) {
      accountMap.set(ac.code, ac.name);
    }
  }
  return (code: string) => accountMap.get(code) || code;
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('ja-JP').format(amount);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function calculateTotal(entries: JournalEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.debit_amount + entry.credit_amount, 0);
}

function getIncomeExpenseType(entries: JournalEntry[]): 'income' | 'expense' {
  const totalDebit = entries.reduce((sum, e) => sum + e.debit_amount, 0);
  const totalCredit = entries.reduce((sum, e) => sum + e.credit_amount, 0);
  return totalCredit > totalDebit ? 'income' : 'expense';
}

export function JournalList({ journals, basePath, accountCodes }: JournalListProps) {
  const [filter, setFilter] = useState<string>('all');
  const getAccountName = useMemo(() => createAccountNameGetter(accountCodes), [accountCodes]);

  const filteredJournals = useMemo(() => {
    return journals.filter((j) => {
      if (filter === 'all') return true;
      return j.status === filter;
    });
  }, [journals, filter]);

  const draftCount = journals.filter((j) => j.status === 'draft').length;
  const approvedCount = journals.filter((j) => j.status === 'approved').length;

  const totals = useMemo(() => {
    return filteredJournals.reduce(
      (acc, j) => {
        const type = getIncomeExpenseType(j.journal_entries);
        const amount = calculateTotal(j.journal_entries);
        if (type === 'income') acc.income += amount;
        else acc.expense += amount;
        return acc;
      },
      { income: 0, expense: 0 },
    );
  }, [filteredJournals]);

  return (
    <div>
      <Group justify="space-between" wrap="wrap" mb="md">
        <SegmentedControl
          value={filter}
          onChange={setFilter}
          data={[
            { label: `すべて (${journals.length})`, value: 'all' },
            { label: `下書き ${draftCount}`, value: 'draft' },
            { label: `承認済 ${approvedCount}`, value: 'approved' },
          ]}
        />
        <Group gap="sm">
          <Text size="sm" c="blue" fw={500}>
            収入: ¥{formatAmount(totals.income)}
          </Text>
          <Text size="sm" c="dimmed">|</Text>
          <Text size="sm" c="red" fw={500}>
            支出: ¥{formatAmount(totals.expense)}
          </Text>
        </Group>
      </Group>

      {filteredJournals.length === 0 ? (
        <Stack align="center" py="xl">
          <Text size="3rem">📋</Text>
          <Text c="dimmed">仕訳がありません</Text>
        </Stack>
      ) : (
        <Table.ScrollContainer minWidth={700}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>収支</Table.Th>
                <Table.Th>日付</Table.Th>
                <Table.Th>借方</Table.Th>
                <Table.Th>貸方</Table.Th>
                <Table.Th>摘要</Table.Th>
                <Table.Th>取引先</Table.Th>
                <Table.Th ta="right">金額</Table.Th>
                <Table.Th>ステータス</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredJournals.map((journal) => {
                const type = getIncomeExpenseType(journal.journal_entries);
                const amount = calculateTotal(journal.journal_entries);
                const debitEntries = journal.journal_entries.filter((e) => e.debit_amount > 0);
                const creditEntries = journal.journal_entries.filter((e) => e.credit_amount > 0);

                return (
                  <Table.Tr key={journal.id}>
                    <Table.Td>
                      <Badge color={type === 'income' ? 'blue' : 'red'} size="sm">
                        {type === 'income' ? '収入' : '支出'}
                      </Badge>
                    </Table.Td>
                    <Table.Td style={{ whiteSpace: 'nowrap' }}>
                      {journal.journal_date ? formatDate(journal.journal_date) : (
                        <Text c="dimmed">-</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {debitEntries.map((e, i) => (
                        <Text key={i} size="sm" c="blue">{getAccountName(e.account_code)}</Text>
                      ))}
                    </Table.Td>
                    <Table.Td>
                      {creditEntries.map((e, i) => (
                        <Text key={i} size="sm" c="violet">{getAccountName(e.account_code)}</Text>
                      ))}
                    </Table.Td>
                    <Table.Td>
                      <Text truncate="end" maw={200}>{journal.description}</Text>
                    </Table.Td>
                    <Table.Td>
                      {journal.contacts?.[0]?.name || <Text c="dimmed">-</Text>}
                    </Table.Td>
                    <Table.Td ta="right" ff="monospace">
                      ¥{formatAmount(amount)}
                    </Table.Td>
                    <Table.Td>
                      <Badge color={journal.status === 'approved' ? 'green' : 'yellow'} size="sm">
                        {journal.status === 'approved' ? '承認済' : '下書き'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Button
                        component={Link}
                        href={`/journals/${journal.id}`}
                        variant="subtle"
                        size="xs"
                      >
                        詳細
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </div>
  );
}
