'use client';

import { apiFetch } from '@/lib/api-client';

import { useState } from 'react';
import { Alert, Button, Group, List, Modal, Text } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

interface ArchiveDialogProps {
  organizationId: string;
  year: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function ArchiveDialog({
  organizationId,
  year,
  onClose,
  onSuccess,
}: ArchiveDialogProps) {
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function executeArchive() {
    setArchiving(true);
    setError(null);

    try {
      const res = await apiFetch('/v1/closures/archive', {
        method: 'POST',
        body: JSON.stringify({ organizationId, year }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'アーカイブに失敗しました');
      }
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setArchiving(false);
    }
  }

  return (
    <Modal opened onClose={onClose} title={`${year}年度のアーカイブ`}>
      <Alert color="yellow" icon={<IconAlertTriangle size={18} />} mb="md">
        <Text fw={700}>アーカイブすると：</Text>
        <List size="sm" mt="xs">
          <List.Item>このデータは完全にロックされます</List.Item>
          <List.Item>編集にはHub管理者への解除申請が必要です</List.Item>
        </List>
      </Alert>

      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}

      <Group justify="flex-end">
        <Button variant="default" onClick={onClose}>
          キャンセル
        </Button>
        <Button
          color="yellow"
          disabled={archiving}
          loading={archiving}
          onClick={executeArchive}
        >
          アーカイブを実行
        </Button>
      </Group>
    </Modal>
  );
}
