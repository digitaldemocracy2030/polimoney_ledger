'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button, Card, TextInput, Select, Alert, Badge, Group, Stack, Text, Title, Paper,
  SimpleGrid,
} from '@mantine/core';
import { IconUser, IconBuilding, IconCheck } from '@tabler/icons-react';

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

const statusConfig: Record<string, { label: string; color: string }> = {
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

  const handlePoliticianSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch('/api/politicians/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: politicianName, official_email: politicianEmail,
          official_url: politicianUrl || undefined, party: politicianParty || undefined,
        }),
      });
      if (!response.ok) { const error = await response.json(); throw new Error(error.error || '申請に失敗しました'); }
      setMessage({ type: 'success', text: '認証申請を送信しました' });
      setShowPoliticianForm(false);
      setTimeout(() => router.refresh(), 1500);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : '申請に失敗しました' });
    } finally { setIsSubmitting(false); }
  };

  const handleOrgManagerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch('/api/organizations/manager-verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: orgId || undefined, organization_name: orgName,
          organization_type: orgType, official_email: orgEmail,
          role_in_organization: orgRole || undefined,
        }),
      });
      if (!response.ok) { const error = await response.json(); throw new Error(error.error || '申請に失敗しました'); }
      setMessage({ type: 'success', text: '認証申請を送信しました' });
      setShowOrgManagerForm(false);
      setTimeout(() => router.refresh(), 1500);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : '申請に失敗しました' });
    } finally { setIsSubmitting(false); }
  };

  const handleSendVerificationCode = async (verificationId: string, type: 'politician' | 'org_manager') => {
    setIsSubmitting(true);
    setMessage(null);
    try {
      const endpoint = type === 'politician'
        ? `/api/politicians/verify/${verificationId}/send-code`
        : `/api/organizations/manager-verify/${verificationId}/send-code`;
      const response = await fetch(endpoint, { method: 'POST' });
      if (!response.ok) { const error = await response.json(); throw new Error(error.error || 'コード送信に失敗しました'); }
      setActiveVerificationId(verificationId);
      setActiveVerificationType(type);
      setMessage({ type: 'success', text: '認証コードを送信しました' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'コード送信に失敗しました' });
    } finally { setIsSubmitting(false); }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeVerificationId || !activeVerificationType) return;
    setIsSubmitting(true);
    setMessage(null);
    try {
      const endpoint = activeVerificationType === 'politician'
        ? `/api/politicians/verify/${activeVerificationId}/verify-code`
        : `/api/organizations/manager-verify/${activeVerificationId}/verify-code`;
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verificationCode }),
      });
      if (!response.ok) { const error = await response.json(); throw new Error(error.error || '認証に失敗しました'); }
      setMessage({ type: 'success', text: 'メール認証が完了しました' });
      setActiveVerificationId(null);
      setActiveVerificationType(null);
      setVerificationCode('');
      setTimeout(() => router.refresh(), 1500);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : '認証に失敗しました' });
    } finally { setIsSubmitting(false); }
  };

  const handleOrgSelect = (value: string | null) => {
    const selectedId = value || '';
    setOrgId(selectedId);
    if (selectedId) {
      const selected = hubOrganizations.find((o) => o.id === selectedId);
      if (selected) { setOrgName(selected.name); setOrgType(selected.type); }
    } else { setOrgName(''); setOrgType('other'); }
  };

  return (
    <Stack>
      {message && <Alert color={message.type === 'success' ? 'green' : 'red'}>{message.text}</Alert>}

      <Card withBorder>
        <Title order={3}><Group gap="xs"><IconUser size={24} />政治家認証</Group></Title>

        {verifiedPolitician ? (
          <Group mt="sm">
            <Badge color="green" leftSection={<IconCheck size={14} />}>認証済み</Badge>
            <Text fw={500}>{verifiedPolitician.name}</Text>
            <Text size="sm" c="dimmed">({verifiedPolitician.verified_domain})</Text>
          </Group>
        ) : (<>
          {politicianVerifications.length > 0 && (
            <Stack mt="sm" gap="xs">
              <Text size="sm" fw={500}>申請履歴</Text>
              {politicianVerifications.map((v) => (
                <Paper key={v.id} p="sm" bg="gray.1" radius="md">
                  <Group justify="space-between">
                    <div>
                      <Text fw={500}>{v.name}</Text>
                      <Text size="sm" c="dimmed">({v.official_email})</Text>
                    </div>
                    <Group gap="xs">
                      <Badge color={statusConfig[v.status]?.color || 'gray'}>{statusConfig[v.status]?.label || v.status}</Badge>
                      {v.status === 'email_sent' && <Button size="xs" onClick={() => handleSendVerificationCode(v.id, 'politician')} loading={isSubmitting}>コードを再送信</Button>}
                    </Group>
                  </Group>
                </Paper>
              ))}
            </Stack>
          )}

          {activeVerificationId && activeVerificationType === 'politician' && (
            <form onSubmit={handleVerifyCode}>
              <Group mt="sm">
                <TextInput flex={1} label="認証コード" value={verificationCode} onChange={(e) => setVerificationCode(e.currentTarget.value)} placeholder="6桁のコード" maxLength={6} />
                <Button type="submit" mt={24} disabled={isSubmitting || verificationCode.length !== 6}>認証</Button>
              </Group>
            </form>
          )}

          {showPoliticianForm ? (
            <form onSubmit={handlePoliticianSubmit}>
              <Stack mt="sm">
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
            <Group mt="sm"><Button onClick={() => setShowPoliticianForm(true)}>政治家認証を申請</Button></Group>
          )}
        </>)}
      </Card>

      <Card withBorder>
        <Title order={3}><Group gap="xs"><IconBuilding size={24} />政治団体管理者認証</Group></Title>

        {managedOrganizations.length > 0 && (
          <Stack mt="sm" gap="xs">
            <Text size="sm" fw={500}>管理している政治団体</Text>
            {managedOrganizations.map((org) => (
              <Paper key={org.id} p="sm" bg="gray.1" radius="md">
                <Group justify="space-between">
                  <Group gap="xs">
                    <Badge color="green" size="sm" leftSection={<IconCheck size={12} />}>認証済</Badge>
                    <Text fw={500}>{org.name}</Text>
                    <Badge variant="outline" size="sm">{organizationTypeLabels[org.type] || org.type}</Badge>
                  </Group>
                  <Text size="sm" c="dimmed">{org.manager_verified_domain}</Text>
                </Group>
              </Paper>
            ))}
          </Stack>
        )}

        {organizationManagerVerifications.filter((v) => v.status !== 'approved').length > 0 && (
          <Stack mt="sm" gap="xs">
            <Text size="sm" fw={500}>申請履歴</Text>
            {organizationManagerVerifications.filter((v) => v.status !== 'approved').map((v) => (
              <Paper key={v.id} p="sm" bg="gray.1" radius="md">
                <Group justify="space-between">
                  <div>
                    <Text fw={500}>{v.organization_name}</Text>
                    <Text size="sm" c="dimmed">({v.official_email})</Text>
                  </div>
                  <Group gap="xs">
                    <Badge color={statusConfig[v.status]?.color || 'gray'}>{statusConfig[v.status]?.label || v.status}</Badge>
                    {v.status === 'email_sent' && <Button size="xs" onClick={() => handleSendVerificationCode(v.id, 'org_manager')} loading={isSubmitting}>コードを再送信</Button>}
                  </Group>
                </Group>
              </Paper>
            ))}
          </Stack>
        )}

        {activeVerificationId && activeVerificationType === 'org_manager' && (
          <form onSubmit={handleVerifyCode}>
            <Group mt="sm">
              <TextInput flex={1} label="認証コード" value={verificationCode} onChange={(e) => setVerificationCode(e.currentTarget.value)} placeholder="6桁のコード" maxLength={6} />
              <Button type="submit" mt={24} disabled={isSubmitting || verificationCode.length !== 6}>認証</Button>
            </Group>
          </form>
        )}

        {showOrgManagerForm ? (
          <form onSubmit={handleOrgManagerSubmit}>
            <Stack mt="sm">
              <Select label="既存の政治団体を選択" data={[{ value: '', label: '-- 新規作成 --' }, ...hubOrganizations.map((org) => ({ value: org.id, label: `${org.name} (${organizationTypeLabels[org.type] || org.type})` }))]} value={orgId} onChange={handleOrgSelect} />
              <SimpleGrid cols={{ base: 1, md: 2 }}>
                <TextInput label="政治団体名 *" value={orgName} onChange={(e) => setOrgName(e.currentTarget.value)} required disabled={!!orgId} />
                <Select label="団体種別 *" data={Object.entries(organizationTypeLabels).map(([value, label]) => ({ value, label }))} value={orgType} onChange={(v) => setOrgType(v || 'other')} required disabled={!!orgId} />
                <TextInput label="公式メールアドレス *" type="email" value={orgEmail} onChange={(e) => setOrgEmail(e.currentTarget.value)} placeholder="例: info@party.example.jp" required description="この政治団体の公式メールアドレスで認証を行います" />
                <TextInput label="役職" value={orgRole} onChange={(e) => setOrgRole(e.currentTarget.value)} placeholder="例: 事務局長、会計責任者" />
              </SimpleGrid>
              <Group>
                <Button type="submit" loading={isSubmitting}>申請する</Button>
                <Button variant="default" onClick={() => setShowOrgManagerForm(false)}>キャンセル</Button>
              </Group>
            </Stack>
          </form>
        ) : (
          <Group mt="sm"><Button onClick={() => setShowOrgManagerForm(true)}>政治団体管理者認証を申請</Button></Group>
        )}
      </Card>
    </Stack>
  );
}
