'use client';

import { apiFetch } from '@/lib/api-client';
import { useState, useEffect } from 'react';
import { Container, Title, Alert, Loader, Breadcrumbs, Anchor, Tabs, Text } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { MemberManager } from '@/components/members/MemberManager';

export default function OrganizationMembersPage() {
  const params = useParams();
  const id = params.id as string;
  const [orgName, setOrgName] = useState('');
  const [members, setMembers] = useState([]);
  const [isOwner, setIsOwner] = useState(false);
  const [canManageMembers, setCanManageMembers] = useState(false);
  const [ledgerId, setLedgerId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch(`/v1/organizations/${id}/members`);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || 'データの取得に失敗しました');
        }
        const data = await res.json();
        setOrgName(data.organization?.name || '');
        setMembers(data.members || []);
        setIsOwner(data.isOwner || false);
        setCanManageMembers(data.canManageMembers || false);
        setLedgerId(data.ledgerId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'データの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <Container py="xl"><Loader /></Container>;

  return (
    <Container py="xl">
      <Breadcrumbs mb="md">
        <Anchor component={Link} href="/organizations">政治団体一覧</Anchor>
        <Text>{orgName}</Text>
      </Breadcrumbs>

      <Tabs defaultValue="members" mb="xl">
        <Tabs.List>
          <Tabs.Tab value="ledger" renderRoot={(props) => <Link href={`/organizations/${id}/ledger`} {...props} />}>仕訳一覧</Tabs.Tab>
          <Tabs.Tab value="assets" renderRoot={(props) => <Link href={`/organizations/${id}/assets`} {...props} />}>資産一覧</Tabs.Tab>
          <Tabs.Tab value="members">メンバー</Tabs.Tab>
          <Tabs.Tab value="settings" renderRoot={(props) => <Link href={`/organizations/${id}/settings`} {...props} />}>設定</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {error && <Alert color="red" icon={<IconAlertCircle />} mb="md">{error}</Alert>}

      <Title order={3} mb="md">メンバー管理</Title>
      <MemberManager
        ledgerId={ledgerId}
        initialMembers={members}
        isOwner={isOwner}
        canManageMembers={canManageMembers}
      />
    </Container>
  );
}
