'use client';

import { useState } from 'react';
import { Alert, Badge, Button, Card, CloseButton, Group, Stack, Text, Title } from '@mantine/core';
import { IconBell } from '@tabler/icons-react';

interface Transfer {
  id: string;
  from_user_id: string;
  organization_id: string | null;
  election_id: string | null;
  requested_at: string;
  political_organizations?: {
    id: string;
    name: string;
  } | null;
  elections?: {
    id: string;
    election_name: string;
  } | null;
}

interface PendingTransfersProps {
  initialTransfers: Transfer[];
}

export function PendingTransfers({ initialTransfers }: PendingTransfersProps) {
  const [transfers, setTransfers] = useState<Transfer[]>(initialTransfers);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (transfers.length === 0) {
    return null;
  }

  const handleAccept = async (transfer: Transfer) => {
    if (
      !confirm(
        `「${
          transfer.political_organizations?.name ||
          transfer.elections?.election_name ||
          'この台帳'
        }」のオーナー譲渡を承認しますか？`,
      )
    ) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/ownership-transfers/${transfer.id}/accept`,
        { method: 'POST' },
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '承認に失敗しました');
      }

      setTransfers(transfers.filter((t) => t.id !== transfer.id));
      setSuccess('オーナー譲渡を承認しました');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecline = async (transfer: Transfer) => {
    if (!confirm('この譲渡申請を拒否しますか？')) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/ownership-transfers/${transfer.id}/decline`,
        { method: 'POST' },
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '拒否に失敗しました');
      }

      setTransfers(transfers.filter((t) => t.id !== transfer.id));
      setSuccess('譲渡申請を拒否しました');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card withBorder shadow="sm" mb="lg" style={{ borderColor: 'var(--mantine-color-yellow-5)' }}>
      <Card.Section withBorder inheritPadding py="sm">
        <Group gap="xs">
          <IconBell size={20} color="var(--mantine-color-yellow-6)" />
          <Title order={5} c="yellow.7">承認待ちのオーナー譲渡申請</Title>
        </Group>
      </Card.Section>

      <Stack gap="sm" mt="md">
        {error && (
          <Alert color="red" withCloseButton onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert color="green" withCloseButton onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {transfers.map((transfer) => (
          <Group
            key={transfer.id}
            justify="space-between"
            p="md"
            style={{
              borderRadius: 'var(--mantine-radius-md)',
              backgroundColor: 'var(--mantine-color-gray-0)',
            }}
          >
            <div>
              <Text fw={500}>
                {transfer.political_organizations?.name ||
                  transfer.elections?.election_name ||
                  '不明な台帳'}
              </Text>
              <Text size="sm" c="dimmed">
                {new Date(transfer.requested_at).toLocaleDateString('ja-JP', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
                に申請
              </Text>
            </div>
            <Group gap="xs">
              <Button
                variant="subtle"
                size="xs"
                onClick={() => handleDecline(transfer)}
                disabled={isLoading}
              >
                拒否
              </Button>
              <Button
                size="xs"
                onClick={() => handleAccept(transfer)}
                disabled={isLoading}
                loading={isLoading}
              >
                承認
              </Button>
            </Group>
          </Group>
        ))}
      </Stack>
    </Card>
  );
}
