'use client';

import { useState, useEffect } from 'react';
import { Container, Loader, Center, Card, Title, Text, Stack, Group, SimpleGrid, Anchor, List } from '@mantine/core';
import { IconBuilding, IconClipboard } from '@tabler/icons-react';
import { PendingTransfers } from '@/components/common/PendingTransfers';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [pendingTransfers, setPendingTransfers] = useState([]);

  useEffect(() => {
    fetch('/api/dashboard')
      .then((res) => res.json())
      .then((data) => setPendingTransfers(data.pendingTransfers || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Center h={400}><Loader /></Center>;

  return (
    <Container size="md">
      <Stack>
        <PendingTransfers initialTransfers={pendingTransfers} />

        <Card withBorder bg="blue">
          <Title order={3} c="white">ようこそ、Polimoney Ledger へ！</Title>
          <Text c="white">政治資金の収支管理を始めましょう。まずは政治団体または選挙を登録してください。</Text>
        </Card>

        <SimpleGrid cols={{ base: 1, md: 2 }}>
          <Anchor href="/organizations" underline="never">
            <Card withBorder style={{ cursor: 'pointer' }}>
              <Group>
                <Text size="2rem">🏛️</Text>
                <div>
                  <Title order={4}>政治団体</Title>
                  <Text c="dimmed">政治団体の台帳を管理</Text>
                </div>
              </Group>
            </Card>
          </Anchor>
          <Anchor href="/elections" underline="never">
            <Card withBorder style={{ cursor: 'pointer' }}>
              <Group>
                <Text size="2rem">🗳️</Text>
                <div>
                  <Title order={4}>選挙</Title>
                  <Text c="dimmed">選挙の台帳を管理</Text>
                </div>
              </Group>
            </Card>
          </Anchor>
        </SimpleGrid>

        <Card withBorder>
          <Title order={4}>使い方</Title>
          <List type="ordered" mt="sm" c="dimmed">
            <List.Item>「政治団体」または「選挙」を選択</List.Item>
            <List.Item>対象の団体・選挙を選んで「台帳を開く」をクリック</List.Item>
            <List.Item>仕訳を登録して収支を管理</List.Item>
            <List.Item>仕訳を承認すると公開データとして同期されます</List.Item>
          </List>
        </Card>
      </Stack>
    </Container>
  );
}
