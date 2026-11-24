'use client';

import { Suspense, useState, useEffect, useCallback, type ComponentProps } from 'react';
import { Container, Loader, Center, Alert } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { PoliticianVerificationForm } from '@/components/verification/PoliticianVerificationForm';
import { useSearchParams } from 'next/navigation';
import { apiJson } from '@/lib/api-client';

/** GET /v1/politicians/verify のレスポンス */
type VerifyPoliticianData = Pick<
  ComponentProps<typeof PoliticianVerificationForm>,
  'userId' | 'userEmail' | 'verifiedPolitician' | 'politicianVerifications'
>;

function VerifyPoliticianContent() {
  const searchParams = useSearchParams();
  const changeDomain = searchParams.get('change_domain') === 'true';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VerifyPoliticianData | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 申請・認証後に再取得したとき、フォームの内部状態をリセットするためのキー
  const [version, setVersion] = useState(0);

  const load = useCallback(async () => {
    try {
      setData(await apiJson<VerifyPoliticianData>('/v1/politicians/verify'));
      setError(null);
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : '認証情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Center h={400}><Loader /></Center>;
  if (error) return <Container size="sm"><Alert color="red" icon={<IconAlertTriangle />}>{error}</Alert></Container>;
  if (!data) return null;

  return (
    <Container size="sm">
      <PoliticianVerificationForm
        key={version}
        userId={data.userId}
        userEmail={data.userEmail}
        verifiedPolitician={data.verifiedPolitician}
        politicianVerifications={data.politicianVerifications ?? []}
        changeDomain={changeDomain}
        onUpdated={load}
      />
    </Container>
  );
}

export default function VerifyPoliticianPage() {
  return (
    <Suspense fallback={<Center h={400}><Loader /></Center>}>
      <VerifyPoliticianContent />
    </Suspense>
  );
}
