'use client';

import { useState, useEffect } from 'react';
import { Container, Loader, Center, Alert } from '@mantine/core';
import { PoliticianProfileForm } from '@/components/profile/PoliticianProfileForm';
import { IconAlertTriangle } from '@tabler/icons-react';
import { Button, Card, Title, Text, Stack } from '@mantine/core';

export default function PoliticianProfilePage() {
  const [loading, setLoading] = useState(true);
  const [politician, setPolitician] = useState<any>(null);

  useEffect(() => {
    fetch('/api/profile/politician')
      .then((res) => res.json())
      .then((data) => setPolitician(data.politician || null))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Center h={400}><Loader /></Center>;

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
