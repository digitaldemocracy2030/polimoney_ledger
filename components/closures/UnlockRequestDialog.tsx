'use client';

import { useState } from 'react';
import { Alert, Button, Group, List, Modal, Stack, Text, Textarea } from '@mantine/core';
import { IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';

interface UnlockRequestDialogProps {
  organizationId: string;
  year: number;
  hasPendingRequest: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function UnlockRequestDialog({
  organizationId,
  year,
  hasPendingRequest,
  onClose,
  onSuccess,
}: UnlockRequestDialogProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (reason.trim().length < 10) {
      setError('理由は10文字以上で入力してください');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/closures/unlock-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, year, reason: reason.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'リクエスト送信に失敗しました');
      }

      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setSubmitting(false);
    }
  }

  if (hasPendingRequest) {
    return (
      <Modal opened onClose={onClose} title={`${year}年度のロック解除申請`}>
        <Alert color="blue" icon={<IconInfoCircle size={18} />} mb="md">
          <Text fw={700}>申請中です</Text>
          <Text size="sm">
            この年度のロック解除リクエストは既に申請されています。
            Hub管理者の審査をお待ちください。
          </Text>
        </Alert>

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            閉じる
          </Button>
        </Group>
      </Modal>
    );
  }

  return (
    <Modal opened onClose={onClose} title={`${year}年度のロック解除申請`}>
      <Alert color="yellow" icon={<IconAlertTriangle size={18} />} mb="md">
        <Text fw={700}>ご注意</Text>
        <List size="sm" mt="xs">
          <List.Item>申請は1件のみ有効です</List.Item>
          <List.Item>Hub管理者による審査に時間がかかる場合があります</List.Item>
          <List.Item>承認後、一定期間のみ編集可能になります</List.Item>
        </List>
      </Alert>

      <Stack gap="xs" mb="md">
        <Group justify="space-between">
          <Text fw={500}>解除理由</Text>
          <Text size="xs" c="red">必須（10文字以上）</Text>
        </Group>
        <Textarea
          placeholder="例: 記載漏れがあったため、領収証を追加登録する必要があります"
          minRows={3}
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
        />
        <Text size="xs" c="dimmed">
          {reason.length}文字
          {reason.length < 10 && reason.length > 0 && (
            <Text span c="red" ml="xs">
              あと{10 - reason.length}文字
            </Text>
          )}
        </Text>
      </Stack>

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
          disabled={submitting || reason.trim().length < 10}
          onClick={handleSubmit}
          loading={submitting}
        >
          申請を送信
        </Button>
      </Group>
    </Modal>
  );
}
