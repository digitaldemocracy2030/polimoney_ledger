'use client';

import { apiFetch } from '@/lib/api-client';
import { useEffect, useState } from 'react';
import { Container, Title, Alert, Loader, Stack } from '@mantine/core';
import { ContactManager } from '@/components/contacts/ContactManager';

interface Contact {
  id: string;
  contact_type: 'person' | 'corporation' | 'political_organization';
  name: string;
  address: string | null;
  occupation: string | null;
  hub_organization_id: string | null;
  is_name_private: boolean;
  is_address_private: boolean;
  is_occupation_private: boolean;
  privacy_reason_type: string | null;
  privacy_reason_other: string | null;
  created_at: string;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/v1/contacts')
      .then((res) => {
        if (!res.ok) throw new Error('関係者の取得に失敗しました');
        return res.json();
      })
      .then((json) => setContacts(json.data || []))
      .catch((err) =>
        setError(err instanceof Error ? err.message : '取得に失敗しました')
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Container size="lg" py="xl">
        <Stack align="center" py="xl">
          <Loader />
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="lg" py="xl">
      <Title order={2} mb="lg">
        関係者マスタ
      </Title>
      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}
      <ContactManager initialContacts={contacts} />
    </Container>
  );
}
