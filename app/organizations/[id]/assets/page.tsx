'use client';

import { useState, useEffect } from 'react';
import { Container, Title, Table, Alert, Loader, Badge, Breadcrumbs, Anchor, Tabs, Text, Stack, Group } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const ASSET_TYPE_LABELS: Record<string, string> = {
  land: '“y’n',
  building: 'Œš•¨',
  vehicle: 'Ô—¼E‘D”•',
  securities: '—L‰¿ØŒ”',
  facility_rights: '{İ—˜—pŒ ',
  deposit: '•~‹àE•ÛØ‹à',
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

export default function OrganizationAssetsPage() {
  const params = useParams();
  const id = params.id as string;
  const [orgName, setOrgName] = useState('');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/organizations/${id}/assets`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setOrgName(data.organization?.name || '');
        setAssets(data.assets || []);
      } catch {
        setError('ƒf[ƒ^‚Ìæ“¾‚É¸”s‚µ‚Ü‚µ‚½');
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
        <Anchor component={Link} href="/organizations">­¡’c‘Ìˆê——</Anchor>
        <Text>{orgName}</Text>
      </Breadcrumbs>

      <Tabs defaultValue="assets" mb="xl">
        <Tabs.List>
          <Tabs.Tab value="ledger" component={Link} href={`/organizations/${id}/ledger`}>d–óˆê——</Tabs.Tab>
          <Tabs.Tab value="assets">‘Yˆê——</Tabs.Tab>
          <Tabs.Tab value="members" component={Link} href={`/organizations/${id}/members`}>ƒƒ“ƒo[</Tabs.Tab>
          <Tabs.Tab value="settings" component={Link} href={`/organizations/${id}/settings`}>İ’è</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {error && <Alert color="red" icon={<IconAlertCircle />} mb="md">{error}</Alert>}

      <Stack>
        <Group justify="space-between">
          <Title order={3}>‘Yˆê——</Title>
          <Badge size="lg" variant="light">‡Œv: \{formatAmount(totalAmount)}</Badge>
        </Group>

        {assets.length === 0 ? (
          <Alert color="blue">‘Yæ“¾‚Ìd–ó‚ª‚ ‚è‚Ü‚¹‚ñ</Alert>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>“ú•t</Table.Th>
                <Table.Th>í—Ş</Table.Th>
                <Table.Th>“E—v</Table.Th>
                <Table.Th>‘Šèæ</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>‹àŠz</Table.Th>
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
