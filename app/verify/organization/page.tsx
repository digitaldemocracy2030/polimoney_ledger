'use client';

import { useState, useEffect } from 'react';
import { Container, Loader, Center } from '@mantine/core';
import { OrganizationManagerVerificationForm } from '@/components/verification/OrganizationManagerVerificationForm';
import { useSearchParams } from 'next/navigation';

export default function VerifyOrganizationPage() {
  const searchParams = useSearchParams();
  const changeDomain = searchParams.get('change_domain') === 'true';
  const targetOrganizationId = searchParams.get('organization_id');

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/organizations/manager-verify')
      .then((res) => res.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Center h={400}><Loader /></Center>;
  if (!data) return null;

  return (
    <Container size="sm">
      <OrganizationManagerVerificationForm
        userId={data.userId}
        userEmail={data.userEmail}
        managedOrganizations={data.managedOrganizations || []}
        organizationManagerVerifications={data.organizationManagerVerifications || []}
        hubOrganizations={data.hubOrganizations || []}
        changeDomain={changeDomain}
        targetOrganizationId={targetOrganizationId}
      />
    </Container>
  );
}
