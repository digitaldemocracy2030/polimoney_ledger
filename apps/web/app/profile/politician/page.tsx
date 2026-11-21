'use client';

import { useState, useEffect } from 'react';
import { Container, Loader, Center, Alert } from '@mantine/core';
import { PoliticianProfileForm } from '@/components/profile/PoliticianProfileForm';
import { IconAlertTriangle } from '@tabler/icons-react';
import { Button, Card, Title, Text, Stack } from '@mantine/core';
import { apiJson } from '@/lib/api-client';

export default function PoliticianProfilePage() {
  const [loading, setLoading] = useState(true);
  const [politician, setPolitician] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiJson<{ politician?: any }>('/v1/profile/politician')
      .then((data) => setPolitician(data.politician || null))
      .catch((err) => setError(err instanceof Error ? err.message : '政治家情報の取得に失敗しました'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Center h={400}><Loader /></Center>;
  if (error) return <Container size="sm"><Alert color="red" icon={<IconAlertTriangle />}>{error}</Alert></Container>;

  return (
    <Container size="sm">
      {politician ? (
        <PoliticianProfileForm politician={politician} />
      ) : (
        <Card withBorder>
          <Stack>
            <Alert icon={<IconAlertTriangle />} color="yellow" title="政治家として認証されていません">
              政治家情報を編集するには、まず政治家認証を完了してください。
            </Alert>
            <Button component="a" href="/verify/politician">政治家認証を申請</Button>
          </Stack>
        </Card>
      )}
    </Container>
  );
}
