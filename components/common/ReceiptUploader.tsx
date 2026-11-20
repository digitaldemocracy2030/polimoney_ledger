'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Box,
  Button,
  CloseButton,
  Group,
  Loader,
  Stack,
  Text,
} from '@mantine/core';
import { IconExternalLink, IconTrash, IconUpload } from '@tabler/icons-react';

interface Receipt {
  id: string;
  file_name: string;
  mime_type: string;
  file_size: number | null;
  url: string | null;
  created_at: string;
}

interface ReceiptUploaderProps {
  journalId: string;
  readOnly?: boolean;
}

export function ReceiptUploader({ journalId, readOnly = false }: ReceiptUploaderProps) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const fetchReceipts = useCallback(async () => {
    try {
      const response = await fetch(`/api/journals/${journalId}/receipts`);
      if (!response.ok) {
        throw new Error('証憑の取得に失敗しました');
      }
      const json = await response.json();
      setReceipts(json.data || []);
    } catch (err) {
      console.error('Fetch receipts error:', err);
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  }, [journalId]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  const uploadFile = async (file: File) => {
    setError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('journal_id', journalId);

      const response = await fetch('/api/receipts', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || 'アップロードに失敗しました');
      }

      const newReceipt = await response.json();
      setReceipts((prev) => [newReceipt, ...prev]);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'アップロードに失敗しました');
    } finally {
      setIsUploading(false);
    }
  };

  const deleteReceipt = async (id: string) => {
    if (!confirm('この証憑を削除しますか？')) {
      return;
    }

    try {
      const response = await fetch(`/api/receipts?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || '削除に失敗しました');
      }

      setReceipts((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error('Delete error:', err);
      setError(err instanceof Error ? err.message : '削除に失敗しました');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
  };

  const formatFileSize = (bytes: number | null): string => {
    if (bytes === null) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string): string => {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType === 'application/pdf') return '📄';
    return '📎';
  };

  if (isLoading) {
    return (
      <Group justify="center" p="md">
        <Loader />
      </Group>
    );
  }

  return (
    <Stack gap="md">
      {error && (
        <Alert color="red" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {!readOnly && (
        <Box
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${dragOver ? 'var(--mantine-color-blue-5)' : 'var(--mantine-color-gray-3)'}`,
            borderRadius: 'var(--mantine-radius-md)',
            padding: 'var(--mantine-spacing-lg)',
            textAlign: 'center',
            backgroundColor: dragOver ? 'var(--mantine-color-blue-0)' : undefined,
            transition: 'all 0.2s',
          }}
        >
          {isUploading ? (
            <Stack align="center" gap="xs">
              <Loader size="lg" />
              <Text size="sm" c="dimmed">アップロード中...</Text>
            </Stack>
          ) : (
            <Stack align="center" gap="xs">
              <Text size="2rem">📎</Text>
              <Text c="dimmed">ファイルをドラッグ＆ドロップ</Text>
              <Text size="sm" c="dimmed">または</Text>
              <Button
                component="label"
                variant="outline"
                leftSection={<IconUpload size={16} />}
              >
                ファイルを選択
                <input
                  type="file"
                  hidden
                  accept="image/jpeg,image/png,image/gif,application/pdf"
                  onChange={handleFileSelect}
                />
              </Button>
              <Text size="xs" c="dimmed">
                JPEG, PNG, GIF, PDF（最大5MB）
              </Text>
            </Stack>
          )}
        </Box>
      )}

      {receipts.length > 0 ? (
        <Stack gap="xs">
          <Text size="sm" c="dimmed" fw={500}>
            添付ファイル ({receipts.length})
          </Text>
          {receipts.map((receipt) => (
            <Group key={receipt.id} gap="sm" py="xs" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
              <Box
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 'var(--mantine-radius-sm)',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'var(--mantine-color-gray-1)',
                  flexShrink: 0,
                }}
              >
                {receipt.mime_type.startsWith('image/') && receipt.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={receipt.url}
                    alt={receipt.file_name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <Text size="1.5rem">{getFileIcon(receipt.mime_type)}</Text>
                )}
              </Box>

              <Box style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" fw={500} truncate>
                  {receipt.file_name}
                </Text>
                <Text size="xs" c="dimmed">
                  {formatFileSize(receipt.file_size)}
                </Text>
              </Box>

              <Group gap={4} style={{ flexShrink: 0 }}>
                {receipt.url && (
                  <ActionIcon
                    component="a"
                    href={receipt.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="subtle"
                    size="sm"
                    title="開く"
                  >
                    <IconExternalLink size={16} />
                  </ActionIcon>
                )}
                {!readOnly && (
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    onClick={() => deleteReceipt(receipt.id)}
                    title="削除"
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                )}
              </Group>
            </Group>
          ))}
        </Stack>
      ) : (
        !readOnly && (
          <Text ta="center" size="sm" c="dimmed" py="md">
            証憑がまだ添付されていません
          </Text>
        )
      )}
    </Stack>
  );
}
