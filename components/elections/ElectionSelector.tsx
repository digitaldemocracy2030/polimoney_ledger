'use client';

import { useState } from 'react';
import { Alert, Badge, Button, Card, Group, Modal, Select, Stack, Text, TextInput, Textarea, Title, Loader } from '@mantine/core';
import { IconAlertTriangle, IconSearch } from '@tabler/icons-react';
import Link from 'next/link';

interface Election {
  id: string;
  name: string;
  type: string;
  election_date: string;
  area_code: string;
}

interface Props {
  initialElections: Election[];
}

const ELECTION_TYPES: Record<string, string> = {
  HR: '衆議院議員選挙',
  HC: '参議院議員選挙',
  PG: '都道府県知事選挙',
  CM: '市区町村長選挙',
  GM: '議会議員選挙',
};

export function ElectionSelector({ initialElections }: Props) {
  const [elections] = useState<Election[]>(initialElections);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [showRequestForm, setShowRequestForm] = useState(false);

  const filteredElections = elections.filter((election) => {
    const matchesSearch =
      election.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      election.area_code.includes(searchTerm);
    const matchesType = !selectedType || election.type === selectedType;
    return matchesSearch && matchesType;
  });

  const groupedByYear = filteredElections.reduce((acc, election) => {
    const year = new Date(election.election_date).getFullYear();
    if (!acc[year]) acc[year] = [];
    acc[year].push(election);
    return acc;
  }, {} as Record<number, Election[]>);

  const years = Object.keys(groupedByYear)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <div>
      <Card withBorder mb="md">
        <Group wrap="wrap" gap="md">
          <TextInput
            flex={1}
            miw={200}
            label="🔍 検索"
            placeholder="選挙名または選挙区コードで検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.currentTarget.value)}
            leftSection={<IconSearch size={16} />}
          />
          <Select
            label="種別"
            w={200}
            data={[
              { value: '', label: 'すべて' },
              ...Object.entries(ELECTION_TYPES).map(([code, name]) => ({
                value: code,
                label: name,
              })),
            ]}
            value={selectedType ?? ''}
            onChange={(val) => setSelectedType(val || null)}
          />
        </Group>
      </Card>

      <Stack gap="lg">
        {years.length > 0 ? (
          years.map((year) => (
            <div key={year}>
              <Title order={4} mb="sm">
                📅 {year}年
              </Title>
              <Card withBorder p={0}>
                <Stack gap={0}>
                  {groupedByYear[year].map((election) => (
                    <Group
                      key={election.id}
                      justify="space-between"
                      px="md"
                      py="sm"
                      style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
                    >
                      <div>
                        <Text fw={500}>{election.name}</Text>
                        <Group gap="xs" mt={4}>
                          <Badge color="blue" size="sm">
                            {ELECTION_TYPES[election.type] || election.type}
                          </Badge>
                          <Text size="xs" c="dimmed">
                            {new Date(election.election_date).toLocaleDateString('ja-JP')}
                          </Text>
                          <Text size="xs" c="dimmed">
                            選挙区: {election.area_code}
                          </Text>
                        </Group>
                      </div>
                      <Button component={Link} href={`/elections/${election.id}/ledger`} size="sm">
                        台帳を開く
                      </Button>
                    </Group>
                  ))}
                </Stack>
              </Card>
            </div>
          ))
        ) : (
          <Card withBorder>
            <Text ta="center" c="dimmed">
              該当する選挙が見つかりません
            </Text>
          </Card>
        )}
      </Stack>

      <Alert color="yellow" icon={<IconAlertTriangle />} mt="xl">
        <Group justify="space-between" align="center" wrap="wrap">
          <div>
            <Text fw={700}>該当する選挙がない場合</Text>
            <Text size="sm">
              お探しの選挙が見つからない場合は、登録をリクエストできます。
            </Text>
          </div>
          <Button color="yellow" size="sm" onClick={() => setShowRequestForm(true)}>
            登録をリクエスト
          </Button>
        </Group>
      </Alert>

      <ElectionRequestModal
        opened={showRequestForm}
        onClose={() => setShowRequestForm(false)}
      />
    </div>
  );
}

function ElectionRequestModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'GM',
    area_description: '',
    election_date: '',
    evidence_url: '',
    notes: '',
    requested_by_email: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (!formData.election_date) {
      setError('選挙日を入力してください');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/election-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'リクエストの送信に失敗しました');
      }

      alert('登録リクエストを送信しました。承認されるまでお待ちください。');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="選挙の登録リクエスト" size="lg">
      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            label="選挙名"
            required
            placeholder="例: 2025年〇〇市議会議員選挙"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.currentTarget.value })}
          />

          <Select
            label="選挙種別"
            required
            data={Object.entries(ELECTION_TYPES).map(([code, name]) => ({
              value: code,
              label: name,
            }))}
            value={formData.type}
            onChange={(val) => setFormData({ ...formData, type: val || 'GM' })}
          />

          <TextInput
            label="選挙区の説明"
            required
            placeholder="例: 東京都第1区、〇〇市全域"
            value={formData.area_description}
            onChange={(e) => setFormData({ ...formData, area_description: e.currentTarget.value })}
          />

          <TextInput
            label="選挙日（投開票日）"
            required
            type="date"
            value={formData.election_date}
            onChange={(e) => setFormData({ ...formData, election_date: e.currentTarget.value })}
          />

          <TextInput
            label="証明URL（選管サイト等）"
            type="url"
            placeholder="https://..."
            value={formData.evidence_url}
            onChange={(e) => setFormData({ ...formData, evidence_url: e.currentTarget.value })}
          />

          <TextInput
            label="連絡先メールアドレス"
            type="email"
            placeholder="example@email.com"
            value={formData.requested_by_email}
            onChange={(e) => setFormData({ ...formData, requested_by_email: e.currentTarget.value })}
          />

          <Textarea
            label="備考"
            rows={3}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.currentTarget.value })}
          />

          <Group justify="flex-end">
            <Button variant="subtle" onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
              リクエストを送信
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
