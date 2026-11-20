'use client';

import { useState, useEffect } from 'react';
import { Alert, Badge, Button, Card, Group, Loader, Stack, Tabs, Text, Title } from '@mantine/core';
import { IconAlertCircle, IconAlertTriangle } from '@tabler/icons-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface Election {
  id: string;
  election_name: string;
  election_date: string;
  hub_politician_id: string | null;
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!electionId) return;
    (async () => {
      try {
        const res = await fetch(`/api/elections/${electionId}/ledger`);
        if (!res.ok) throw new Error('データの取得に失敗しました');
        const data = await res.json();
        setElection(data.election ?? null);
        setJournals(data.journals ?? []);
        setAccountCodes(data.accountCodes ?? []);
        setContacts(data.contacts ?? []);
        setSubAccounts(data.subAccounts ?? []);
        setLedgerId(data.ledgerId ?? '');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'エラーが発生しました');
      } finally {
        setLoading(false);
      }
    })();
  }, [electionId]);

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
            component={Link}
            href={`/elections/${election.id}/assets`}
          >
            資産一覧
          </Tabs.Tab>
          <Tabs.Tab
            value="members"
            component={Link}
            href={`/elections/${election.id}/members`}
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
          </Group>

          {journals.length === 0 ? (
            <Text ta="center" c="dimmed" py="xl">
              仕訳がありません
            </Text>
          ) : (
            <Stack gap="xs">
              {journals.map((journal) => (
                <Card key={journal.id} withBorder p="sm">
                  <Group justify="space-between">
                    <div>
                      <Text size="sm">{journal.journal_date}</Text>
                      <Text fw={500}>{journal.description}</Text>
                      {journal.contacts?.[0] && (
                        <Text size="xs" c="dimmed">
                          {journal.contacts[0].name}
                        </Text>
                      )}
                    </div>
                    <Badge color={journal.status === 'approved' ? 'green' : 'gray'} size="sm">
                      {journal.status === 'approved' ? '承認済' : '下書き'}
                    </Badge>
                  </Group>
                </Card>
              ))}
            </Stack>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
