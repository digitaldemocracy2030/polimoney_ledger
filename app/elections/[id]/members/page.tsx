'use client';

import { useState, useEffect } from 'react';
import { Container, Title, Alert, Loader, Breadcrumbs, Anchor, Tabs, Text } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { MemberManager } from '@/components/members/MemberManager';

export default function ElectionMembersPage() {
  const params = useParams();
  const id = params.id as string;
  const [electionName, setElectionName] = useState('');
  const [members, setMembers] = useState([]);
  const [isOwner, setIsOwner] = useState(false);
  const [canManageMembers, setCanManageMembers] = useState(false);
  const [ledgerId, setLedgerId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/elections/${id}/members`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setElectionName(data.election?.election_name || '');
        setMembers(data.members || []);
        setIsOwner(data.isOwner || false);
        setCanManageMembers(data.canManageMembers || false);
        setLedgerId(data.ledgerId);
      } catch {
        setError('データの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <Container py="xl"><Loader /></Container>;

  return (
    <Container py="xl">
      <Breadcrumbs mb="md">
        <Anchor component={Link} href="/elections">選挙一覧</Anchor>
        <Text>{electionName}</Text>
      </Breadcrumbs>

      <Tabs defaultValue="members" mb="xl">
        <Tabs.List>
          <Tabs.Tab value="ledger" component={Link} href={`/elections/${id}/ledger`}>仕訳一覧</Tabs.Tab>
          <Tabs.Tab value="assets" component={Link} href={`/elections/${id}/assets`}>資産一覧</Tabs.Tab>
          <Tabs.Tab value="members">メンバー</Tabs.Tab>
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
