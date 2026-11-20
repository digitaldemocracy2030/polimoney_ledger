'use client';

import { useState, useEffect } from 'react';
import { Container, Title, Table, Alert, Loader, Badge, Breadcrumbs, Anchor, Tabs, Text, Stack, Group } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const ASSET_TYPE_LABELS: Record<string, string> = {
  land: '土地',
  building: '建物',
  vehicle: '車両・船舶',
  securities: '有価証券',
  facility_rights: '施設利用権',
  deposit: '敷金・保証金',
};

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('ja-JP').format(amount);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

interface Asset {
  id: string;
  journal_date: string | null;
  description: string;
  asset_type: string;
  amount: number;
  contact_name: string | null;
}

export default function ElectionAssetsPage() {
  const params = useParams();
  const id = params.id as string;
  const [electionName, setElectionName] = useState('');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/elections/${id}/assets`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setElectionName(data.election?.election_name || '');
        setAssets(data.assets || []);
      } catch {
        setError('データの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const totalAmount = assets.reduce((sum, a) => sum + a.amount, 0);

  if (loading) return <Container py="xl"><Loader /></Container>;

  return (
    <Container py="xl">
      <Breadcrumbs mb="md">
        <Anchor component={Link} href="/elections">選挙一覧</Anchor>
        <Text>{electionName}</Text>
      </Breadcrumbs>

      <Tabs defaultValue="assets" mb="xl">
        <Tabs.List>
          <Tabs.Tab value="ledger" component={Link} href={`/elections/${id}/ledger`}>仕訳一覧</Tabs.Tab>
          <Tabs.Tab value="assets">資産一覧</Tabs.Tab>
          <Tabs.Tab value="members" component={Link} href={`/elections/${id}/members`}>メンバー</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {error && <Alert color="red" icon={<IconAlertCircle />} mb="md">{error}</Alert>}

      <Stack>
        <Group justify="space-between">
          <Title order={3}>資産一覧</Title>
          <Badge size="lg" variant="light">合計: \{formatAmount(totalAmount)}</Badge>
        </Group>

        {assets.length === 0 ? (
          <Alert color="blue">資産取得の仕訳がありません</Alert>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>日付</Table.Th>
                <Table.Th>種類</Table.Th>
                <Table.Th>摘要</Table.Th>
                <Table.Th>相手先</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>金額</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {assets.map((asset) => (
                <Table.Tr key={asset.id}>
                  <Table.Td>{formatDate(asset.journal_date)}</Table.Td>
                  <Table.Td><Badge variant="light">{ASSET_TYPE_LABELS[asset.asset_type] || asset.asset_type}</Badge></Table.Td>
                  <Table.Td>{asset.description}</Table.Td>
                  <Table.Td>{asset.contact_name || '-'}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>\{formatAmount(asset.amount)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Stack>
    </Container>
  );
}
