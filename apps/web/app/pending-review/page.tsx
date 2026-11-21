'use client';

import { useEffect, useState } from 'react';
import { Card, Text, Title, Alert, Button, Group, Stack, Paper } from '@mantine/core';
import { IconInfoCircle, IconX } from '@tabler/icons-react';
import { ApiError, apiJson } from '@/lib/api-client';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface PendingReviewData {
  registrationStatus?: string | null;
  email?: string;
  fullName?: string;
  status?: string;
  rejectionReason?: string;
}

export default function PendingReviewPage() {
  const [data, setData] = useState<PendingReviewData>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiJson<PendingReviewData>('/v1/pending-review')
      .then((d) => {
        // 審査中でなければダッシュボードへ
        if (d.registrationStatus !== 'pending_review') {
          window.location.href = '/dashboard';
          return;
        }
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          window.location.href = '/login?redirect=/pending-review';
          return;
        }
        console.error(err);
        setLoading(false);
      });
  }, []);

  const handleLogout = async () => {
    await getSupabaseBrowserClient().auth.signOut();
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <Stack align="center" justify="center" mih="100vh" bg="gray.0" p="md">
        <Text>読み込み中...</Text>
      </Stack>
    );
  }

  const isRejected = data.status === 'rejected';

  return (
    <Stack align="center" justify="center" mih="100vh" bg="gray.0" p="md">
      <Card shadow="xl" padding="xl" radius="md" w="100%" maw={480} ta="center">
        {isRejected ? (
          <>
            <Text size="3rem" mb="md">❌</Text>
            <Title order={2} c="red" mb="md">登録申請が却下されました</Title>
            <Alert color="red" icon={<IconX />} ta="left" mb="md">
              <Text fw={700}>却下理由</Text>
              <Text size="sm">{data.rejectionReason || '理由は記載されていません'}</Text>
            </Alert>
            <Text c="dimmed" mb="lg">
              再度申請される場合は、新しいアカウントで登録してください。
            </Text>
            <Group justify="center">
              <Button variant="subtle" onClick={handleLogout}>ログアウト</Button>
              <Button component="a" href="/">トップページへ</Button>
            </Group>
          </>
        ) : (
          <>
            <Text size="3rem" mb="md">⏳</Text>
            <Title order={2} mb="md">審査中です</Title>
            <Alert color="blue" icon={<IconInfoCircle />} ta="left" mb="md">
              <Text fw={700}>現在、登録申請を審査しています</Text>
              <Text size="sm">
                提出いただいた本人確認書類を確認中です。
                審査が完了次第、<Text span fw={700}>{data.email}</Text> 宛にメールでお知らせします。
              </Text>
            </Alert>
            <Paper bg="gray.0" p="md" radius="md" ta="left" mb="md">
              <Text size="sm" c="dimmed">申請者情報</Text>
              <Text fw={700}>{data.fullName}</Text>
              <Text size="sm">{data.email}</Text>
            </Paper>
            <Text size="sm" c="dimmed" mb="lg">
              審査には通常 1〜3 営業日かかります。しばらくお待ちください。
            </Text>
            <Group justify="center">
              <Button variant="subtle" onClick={handleLogout}>ログアウト</Button>
              <Button variant="outline" onClick={() => location.reload()}>更新</Button>
            </Group>
          </>
        )}
      </Card>
    </Stack>
  );
}
