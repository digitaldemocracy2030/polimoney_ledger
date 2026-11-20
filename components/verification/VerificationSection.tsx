'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Card,
  Alert,
  TextInput,
  NativeSelect,
  Badge,
  Stack,
  Group,
  Text,
  Title,
  Box,
  SimpleGrid,
} from '@mantine/core';
import {
  IconUser,
  IconBuilding,
  IconCircleCheck,
} from '@tabler/icons-react';

interface Politician {
  id: string;
  name: string;
  verified_at: string | null;
  verified_domain: string | null;
}

interface ManagedOrganization {
  id: string;
  name: string;
  type: string;
  manager_verified_at: string;
  manager_verified_domain: string;
}

interface PoliticianVerification {
  id: string;
  name: string;
  official_email: string;
  status: string;
  created_at: string;
}

interface OrganizationManagerVerification {
  id: string;
  organization_name: string;
  official_email: string;
  status: string;
  created_at: string;
}

interface Organization {
  id: string;
  name: string;
  type: string;
}

interface Props {
  userId: string;
  verifiedPolitician: Politician | null;
  managedOrganizations: ManagedOrganization[];
  politicianVerifications: PoliticianVerification[];
  organizationManagerVerifications: OrganizationManagerVerification[];
  hubOrganizations: Organization[];
}

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: '保留中', color: 'yellow' },
  email_sent: { label: 'メール送信済', color: 'blue' },
  email_verified: { label: '承認待ち', color: 'blue' },
  approved: { label: '承認済み', color: 'green' },
  rejected: { label: '却下', color: 'red' },
};

const organizationTypeLabels: Record<string, string> = {
  political_party: '政党',
  support_group: '後援会',
  fund_management: '資金管理団体',
  other: 'その他',
};

