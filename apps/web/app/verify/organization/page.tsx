'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { Container, Loader, Center, Alert } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { OrganizationManagerVerificationForm } from '@/components/verification/OrganizationManagerVerificationForm';
import { useSearchParams } from 'next/navigation';
import { apiJson } from '@/lib/api-client';

function VerifyOrganizationContent() {
  const searchParams = useSearchParams();
  const changeDomain = searchParams.get('change_domain') === 'true';
  const targetOrganizationId = searchParams.get('organization_id');

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  // 申請・認証後に再取得したとき、フォームの内部状態をリセットするためのキー
  const [version, setVersion] = useState(0);

  const load = useCallback(async () => {
    try {
      setData(await apiJson<any>('/v1/organizations/manager-verify'));
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
      <OrganizationManagerVerificationForm
        key={version}
        userId={data.userId}
        userEmail={data.userEmail}
        managedOrganizations={data.managedOrganizations || []}
        organizationManagerVerifications={data.organizationManagerVerifications || []}
        hubOrganizations={data.hubOrganizations || []}
        changeDomain={changeDomain}
        targetOrganizationId={targetOrganizationId}
        onUpdated={load}
      />
    </Container>
  );
}

export default function VerifyOrganizationPage() {
  return (
    <Suspense fallback={<Center h={400}><Loader /></Center>}>
      <VerifyOrganizationContent />
    </Suspense>
  );
}
