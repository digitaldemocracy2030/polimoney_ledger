'use client';

import { apiFetch } from '@/lib/api-client';

import { useState } from 'react';
import { Button, Group, Text } from '@mantine/core';
import { IconCheck, IconCircleCheck } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';

interface ApproveButtonProps {
  journalId: string;
  /** 承認成功後に呼ばれる（親ページでのデータ再取得用） */
  onApproved?: () => void;
}

export function ApproveButton({ journalId, onApproved }: ApproveButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleApprove = async () => {
    if (
      !confirm('この仕訳を承認しますか？\n承認すると Hub に自動同期されます。')
    ) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiFetch(`/v1/journals/${journalId}/approve`, {
        method: 'POST',
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || '承認に失敗しました');
      }

      await response.json();
      setIsApproved(true);

      setTimeout(() => {
        onApproved?.();
        router.refresh();
      }, 1500);
    } catch (err) {
      console.error('Approve error:', err);
      setError(err instanceof Error ? err.message : '承認に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  if (isApproved) {
    return (
      <Group gap="xs" c="green">
        <IconCircleCheck size={20} />
        <Text>承認しました</Text>
      </Group>
    );
  }

  return (
    <Group justify="flex-end" gap="sm">
      <Button
        onClick={handleApprove}
        disabled={isLoading}
        loading={isLoading}
        leftSection={!isLoading ? <IconCheck size={18} /> : undefined}
      >
        承認する
      </Button>
      {error && <Text size="sm" c="red">{error}</Text>}
    </Group>
  );
}
