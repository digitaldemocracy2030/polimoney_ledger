'use client';

import { useState, useEffect } from 'react';
import { Container, Loader, Center, Card, Title, Text, Stack, Group, Button, Anchor, Alert } from '@mantine/core';
import { IconDownload, IconLock, IconAlertTriangle, IconRefresh } from '@tabler/icons-react';
import { Badge } from '@mantine/core';
import { ReSyncButton } from '@/components/common/ReSyncButton';
import { apiFetch } from '@/lib/api-client';

/** Content-Disposition からファイル名を取り出す（filename*=UTF-8'' を優先） */
function getFileName(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (encoded) return decodeURIComponent(encoded[1]);
  const plain = disposition.match(/filename="?([^";]+)"?/i);
  return plain ? plain[1] : fallback;
}

export default function SettingsPage() {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Bearer トークンが必要なため <a download> ではなく fetch して Blob で保存する
  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const res = await apiFetch('/v1/export');
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || 'エクスポートに失敗しました');
      }
      const blob = await res.blob();
      const fileName = getFileName(
        res.headers.get('Content-Disposition'),
        `polimoney-ledger-export-${new Date().toISOString().slice(0, 10)}.json`,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'エクスポートに失敗しました');
    } finally {
      setExporting(false);
    }
  };

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
          {exportError && <Alert color="red" mb="sm">{exportError}</Alert>}
          <Button onClick={handleExport} loading={exporting} variant="outline" leftSection={<IconDownload size={18} />}>
            データをエクスポート
          </Button>
        </Card>

        <div style={{ height: 32 }} />

        <ReSyncButton />
      </Stack>
    </Container>
  );
}
