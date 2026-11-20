'use client';

import { useState } from 'react';
import { Badge, Button, Group, Loader, Select, Text } from '@mantine/core';
import { useRouter, useSearchParams } from 'next/navigation';
import { YearClosureDialog } from './YearClosureDialog';
import { UnlockRequestDialog } from './UnlockRequestDialog';

interface YearClosureStatus {
  fiscal_year: number;
  status: 'open' | 'closed' | 'locked' | 'temporary_unlock';
  closed_at?: string;
}

interface YearSelectorProps {
  organizationId: string;
  currentYear: number;
  years: number[];
  closureStatuses: YearClosureStatus[];
}

export function YearSelector({
  organizationId,
  currentYear,
  years,
  closureStatuses,
}: YearSelectorProps) {
  const [showClosureDialog, setShowClosureDialog] = useState(false);
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [reopening, setReopening] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentStatus = closureStatuses.find(
    (s) => s.fiscal_year === currentYear,
  );
  const status = currentStatus?.status || 'open';

  function getStatusLabel(s: string) {
    switch (s) {
      case 'closed':
        return ' (締め済)';
      case 'locked':
        return ' (ロック中)';
      case 'temporary_unlock':
        return ' (一時解除中)';
      default:
        return '';
    }
  }

  function handleYearChange(value: string | null) {
    if (!value) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('year', value);
    router.push(`?${params.toString()}`);
  }

  function handleSuccess() {
    setShowClosureDialog(false);
    setShowUnlockDialog(false);
    router.refresh();
  }

  async function handleReopen() {
    if (
      !confirm(
        `${currentYear}年度の締めを解除しますか？\n編集可能な状態に戻ります。`,
      )
    ) {
      return;
    }

    setReopening(true);
    try {
      const res = await fetch('/api/closures/reopen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, year: currentYear }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '締め解除に失敗しました');
      }

      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setReopening(false);
    }
  }

  function getStatusBadge() {
    switch (status) {
      case 'closed':
        return <Badge color="blue">締め済み</Badge>;
      case 'locked':
        return <Badge color="gray">ロック中</Badge>;
      case 'temporary_unlock':
        return <Badge color="yellow">一時解除中</Badge>;
      default:
        return <Badge color="green">編集可能</Badge>;
    }
  }

  const selectData = years.map((y) => {
    const yearStatus = closureStatuses.find((s) => s.fiscal_year === y);
    const label = getStatusLabel(yearStatus?.status || 'open');
    return { value: y.toString(), label: `${y}年度${label}` };
  });

  return (
    <>
      <Group gap="md" mb="md">
        <Group gap="xs">
          <Text fw={500}>年度:</Text>
          <Select
            data={selectData}
            value={currentYear.toString()}
            onChange={handleYearChange}
            size="sm"
            w={180}
          />
        </Group>

        {getStatusBadge()}

        {status === 'open' && (
          <Button
            variant="outline"
            color="yellow"
            size="xs"
            onClick={() => setShowClosureDialog(true)}
          >
            年度締め
          </Button>
        )}

        {status === 'closed' && (
          <Button
            variant="outline"
            color="blue"
            size="xs"
            disabled={reopening}
            loading={reopening}
            onClick={handleReopen}
          >
            締め解除
          </Button>
        )}

        {status === 'locked' && (
          <Button
            variant="outline"
            size="xs"
            onClick={() => setShowUnlockDialog(true)}
          >
            ロック解除申請
          </Button>
        )}
      </Group>

      {showClosureDialog && (
        <YearClosureDialog
          organizationId={organizationId}
          year={currentYear}
          onClose={() => setShowClosureDialog(false)}
          onSuccess={handleSuccess}
        />
      )}

      {showUnlockDialog && (
        <UnlockRequestDialog
          organizationId={organizationId}
          year={currentYear}
          hasPendingRequest={false}
          onClose={() => setShowUnlockDialog(false)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
