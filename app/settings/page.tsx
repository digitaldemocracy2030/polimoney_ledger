'use client';

import { useState, useEffect } from 'react';
import { Container, Loader, Center, Card, Title, Text, Stack, Group, Button, Anchor, Alert } from '@mantine/core';
import { IconDownload, IconLock, IconAlertTriangle, IconRefresh } from '@tabler/icons-react';
import { Badge } from '@mantine/core';
import { ReSyncButton } from '@/components/common/ReSyncButton';

export default function SettingsPage() {
  return (
    <Container size="md">
      <Stack>
        <Card withBorder>
          <Title order={3}>Hub 同期ステータス</Title>
          <Group mt="sm" gap="xs">
            <Badge color="green">自動同期: 有効</Badge>
            <Text size="sm" c="dimmed">仕訳承認時に自動で Hub に同期されます</Text>
          </Group>
        </Card>

        <Card withBorder>
          <Title order={3}>📦 データポータビリティ</Title>
          <Text c="dimmed" mb="md">
            あなたのすべてのデータを JSON 形式でダウンロードできます。
            政治団体、選挙、仕訳、連絡先などが含まれます。
          </Text>
          <Button component="a" href="/api/export" variant="outline" leftSection={<IconDownload size={18} />} download>
            データをエクスポート
          </Button>
        </Card>

        <div style={{ height: 32 }} />

        <ReSyncButton />
      </Stack>
    </Container>
  );
}
