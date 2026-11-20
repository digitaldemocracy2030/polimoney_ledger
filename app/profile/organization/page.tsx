'use client';

import { useState, useEffect } from 'react';
import { Container, Loader, Center, Card, Title, Text, Stack, Group, Badge, Alert, Anchor, Paper } from '@mantine/core';
import { IconAlertTriangle, IconChevronRight, IconShieldCheck } from '@tabler/icons-react';
import { Button } from '@mantine/core';

const organizationTypeLabels: Record<string, string> = {
  political_party: '政党',
  support_group: '後援会',
  fund_management: '資金管理団体',
  other: 'その他',
};

interface ManagedOrganization {
  id: string;
  name: string;
  type: string;
  manager_verified_at: string;
  manager_verified_domain: string;
}

export default function OrganizationProfileListPage() {
  const [loading, setLoading] = useState(true);
  const [managedOrganizations, setManagedOrganizations] = useState<ManagedOrganization[]>([]);

  useEffect(() => {
    fetch('/api/profile/organization')
      .then((res) => res.json())
      .then((data) => setManagedOrganizations(data.managedOrganizations || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Center h={400}><Loader /></Center>;

  return (
    <Container size="sm">
      {managedOrganizations.length > 0 ? (
        <Stack>
          <Alert icon={<IconShieldCheck />} color="blue">
            管理者として認証された政治団体の情報を編集できます。
          </Alert>
          <Card withBorder>
            <Title order={3}>管理している政治団体</Title>
            <Stack mt="sm">
              {managedOrganizations.map((org) => (
                <Anchor key={org.id} href={`/profile/organization/${org.id}`} underline="never">
                  <Paper p="md" bg="gray.1" radius="md" style={{ cursor: 'pointer' }}>
                    <Group justify="space-between">
                      <div>
                        <Group gap="xs">
                          <Text fw={500}>{org.name}</Text>
                          <Badge variant="outline" size="sm">{organizationTypeLabels[org.type] || org.type}</Badge>
                        </Group>
                        <Text size="sm" c="dimmed">{org.manager_verified_domain}</Text>
                      </div>
                      <IconChevronRight size={20} color="var(--mantine-color-dimmed)" />
                    </Group>
                  </Paper>
                </Anchor>
              ))}
            </Stack>
          </Card>
        </Stack>
      ) : (
        <Card withBorder>
          <Stack>
            <Alert icon={<IconAlertTriangle />} color="yellow" title="管理している政治団体がありません">
              政治団体情報を編集するには、まず政治団体管理者認証を完了してください。
            </Alert>
            <Button component="a" href="/verify/organization">政治団体管理者認証を申請</Button>
          </Stack>
        </Card>
      )}
    </Container>
  );
}
