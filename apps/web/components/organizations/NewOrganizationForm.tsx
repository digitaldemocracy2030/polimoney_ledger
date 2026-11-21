'use client';

import { apiFetch } from '@/lib/api-client';
import { useState } from 'react';
import { Alert, Badge, Button, Group, Radio, Stack, Text } from '@mantine/core';
import { useRouter } from 'next/navigation';

interface ManagedOrganization {
  id: string;
  name: string;
  type: string;
  verified_at: string;
  verified_domain: string;
}

interface NewOrganizationFormProps {
  managedOrganizations: ManagedOrganization[];
}

const ORGANIZATION_TYPES: Record<string, string> = {
  political_party: '政党',
  support_group: '後援会',
  fund_management: '資金管理団体',
  other: 'その他の政治団体',
};

export function NewOrganizationForm({ managedOrganizations }: NewOrganizationFormProps) {
  const router = useRouter();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (!selectedOrgId) {
        setError('政治団体を選択してください');
        setIsSubmitting(false);
        return;
      }

      const selectedOrg = managedOrganizations.find((o) => o.id === selectedOrgId);
      if (!selectedOrg) {
        setError('選択された政治団体が見つかりません');
        setIsSubmitting(false);
        return;
      }

      const response = await apiFetch('/v1/organizations', {
        method: 'POST',
        body: JSON.stringify({
          name: selectedOrg.name,
          hub_organization_id: selectedOrgId,
        }),
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || '政治団体台帳の作成に失敗しました');
      }

      const result = await response.json();
      router.push(`/organizations/${result.organization_id}/ledger`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}

      <Stack
        gap={0}
        style={{ maxHeight: 384, overflowY: 'auto', border: '1px solid var(--mantine-color-default-border)', borderRadius: 'var(--mantine-radius-default)' }}
        mb="lg"
      >
        {managedOrganizations.length === 0 ? (
          <Text ta="center" c="dimmed" p="xl">
            管理する政治団体がありません
          </Text>
        ) : (
          managedOrganizations.map((org) => (
            <Group
              key={org.id}
              p="md"
              gap="md"
              onClick={() => setSelectedOrgId(org.id)}
              style={{
                cursor: 'pointer',
                borderBottom: '1px solid var(--mantine-color-default-border)',
                backgroundColor:
                  selectedOrgId === org.id
                    ? 'var(--mantine-color-blue-light)'
                    : undefined,
              }}
            >
              <Radio checked={selectedOrgId === org.id} onChange={() => setSelectedOrgId(org.id)} readOnly />
              <div style={{ flex: 1 }}>
                <Text fw={500}>{org.name}</Text>
                <Group gap="xs" mt={4}>
                  <Badge size="sm" color="blue">
                    {ORGANIZATION_TYPES[org.type] || org.type}
                  </Badge>
                  <Badge size="sm" color="green">
                    ✓ 認証済み
                  </Badge>
                </Group>
              </div>
            </Group>
          ))
        )}
      </Stack>

      <Group>
        <Button component="a" href="/organizations" variant="outline">
          キャンセル
        </Button>
        <Button
          type="submit"
          loading={isSubmitting}
          disabled={isSubmitting || !selectedOrgId}
          flex={1}
        >
          政治団体台帳を作成
        </Button>
      </Group>
    </form>
  );
}
