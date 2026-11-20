'use client';

import { useState } from 'react';
import { Alert, Button, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { IconAlertTriangle, IconCheck, IconRefresh, IconX } from '@tabler/icons-react';

interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

interface ReSyncButtonProps {
  ledgerType?: 'election' | 'organization';
  ledgerId?: string;
}

export function ReSyncButton({ ledgerType, ledgerId }: ReSyncButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSync = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setShowConfirm(false);

    try {
      const params = new URLSearchParams();
      if (ledgerType) params.set('type', ledgerType);
      if (ledgerId) params.set('ledger_id', ledgerId);
      params.set('force', 'true');

      const response = await fetch(`/api/sync?${params.toString()}`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '同期に失敗しました');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Paper withBorder p="lg" style={{ borderColor: 'var(--mantine-color-red-6)', borderWidth: 2 }}>
      <Group gap="xs" mb="md">
        <IconAlertTriangle size={24} color="var(--mantine-color-red-6)" />
        <Title order={4} c="red">Danger Zone</Title>
      </Group>

      <Stack gap="xs" mb="md">
        <Text fw={600}>Hub との強制再同期</Text>
        <Text size="sm" c="dimmed">
          通常、仕訳は承認時に自動で Hub に同期されます。
          このボタンは Hub とのデータにズレが生じた場合にのみ使用してください。
          承認済みの全仕訳が Hub に再送信されます。
        </Text>
      </Stack>

      {!showConfirm ? (
        <Button
          variant="outline"
          color="red"
          leftSection={<IconRefresh size={18} />}
          onClick={() => setShowConfirm(true)}
          disabled={isLoading}
        >
          強制再同期を実行
        </Button>
      ) : (
        <Stack gap="sm">
          <Text size="sm" fw={600} c="red">
            本当に再同期を実行しますか？
          </Text>
          <Group gap="sm">
            <Button
              color="red"
              onClick={handleSync}
              disabled={isLoading}
              loading={isLoading}
            >
              はい、再同期します
            </Button>
            <Button
              variant="subtle"
              onClick={() => setShowConfirm(false)}
              disabled={isLoading}
            >
              キャンセル
            </Button>
          </Group>
        </Stack>
      )}

      {error && (
        <Alert color="red" icon={<IconX size={18} />} mt="md">
          {error}
        </Alert>
      )}

      {result && (
        <Alert color="green" icon={<IconCheck size={18} />} mt="md" title="再同期完了!">
          <Text size="sm">
            作成: {result.created} 件 / 更新: {result.updated} 件 / スキップ: {result.skipped} 件
            {result.errors > 0 && (
              <Text span c="red"> / エラー: {result.errors} 件</Text>
            )}
          </Text>
        </Alert>
      )}
    </Paper>
  );
}
