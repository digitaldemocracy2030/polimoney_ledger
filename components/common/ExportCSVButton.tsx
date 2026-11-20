'use client';

import { useState } from 'react';
import { Button, Loader, Menu, Text } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';

interface ExportCSVButtonProps {
  ledgerId: string;
}

export function ExportCSVButton({ ledgerId }: ExportCSVButtonProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleExport = async (
    type: 'expense' | 'revenue' | 'summary' | 'assets' | 'all',
    includeImages = false,
  ) => {
    setIsLoading(type + (includeImages ? '_with_images' : ''));

    try {
      const params = new URLSearchParams({ type });
      params.set('ledger_id', ledgerId);
      if (includeImages) {
        params.set('include_images', 'true');
      }

      const response = await fetch(`/api/export-csv?${params.toString()}`);

      if (!response.ok) {
        let errorMessage = 'エクスポートに失敗しました';
        try {
          const json = await response.json();
          errorMessage = json.error || errorMessage;
        } catch {
          // noop
        }
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = type === 'all' ? '収支報告補助データ.zip' : 'export.csv';

      if (contentDisposition) {
        const match = contentDisposition.match(/filename\*=UTF-8''(.+)/);
        if (match) {
          filename = decodeURIComponent(match[1]);
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      alert(
        error instanceof Error ? error.message : 'エクスポートに失敗しました',
      );
    } finally {
      setIsLoading(null);
    }
  };

  const handleExportReport = async () => {
    setIsLoading('report');
    try {
      const params = new URLSearchParams();
      params.set('ledger_id', ledgerId);

      const response = await fetch(`/api/export-report?${params.toString()}`);

      if (!response.ok) {
        let errorMessage = 'エクスポートに失敗しました';
        try {
          const json = await response.json();
          errorMessage = json.error || errorMessage;
        } catch { /* noop */ }
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = '収支報告書_補助.csv';

      if (contentDisposition) {
        const match = contentDisposition.match(/filename\*=UTF-8''(.+)/);
        if (match) filename = decodeURIComponent(match[1]);
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export report error:', error);
      alert(error instanceof Error ? error.message : 'エクスポートに失敗しました');
    } finally {
      setIsLoading(null);
    }
  };

  const buttonLabel = isLoading ? 'ダウンロード中...' : 'CSV エクスポート';

  return (
    <Menu shadow="md" width={280}>
      <Menu.Target>
        <Button
          variant="outline"
          leftSection={<IconDownload size={18} />}
          disabled={isLoading !== null}
          loading={isLoading !== null}
        >
          {buttonLabel}
        </Button>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>一括ダウンロード</Menu.Label>
        <Menu.Item
          onClick={() => handleExport('all')}
          disabled={isLoading !== null}
          leftSection={isLoading === 'all' ? <Loader size="xs" /> : undefined}
        >
          <Text fw={700}>📦 CSV のみ（ZIP）</Text>
        </Menu.Item>
        <Menu.Item
          onClick={() => handleExport('all', true)}
          disabled={isLoading !== null}
          leftSection={isLoading === 'all_with_images' ? <Loader size="xs" /> : undefined}
        >
          <Text fw={700}>🖼️ CSV + 領収書画像（ZIP）</Text>
        </Menu.Item>

        <Menu.Label>個別ダウンロード</Menu.Label>
        <Menu.Item
          onClick={() => handleExport('expense')}
          disabled={isLoading !== null}
          leftSection={isLoading === 'expense' ? <Loader size="xs" /> : undefined}
        >
          支出一覧
        </Menu.Item>
        <Menu.Item
          onClick={() => handleExport('revenue')}
          disabled={isLoading !== null}
          leftSection={isLoading === 'revenue' ? <Loader size="xs" /> : undefined}
        >
          収入一覧
        </Menu.Item>
        <Menu.Item
          onClick={() => handleExport('summary')}
          disabled={isLoading !== null}
          leftSection={isLoading === 'summary' ? <Loader size="xs" /> : undefined}
        >
          科目別集計
        </Menu.Item>
        <Menu.Item
          onClick={() => handleExport('assets')}
          disabled={isLoading !== null}
          leftSection={isLoading === 'assets' ? <Loader size="xs" /> : undefined}
        >
          資産等一覧
        </Menu.Item>

        <Menu.Label>収支報告書準拠（試験）</Menu.Label>
        <Menu.Item
          onClick={handleExportReport}
          disabled={isLoading !== null}
          leftSection={isLoading === 'report' ? <Loader size="xs" /> : undefined}
          color="grape"
        >
          <Text fw={700}>📊 収支報告書 CSV（一括 ZIP）</Text>
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
