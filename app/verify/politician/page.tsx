'use client';

import { useState, useEffect } from 'react';
import { Container, Loader, Center } from '@mantine/core';
import { PoliticianVerificationForm } from '@/components/verification/PoliticianVerificationForm';
import { useSearchParams } from 'next/navigation';

export default function VerifyPoliticianPage() {
  const searchParams = useSearchParams();
  const changeDomain = searchParams.get('change_domain') === 'true';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    userId: string;
    userEmail: string;
    verifiedPolitician: null;
    politicianVerifications: [];
  } | null>(null);

  useEffect(() => {
    fetch('/api/politicians/verify')
      .then((res) => res.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Center h={400}><Loader /></Center>;
  if (!data) return null;

  return (
    <Container size="sm">
      <PoliticianVerificationForm
        userId={data.userId}
        userEmail={data.userEmail}
        verifiedPolitician={data.verifiedPolitician}
        politicianVerifications={data.politicianVerifications}
        changeDomain={changeDomain}
      />
    </Container>
  );
}