export function VerificationSection({
  userId,
  verifiedPolitician,
  managedOrganizations,
  politicianVerifications,
  organizationManagerVerifications,
  hubOrganizations,
}: Props) {
  const router = useRouter();

  const [showPoliticianForm, setShowPoliticianForm] = useState(false);
  const [politicianName, setPoliticianName] = useState('');
  const [politicianEmail, setPoliticianEmail] = useState('');
  const [politicianUrl, setPoliticianUrl] = useState('');
  const [politicianParty, setPoliticianParty] = useState('');

  const [showOrgManagerForm, setShowOrgManagerForm] = useState(false);
  const [orgId, setOrgId] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgEmail, setOrgEmail] = useState('');
  const [orgRole, setOrgRole] = useState('');
  const [orgType, setOrgType] = useState('other');

  const [verificationCode, setVerificationCode] = useState('');
  const [activeVerificationId, setActiveVerificationId] = useState<string | null>(null);
  const [activeVerificationType, setActiveVerificationType] = useState<'politician' | 'org_manager' | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handlePoliticianSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch('/api/politicians/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: politicianName,
          official_email: politicianEmail,
          official_url: politicianUrl || undefined,
          party: politicianParty || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '申請に失敗しました');
      }

      setMessage({ type: 'success', text: '認証申請を送信しました' });
      setShowPoliticianForm(false);
      setTimeout(() => router.refresh(), 1500);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '申請に失敗しました',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOrgManagerSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch('/api/organizations/manager-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: orgId || undefined,
          organization_name: orgName,
          organization_type: orgType,
          official_email: orgEmail,
          role_in_organization: orgRole || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '申請に失敗しました');
      }

      setMessage({ type: 'success', text: '認証申請を送信しました' });
      setShowOrgManagerForm(false);
      setTimeout(() => router.refresh(), 1500);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '申請に失敗しました',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendVerificationCode = async (
    verificationId: string,
    type: 'politician' | 'org_manager',
  ) => {
    setIsSubmitting(true);
    setMessage(null);

    try {
      const endpoint =
        type === 'politician'
          ? `/api/politicians/verify/${verificationId}/send-code`
          : `/api/organizations/manager-verify/${verificationId}/send-code`;

      const response = await fetch(endpoint, { method: 'POST' });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'コード送信に失敗しました');
      }

      setActiveVerificationId(verificationId);
      setActiveVerificationType(type);
      setMessage({ type: 'success', text: '認証コードを送信しました' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'コード送信に失敗しました',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeVerificationId || !activeVerificationType) return;

    setIsSubmitting(true);
    setMessage(null);

    try {
      const endpoint =
        activeVerificationType === 'politician'
          ? `/api/politicians/verify/${activeVerificationId}/verify-code`
          : `/api/organizations/manager-verify/${activeVerificationId}/verify-code`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verificationCode }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '認証に失敗しました');
      }

      setMessage({ type: 'success', text: 'メール認証が完了しました' });
      setActiveVerificationId(null);
      setActiveVerificationType(null);
      setVerificationCode('');
      setTimeout(() => router.refresh(), 1500);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '認証に失敗しました',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOrgSelect = (value: string) => {
    setOrgId(value);
    if (value) {
      const selected = hubOrganizations.find((o) => o.id === value);
      if (selected) {
        setOrgName(selected.name);
        setOrgType(selected.type);
      }
    } else {
      setOrgName('');
      setOrgType('other');
    }
  };

  return (
    <Stack>
      {message && (
        <Alert color={message.type === 'success' ? 'green' : 'red'}>
          {message.text}
        </Alert>
      )}

      <Card withBorder shadow="sm">
        <Stack>
          <Group>
            <IconUser size={24} />
            <Title order={3}>政治家認証</Title>
          </Group>

          {verifiedPolitician ? (
            <Group gap="sm">
              <Badge color="green" leftSection={<IconCircleCheck size={12} />}>
                認証済み
              </Badge>
              <Text fw={500}>{verifiedPolitician.name}</Text>
              <Text size="sm" c="dimmed">({verifiedPolitician.verified_domain})</Text>
            </Group>
          ) : (
            <>
              {politicianVerifications.length > 0 && (
                <Box>
                  <Text size="sm" fw={500} mb="xs">申請履歴</Text>
                  <Stack gap="xs">
                    {politicianVerifications.map((v) => (
                      <Group key={v.id} justify="space-between" p="sm" bg="gray.1" style={{ borderRadius: 'var(--mantine-radius-md)' }}>
                        <Box>
                          <Group gap="xs">
                            <Text fw={500}>{v.name}</Text>
                            <Text size="sm" c="dimmed">({v.official_email})</Text>
                          </Group>
                        </Box>
                        <Group gap="xs">
                          <Badge color={statusLabels[v.status]?.color || 'gray'}>
                            {statusLabels[v.status]?.label || v.status}
                          </Badge>
                          {v.status === 'email_sent' && (
                            <Button size="xs" onClick={() => handleSendVerificationCode(v.id, 'politician')} loading={isSubmitting}>
                              コードを再送信
                            </Button>
                          )}
                        </Group>
                      </Group>
                    ))}
                  </Stack>
                </Box>
              )}

              {activeVerificationId && activeVerificationType === 'politician' && (
                <form onSubmit={handleVerifyCode}>
                  <Stack gap="xs">
                    <Text size="sm">認証コード</Text>
                    <Group>
                      <TextInput
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.currentTarget.value)}
                        placeholder="6桁のコード"
                        maxLength={6}
                        style={{ flex: 1 }}
                      />
                      <Button type="submit" disabled={verificationCode.length !== 6} loading={isSubmitting}>
                        認証
                      </Button>
                    </Group>
                  </Stack>
                </form>
              )}

              {showPoliticianForm ? (
                <form onSubmit={handlePoliticianSubmit}>
                  <Stack>
                    <SimpleGrid cols={{ base: 1, md: 2 }}>
                      <TextInput label="氏名 *" value={politicianName} onChange={(e) => setPoliticianName(e.currentTarget.value)} required />
                      <TextInput label="公式メールアドレス *" type="email" value={politicianEmail} onChange={(e) => setPoliticianEmail(e.currentTarget.value)} placeholder="例: info@example.lg.jp" required />
                      <TextInput label="公式サイト URL" type="url" value={politicianUrl} onChange={(e) => setPoliticianUrl(e.currentTarget.value)} placeholder="https://" />
                      <TextInput label="所属政党" value={politicianParty} onChange={(e) => setPoliticianParty(e.currentTarget.value)} />
                    </SimpleGrid>
                    <Group>
                      <Button type="submit" loading={isSubmitting}>申請する</Button>
                      <Button variant="default" onClick={() => setShowPoliticianForm(false)}>キャンセル</Button>
                    </Group>
                  </Stack>
                </form>
              ) : (
                <Box>
                  <Button onClick={() => setShowPoliticianForm(true)}>政治家認証を申請</Button>
                </Box>
              )}
            </>
          )}
        </Stack>
      </Card>

      <Card withBorder shadow="sm">
        <Stack>
          <Group>
            <IconBuilding size={24} />
            <Title order={3}>政治団体管理者認証</Title>
          </Group>

          {managedOrganizations.length > 0 && (
            <Box>
              <Text size="sm" fw={500} mb="xs">管理している政治団体</Text>
              <Stack gap="xs">
                {managedOrganizations.map((org) => (
                  <Group key={org.id} justify="space-between" p="sm" bg="gray.1" style={{ borderRadius: 'var(--mantine-radius-md)' }}>
                    <Group gap="xs">
                      <Badge color="green" size="sm" leftSection={<IconCircleCheck size={10} />}>認証済</Badge>
                      <Text fw={500}>{org.name}</Text>
                      <Badge variant="outline" size="sm">{organizationTypeLabels[org.type] || org.type}</Badge>
                    </Group>
                    <Text size="sm" c="dimmed">{org.manager_verified_domain}</Text>
                  </Group>
                ))}
              </Stack>
            </Box>
          )}

          {organizationManagerVerifications.length > 0 && (
            <Box>
              <Text size="sm" fw={500} mb="xs">申請履歴</Text>
              <Stack gap="xs">
                {organizationManagerVerifications.filter((v) => v.status !== 'approved').map((v) => (
                  <Group key={v.id} justify="space-between" p="sm" bg="gray.1" style={{ borderRadius: 'var(--mantine-radius-md)' }}>
                    <Box>
                      <Group gap="xs">
                        <Text fw={500}>{v.organization_name}</Text>
                        <Text size="sm" c="dimmed">({v.official_email})</Text>
                      </Group>
                    </Box>
                    <Group gap="xs">
                      <Badge color={statusLabels[v.status]?.color || 'gray'}>{statusLabels[v.status]?.label || v.status}</Badge>
                      {v.status === 'email_sent' && (
                        <Button size="xs" onClick={() => handleSendVerificationCode(v.id, 'org_manager')} loading={isSubmitting}>コードを再送信</Button>
                      )}
                    </Group>
                  </Group>
                ))}
              </Stack>
            </Box>
          )}

          {activeVerificationId && activeVerificationType === 'org_manager' && (
            <form onSubmit={handleVerifyCode}>
              <Stack gap="xs">
                <Text size="sm">認証コード</Text>
                <Group>
                  <TextInput value={verificationCode} onChange={(e) => setVerificationCode(e.currentTarget.value)} placeholder="6桁のコード" maxLength={6} style={{ flex: 1 }} />
                  <Button type="submit" disabled={verificationCode.length !== 6} loading={isSubmitting}>認証</Button>
                </Group>
              </Stack>
            </form>
          )}

          {showOrgManagerForm ? (
            <form onSubmit={handleOrgManagerSubmit}>
              <Stack>
                <NativeSelect
                  label="既存の政治団体を選択"
                  value={orgId}
                  onChange={(e) => handleOrgSelect(e.currentTarget.value)}
                  description="既存の政治団体を選択するか、新規作成できます"
                  data={[
                    { value: '', label: '-- 新規作成 --' },
                    ...hubOrganizations.map((org) => ({
                      value: org.id,
                      label: `${org.name} (${organizationTypeLabels[org.type] || org.type})`,
                    })),
                  ]}
                />
                <SimpleGrid cols={{ base: 1, md: 2 }}>
                  <TextInput label="政治団体名 *" value={orgName} onChange={(e) => setOrgName(e.currentTarget.value)} required disabled={!!orgId} />
                  <NativeSelect
                    label="団体種別 *"
                    value={orgType}
                    onChange={(e) => setOrgType(e.currentTarget.value)}
                    required
                    disabled={!!orgId}
                    data={Object.entries(organizationTypeLabels).map(([value, label]) => ({ value, label }))}
                  />
                </SimpleGrid>
                <TextInput label="公式メールアドレス *" type="email" value={orgEmail} onChange={(e) => setOrgEmail(e.currentTarget.value)} placeholder="例: info@party.example.jp" required description="この政治団体の公式メールアドレスで認証を行います" />
                <TextInput label="役職" value={orgRole} onChange={(e) => setOrgRole(e.currentTarget.value)} placeholder="例: 事務局長、会計責任者" />
                <Group>
                  <Button type="submit" loading={isSubmitting}>申請する</Button>
                  <Button variant="default" onClick={() => setShowOrgManagerForm(false)}>キャンセル</Button>
                </Group>
              </Stack>
            </form>
          ) : (
            <Box>
              <Button onClick={() => setShowOrgManagerForm(true)}>政治団体管理者認証を申請</Button>
            </Box>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
