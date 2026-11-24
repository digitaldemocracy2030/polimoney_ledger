'use client';

import { Alert, Anchor, Card, Group, Stack, Text } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import Link from 'next/link';
import { ElectionRequestForm } from '@/components/elections/ElectionRequestForm';

export default function ElectionRequestPage() {
  return (
    <Stack>
      <Group gap="xs">
        <Anchor component={Link} href="/elections" size="sm">
          選挙台帳一覧
        </Anchor>
        <Text size="sm" c="dimmed">/</Text>
        <Anchor component={Link} href="/elections/new" size="sm">
          新規作成
        </Anchor>
        <Text size="sm" c="dimmed">/</Text>
        <Text size="sm">登録リクエスト</Text>
      </Group>

      <Card withBorder>
        <Stack>
          <Alert color="yellow" icon={<IconAlertTriangle />}>
            登録されている選挙の一覧に該当する選挙がない場合、こちらから登録をリクエストできます。
          </Alert>

          <Text c="dimmed">
            選挙の情報を入力してください。運営が確認後、承認されると選挙が利用可能になります。
          </Text>

          <ElectionRequestForm />
        </Stack>
      </Card>
    </Stack>
  );
}
