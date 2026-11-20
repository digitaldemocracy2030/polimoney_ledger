'use client';

import { useState } from 'react';
import { Alert, Anchor, Badge, Button, Group, Radio, Select, Stack, Text, TextInput } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import Link from 'next/link';

interface Election {
  id: string;
  name: string;
  type: string;
  election_date: string;
}

interface VerifiedPolitician {
  id: string;
  name: string;
  name_kana: string | null;
  party: string | null;
}

interface NewElectionFormProps {
  hubElections: Election[];
  verifiedPolitician: VerifiedPolitician | null;
}

const ELECTION_TYPES: Record<string, string> = {
  HR: '衆議院議員選挙',
  HC: '参議院議員選挙',
  PG: '都道府県知事選挙',
  PA: '都道府県議会選挙',
  GM: '市区町村長選挙',
  CM: '市区町村議会選挙',
};

function groupByYear(elections: Election[]): Record<string, Election[]> {
  return elections.reduce((acc, election) => {
    const year = new Date(election.election_date).getFullYear().toString();
    if (!acc[year]) acc[year] = [];
    acc[year].push(election);
    return acc;
  }, {} as Record<string, Election[]>);
}

export function NewElectionForm({ hubElections, verifiedPolitician }: NewElectionFormProps) {
  const [selectedElectionId, setSelectedElectionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const filteredElections = hubElections.filter((election) => {
    const matchesSearch =
      searchQuery === '' ||
      election.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = !typeFilter || typeFilter === 'all' || election.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const filteredGroupedByYear = groupByYear(filteredElections);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedElectionId) {
      setError('選挙を選択してください');
      return;
    }

    if (!verifiedPolitician) {
      setError('政治家として認証されていません');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const selectedElection = hubElections.find((el) => el.id === selectedElectionId);

      const response = await fetch('/api/elections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hub_election_id: selectedElectionId,
          election_name: selectedElection?.name,
          election_date: selectedElection?.election_date,
          hub_politician_id: verifiedPolitician.id,
          politician_name: verifiedPolitician.name,
        }),
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || '選挙台帳の作成に失敗しました');
      }

      const result = await response.json();
      window.location.href = `/elections/${result.election_id}/ledger`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack>
        {error && (
          <Alert color="red">
            {error}
          </Alert>
        )}

        <Text fw={700} size="lg">1. 選挙を選択</Text>

        <Group gap="md" wrap="wrap">
          <TextInput
            flex={1}
            label="🔍 検索"
            placeholder="選挙名で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            leftSection={<IconSearch size={16} />}
          />
          <Select
            label="種別"
            data={[
              { value: 'all', label: 'すべて' },
              ...Object.entries(ELECTION_TYPES).map(([code, name]) => ({
                value: code,
                label: name,
              })),
            ]}
            value={typeFilter ?? 'all'}
            onChange={(val) => setTypeFilter(val)}
          />
        </Group>

        <div style={{ maxHeight: '24rem', overflowY: 'auto', border: '1px solid var(--mantine-color-default-border)', borderRadius: 'var(--mantine-radius-default)' }}>
          {filteredElections.length === 0 ? (
            <Text ta="center" c="dimmed" py="xl">
              該当する選挙が見つかりません
            </Text>
          ) : (
            Object.keys(filteredGroupedByYear)
              .sort((a, b) => Number(b) - Number(a))
              .map((year) => (
                <div key={year}>
                  <div style={{ position: 'sticky', top: 0, background: 'var(--mantine-color-gray-1)', padding: '0.5rem 1rem', fontWeight: 700, borderBottom: '1px solid var(--mantine-color-default-border)' }}>
                    📅 {year}年
                  </div>
                  {filteredGroupedByYear[year].map((election) => (
                    <label
                      key={election.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        padding: '1rem',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--mantine-color-default-border)',
                        background: selectedElectionId === election.id ? 'var(--mantine-color-blue-0)' : undefined,
                      }}
                    >
                      <Radio
                        name="election"
                        checked={selectedElectionId === election.id}
                        onChange={() => setSelectedElectionId(election.id)}
                      />
                      <div style={{ flex: 1 }}>
                        <Text fw={500}>{election.name}</Text>
                        <Group gap="xs" mt={4}>
                          <Badge color="blue" size="sm">
                            {ELECTION_TYPES[election.type] || election.type}
                          </Badge>
                          <Text size="xs" c="dimmed">
                            {new Date(election.election_date).toLocaleDateString('ja-JP')}
                          </Text>
                        </Group>
                      </div>
                    </label>
                  ))}
                </div>
              ))
          )}
        </div>

        <Alert color="yellow">
          該当する選挙がない場合は、
          <Anchor component={Link} href="/elections/request">
            登録をリクエスト
          </Anchor>
          してください。
        </Alert>

        <Group>
          <Button component={Link} href="/elections" variant="outline">
            キャンセル
          </Button>
          <Button
            type="submit"
            flex={1}
            loading={isSubmitting}
            disabled={isSubmitting || !selectedElectionId || !verifiedPolitician}
          >
            {isSubmitting ? '作成中...' : '選挙台帳を作成'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
