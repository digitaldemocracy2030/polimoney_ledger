'use client';

import { apiFetch } from '@/lib/api-client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { IconCheck, IconClipboard, IconX } from '@tabler/icons-react';

interface Issue {
  type: 'error' | 'warning';
  category: 'draft' | 'receipt' | 'imbalance';
  message: string;
  journalId?: string;
  journalDate?: string;
  description?: string;
}

interface CheckResult {
  canClose: boolean;
  issues: Issue[];
  summary: {
    totalJournals: number;
    draftCount: number;
    missingReceiptCount: number;
    imbalanceCount: number;
  };
}

interface YearClosureDialogProps {
  organizationId: string;
  year: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function YearClosureDialog({
  organizationId,
  year,
  onClose,
  onSuccess,
}: YearClosureDialogProps) {
  const [checking, setChecking] = useState(true);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    checkClosure();
  }, []);

  async function checkClosure() {
    setChecking(true);
    setError(null);

    try {
      const res = await apiFetch(
        `/v1/closures/check?org_id=${organizationId}&year=${year}`,
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'チェックに失敗しました');
      }
      const data: CheckResult = await res.json();
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setChecking(false);
    }
  }

  async function executeClosure() {
    setClosing(true);
    setError(null);

    try {
      const res = await apiFetch('/v1/closures/execute', {
        method: 'POST',
        body: JSON.stringify({ organizationId, year }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '締め処理に失敗しました');
      }
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setClosing(false);
    }
  }

  function copyIssues() {
    if (!result) return;

    const text = result.issues
      .map((issue) => {
        const type = issue.type === 'error' ? '【必須】' : '【注意】';
        const date = issue.journalDate ? `(${issue.journalDate})` : '';
        return `${type} ${issue.message} ${date}`;
      })
      .join('\n');

    navigator.clipboard.writeText(text).then(() => {
      alert('不備リストをコピーしました');
    });
  }

  const errorCount =
    result?.issues.filter((i) => i.type === 'error').length || 0;
  const warningCount =
    result?.issues.filter((i) => i.type === 'warning').length || 0;

  return (
    <Modal opened onClose={onClose} title={`${year}年度の締め処理`} size="lg">
      {checking && (
        <Group justify="center" py="xl">
          <Loader />
          <Text>チェック中...</Text>
        </Group>
      )}

      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}

      {result && !checking && (
        <>
          <Group grow mb="md">
            <Stack align="center" gap={4} p="sm" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-sm)' }}>
              <Text size="xs" c="dimmed">仕訳数</Text>
              <Text size="lg" fw={700}>{result.summary.totalJournals}</Text>
            </Stack>
            <Stack align="center" gap={4} p="sm" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-sm)' }}>
              <Text size="xs" c="dimmed">エラー</Text>
              <Text size="lg" fw={700} c="red">{errorCount}</Text>
            </Stack>
            <Stack align="center" gap={4} p="sm" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-sm)' }}>
              <Text size="xs" c="dimmed">警告</Text>
              <Text size="lg" fw={700} c="yellow.7">{warningCount}</Text>
            </Stack>
          </Group>

          {result.canClose && result.issues.length === 0 && (
            <Alert color="green" icon={<IconCheck size={18} />} mb="md">
              すべてのチェックが完了しました。年度締めを実行できます。
            </Alert>
          )}

          {result.canClose && warningCount > 0 && (
            <Alert color="yellow" mb="md">
              警告がありますが、年度締めを実行できます。
            </Alert>
          )}

          {!result.canClose && (
            <Alert color="red" icon={<IconX size={18} />} mb="md">
              エラーを解消してから締め処理を行ってください。
            </Alert>
          )}

          {result.issues.length > 0 && (
            <Stack gap="xs" mb="md">
              <Group justify="space-between">
                <Text fw={700}>不備リスト</Text>
                <Button
                  variant="outline"
                  size="xs"
                  leftSection={<IconClipboard size={14} />}
                  onClick={copyIssues}
                >
                  コピー
                </Button>
              </Group>
              <div style={{ maxHeight: 256, overflowY: 'auto' }}>
                <Table striped highlightOnHover withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>種別</Table.Th>
                      <Table.Th>内容</Table.Th>
                      <Table.Th>日付</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {result.issues.map((issue, i) => (
                      <Table.Tr key={i}>
                        <Table.Td>
                          {issue.type === 'error' ? (
                            <Badge color="red" size="sm">必須</Badge>
                          ) : (
                            <Badge color="yellow" size="sm">注意</Badge>
                          )}
                        </Table.Td>
                        <Table.Td style={{ maxWidth: 320 }}>
                          <Text truncate>{issue.message}</Text>
                        </Table.Td>
                        <Table.Td style={{ whiteSpace: 'nowrap' }}>
                          {issue.journalDate || '-'}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </div>
            </Stack>
          )}
        </>
      )}

      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onClose}>
          キャンセル
        </Button>
        <Button
          disabled={!result?.canClose || closing}
          onClick={executeClosure}
          loading={closing}
        >
          年度締めを実行
        </Button>
      </Group>
    </Modal>
  );
}
