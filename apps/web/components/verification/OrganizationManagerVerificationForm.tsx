'use client';

import { apiFetch } from '@/lib/api-client';
import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Button, Card, TextInput, Select, Alert, Badge, Group, Stack, Text, Title, Code, Paper,
  SimpleGrid,
} from '@mantine/core';
import { IconAlertTriangle, IconInfoCircle, IconShieldCheck } from '@tabler/icons-react';

interface ManagedOrganization {
  id: string;
  name: string;
  type: string;
  manager_verified_at: string;
  manager_verified_domain: string;
}

interface OrganizationManagerVerification {
  id: string;
  organization_name: string;
  official_email: string;
  official_domain: string;
  status: string;
  created_at: string;
  request_type?: string;
  verification_method?: string;
  is_lg_domain?: boolean;
  dns_txt_token?: string;
}

interface Organization {
  id: string;
  name: string;
  type: string;
}

interface PoliticalFundReportInfo {
  organization_name: string;
  representative_name: string;
  registration_authority: string;
}

interface Props {
  userId: string;
  userEmail: string;
  managedOrganizations: ManagedOrganization[];
  organizationManagerVerifications: OrganizationManagerVerification[];
  hubOrganizations: Organization[];
  changeDomain?: boolean;
  targetOrganizationId?: string | null;
  /** 申請・認証の操作が完了したときに呼ばれる（親が最新データを再取得する） */
  onUpdated?: () => void;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: '認証待ち', color: 'yellow' },
  email_sent: { label: 'メール送信済', color: 'blue' },
  email_verified: { label: '承認待ち', color: 'blue' },
  dns_verified: { label: '承認待ち', color: 'blue' },
  approved: { label: '承認済み', color: 'green' },
  rejected: { label: '却下', color: 'red' },
};

const organizationTypeLabels: Record<string, string> = {
  political_party: '政党',
  support_group: '後援会',
  fund_management: '資金管理団体',
  other: 'その他',
};

const registrationAuthorities = [
  '総務省', '北海道選管', '青森県選管', '岩手県選管', '宮城県選管', '秋田県選管',
  '山形県選管', '福島県選管', '茨城県選管', '栃木県選管', '群馬県選管', '埼玉県選管',
  '千葉県選管', '東京都選管', '神奈川県選管', '新潟県選管', '富山県選管', '石川県選管',
  '福井県選管', '山梨県選管', '長野県選管', '岐阜県選管', '静岡県選管', '愛知県選管',
  '三重県選管', '滋賀県選管', '京都府選管', '大阪府選管', '兵庫県選管', '奈良県選管',
  '和歌山県選管', '鳥取県選管', '島根県選管', '岡山県選管', '広島県選管', '山口県選管',
  '徳島県選管', '香川県選管', '愛媛県選管', '高知県選管', '福岡県選管', '佐賀県選管',
  '長崎県選管', '熊本県選管', '大分県選管', '宮崎県選管', '鹿児島県選管', '沖縄県選管',
];

function isLgJpDomain(domain: string): boolean {
  const d = domain.toLowerCase();
  return d === 'lg.jp' || d.endsWith('.lg.jp');
}

function getDomainFromEmail(email: string): string {
  return email.split('@')[1] || '';
}

export function OrganizationManagerVerificationForm({
  userId, userEmail, managedOrganizations, organizationManagerVerifications,
  hubOrganizations, changeDomain = false, targetOrganizationId = null, onUpdated,
}: Props) {

  const targetOrganization = useMemo(() => {
    if (!changeDomain || !targetOrganizationId) return null;
    return managedOrganizations.find((org) => org.id === targetOrganizationId);
  }, [changeDomain, targetOrganizationId, managedOrganizations]);

  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState('other');
  const [orgEmail, setOrgEmail] = useState('');
  const [orgRole, setOrgRole] = useState('');

  const [fundInfo, setFundInfo] = useState<PoliticalFundReportInfo>({
    organization_name: '', representative_name: '', registration_authority: '',
  });
  const [newEmail, setNewEmail] = useState('');
  const [newFundInfo, setNewFundInfo] = useState<PoliticalFundReportInfo>({
    organization_name: '', representative_name: '', registration_authority: '',
  });

  const [verificationCode, setVerificationCode] = useState('');
  const [activeVerificationId, setActiveVerificationId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [isLgDomain, setIsLgDomain] = useState(false);
  useEffect(() => { setIsLgDomain(isLgJpDomain(getDomainFromEmail(orgEmail))); }, [orgEmail]);

  const [newIsLgDomain, setNewIsLgDomain] = useState(false);
  useEffect(() => { setNewIsLgDomain(isLgJpDomain(getDomainFromEmail(newEmail))); }, [newEmail]);

  const filteredOrgs = useMemo(() => {
    if (!searchQuery.trim()) return hubOrganizations;
    const query = searchQuery.toLowerCase();
    return hubOrganizations.filter((org) =>
      org.name.toLowerCase().includes(query) || (organizationTypeLabels[org.type] || org.type).toLowerCase().includes(query)
    );
  }, [searchQuery, hubOrganizations]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectOrg = (org: Organization | null) => {
    setSelectedOrg(org);
    if (org) { setSearchQuery(org.name); setOrgName(org.name); setOrgType(org.type); }
    else { setSearchQuery(''); setOrgName(''); setOrgType('other'); }
    setIsDropdownOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    try {
      const response = await apiFetch('/v1/organizations/manager-verify', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: selectedOrg?.id || undefined,
          organization_name: selectedOrg ? selectedOrg.name : orgName,
          organization_type: selectedOrg ? selectedOrg.type : orgType,
          official_email: orgEmail, role_in_organization: orgRole || undefined,
          request_type: 'new', political_fund_report_info: fundInfo,
        }),
      });
      if (!response.ok) { const error = await response.json(); throw new Error(error.error || '申請に失敗しました'); }
      setMessage({ type: 'success', text: '認証申請を送信しました' });
      setShowForm(false);
      setTimeout(() => onUpdated?.(), 1500);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : '申請に失敗しました' });
    } finally { setIsSubmitting(false); }
  };

  const handleDomainChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetOrganization) return;
    setIsSubmitting(true);
    setMessage(null);
    try {
      const response = await apiFetch('/v1/organizations/manager-verify', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: targetOrganization.id, organization_name: targetOrganization.name,
          official_email: newEmail, request_type: 'domain_change',
          previous_domain: targetOrganization.manager_verified_domain,
          political_fund_report_info: newFundInfo,
        }),
      });
      if (!response.ok) { const error = await response.json(); throw new Error(error.error || '申請に失敗しました'); }
      setMessage({ type: 'success', text: 'ドメイン変更申請を送信しました' });
      setTimeout(() => onUpdated?.(), 1500);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : '申請に失敗しました' });
    } finally { setIsSubmitting(false); }
  };

  const handleSendCode = async (verificationId: string) => {
    setIsSubmitting(true);
    setMessage(null);
    try {
      const response = await apiFetch(`/v1/organizations/manager-verify/${verificationId}/send-code`, { method: 'POST' });
      if (!response.ok) { const error = await response.json(); throw new Error(error.error || 'コード送信に失敗しました'); }
      setActiveVerificationId(verificationId);
      setMessage({ type: 'success', text: '認証コードを送信しました' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'コード送信に失敗しました' });
    } finally { setIsSubmitting(false); }
  };

  const handleVerifyDns = async (verificationId: string) => {
    setIsSubmitting(true);
    setMessage(null);
    try {
      const response = await apiFetch(`/v1/organizations/manager-verify/${verificationId}/verify-dns`, { method: 'POST' });
      if (!response.ok) { const error = await response.json(); throw new Error(error.error || 'DNS TXT検証に失敗しました'); }
      setMessage({ type: 'success', text: 'DNS TXT認証が完了しました。管理者の承認をお待ちください。' });
      setTimeout(() => onUpdated?.(), 1500);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'DNS TXT検証に失敗しました' });
    } finally { setIsSubmitting(false); }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeVerificationId) return;
    setIsSubmitting(true);
    setMessage(null);
    try {
      const response = await apiFetch(`/v1/organizations/manager-verify/${activeVerificationId}/verify-code`, {
        method: 'POST',
        body: JSON.stringify({ code: verificationCode }),
      });
      if (!response.ok) { const error = await response.json(); throw new Error(error.error || '認証に失敗しました'); }
      setMessage({ type: 'success', text: 'メール認証が完了しました' });
      setTimeout(() => onUpdated?.(), 1500);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : '認証に失敗しました' });
    } finally { setIsSubmitting(false); }
  };

  const DnsTxtVerificationUI = ({ verification }: { verification: OrganizationManagerVerification }) => (
    <Card withBorder>
      <Title order={4}>DNS TXT認証</Title>
      <Alert icon={<IconInfoCircle />} color="blue" mt="sm" mb="sm">ドメインの所有権を確認するため、DNS TXTレコードを設定してください。</Alert>
      <Paper p="md" bg="gray.1" radius="md">
        <Stack gap="xs">
          <Group><Text c="dimmed" size="sm">ドメイン:</Text><Text fw={700}>{verification.official_domain}</Text></Group>
          <Group><Text c="dimmed" size="sm">タイプ:</Text><Text fw={700}>TXT</Text></Group>
          <Group><Text c="dimmed" size="sm">値:</Text><Code>polimoney-verify={verification.dns_txt_token}</Code></Group>
        </Stack>
      </Paper>
      <Text size="sm" c="dimmed" mt="sm">DNS設定が反映されるまで数分〜数時間かかる場合があります。</Text>
      <Group justify="flex-end" mt="md">
        <Button onClick={() => handleVerifyDns(verification.id)} loading={isSubmitting}>検証する</Button>
      </Group>
    </Card>
  );

  const FundReportInfoForm = ({ value, onChange }: { value: PoliticalFundReportInfo; onChange: (v: PoliticalFundReportInfo) => void }) => (
    <Stack>
      <Alert icon={<IconAlertTriangle />} color="yellow">本人確認のため、政治資金収支報告書の情報を入力してください。</Alert>
      <SimpleGrid cols={{ base: 1, md: 3 }}>
        <TextInput label="団体名 *" value={value.organization_name} onChange={(e) => onChange({ ...value, organization_name: e.currentTarget.value })} placeholder="例: 山田太郎後援会" required />
        <TextInput label="代表者名 *" value={value.representative_name} onChange={(e) => onChange({ ...value, representative_name: e.currentTarget.value })} placeholder="例: 山田太郎" required />
        <Select label="届出先 *" data={registrationAuthorities} value={value.registration_authority} onChange={(v) => onChange({ ...value, registration_authority: v || '' })} placeholder="選択してください" required />
      </SimpleGrid>
    </Stack>
  );

  const VerificationHistory = ({ verifications, isDomainChange = false }: { verifications: OrganizationManagerVerification[]; isDomainChange?: boolean }) => (
    <Card withBorder>
      <Title order={4}>{isDomainChange ? 'ドメイン変更申請履歴' : '申請履歴'}</Title>
      <Stack mt="sm">
        {verifications.map((v) => (
          <Paper key={v.id} p="md" bg="gray.1" radius="md">
            <Group justify="space-between">
              <div>
                <Group gap="xs">
                  <Text fw={500}>{v.organization_name}</Text>
                  <Text size="sm" c="dimmed">({v.official_email})</Text>
                  {v.request_type === 'domain_change' && !isDomainChange && <Badge size="xs" color="yellow">ドメイン変更</Badge>}
                </Group>
                <Group gap="xs">
                  <Text size="xs" c="dimmed">{new Date(v.created_at).toLocaleDateString('ja-JP')}</Text>
                  {v.is_lg_domain && <Badge size="xs" color="blue">lg.jp</Badge>}
                  {v.verification_method === 'dns_txt' && <Badge size="xs" color="violet">DNS TXT</Badge>}
                </Group>
              </div>
              <Group gap="xs">
                <Badge color={statusConfig[v.status]?.color || 'gray'}>{statusConfig[v.status]?.label || v.status}</Badge>
                {v.status === 'pending' && v.verification_method === 'email' && <Button size="xs" onClick={() => handleSendCode(v.id)} loading={isSubmitting}>認証コードを送信</Button>}
                {v.status === 'email_sent' && <Button size="xs" variant="outline" onClick={() => handleSendCode(v.id)} loading={isSubmitting}>コードを再送信</Button>}
              </Group>
            </Group>
          </Paper>
        ))}
      </Stack>
    </Card>
  );

  const CodeInputCard = () => (
    <Card withBorder>
      <Title order={4}>認証コードを入力</Title>
      <Text size="sm" c="dimmed" mb="sm">メールに送信された6桁のコードを入力してください。</Text>
      <form onSubmit={handleVerifyCode}>
        <Group>
          <TextInput flex={1} value={verificationCode} onChange={(e) => setVerificationCode(e.currentTarget.value)} placeholder="6桁のコード" maxLength={6} />
          <Button type="submit" disabled={isSubmitting || verificationCode.length !== 6}>認証</Button>
        </Group>
      </form>
    </Card>
  );

  if (changeDomain && targetOrganization) {
    const pendingDns = organizationManagerVerifications.find(
      (v) => v.request_type === 'domain_change' && v.status === 'pending' && v.verification_method === 'dns_txt'
    );
    return (
      <Stack>
        {message && <Alert color={message.type === 'success' ? 'green' : 'red'}>{message.text}</Alert>}
        <Card withBorder>
          <Title order={4}>現在の認証情報</Title>
          <Paper p="md" bg="gray.1" radius="md" mt="sm"><SimpleGrid cols={2}>
            <Text c="dimmed" size="sm">団体名</Text><Text fw={500}>{targetOrganization.name}</Text>
            <Text c="dimmed" size="sm">団体種別</Text><Text>{organizationTypeLabels[targetOrganization.type] || targetOrganization.type}</Text>
            <Text c="dimmed" size="sm">認証ドメイン</Text><Code>{targetOrganization.manager_verified_domain}</Code>
            <Text c="dimmed" size="sm">認証日</Text><Text>{targetOrganization.manager_verified_at ? new Date(targetOrganization.manager_verified_at).toLocaleDateString('ja-JP') : '-'}</Text>
          </SimpleGrid></Paper>
        </Card>
        {pendingDns && <DnsTxtVerificationUI verification={pendingDns} />}
        {activeVerificationId && <CodeInputCard />}
        <Card withBorder>
          <Title order={4}>ドメイン変更申請</Title>
          <Alert icon={<IconAlertTriangle />} color="yellow" mb="sm">新しいドメインで認証を行います。承認後、認証ドメインが変更されます。</Alert>
          <form onSubmit={handleDomainChangeSubmit}><Stack>
            <TextInput label="新しい公式メールアドレス *" type="email" value={newEmail} onChange={(e) => setNewEmail(e.currentTarget.value)} placeholder="例: info@new-domain.jp" required description={newEmail ? (newIsLgDomain ? '🏛️ lg.jpドメイン - メール認証を使用します' : '🔐 DNS TXT認証が必要です') : undefined} />
            <FundReportInfoForm value={newFundInfo} onChange={setNewFundInfo} />
            <Group><Button type="submit" loading={isSubmitting} disabled={!newEmail}>変更を申請</Button><Button component="a" href={`/profile/organization/${targetOrganization.id}`} variant="default">キャンセル</Button></Group>
          </Stack></form>
        </Card>
        {organizationManagerVerifications.filter((v) => v.request_type === 'domain_change').length > 0 && (
          <VerificationHistory verifications={organizationManagerVerifications.filter((v) => v.request_type === 'domain_change')} isDomainChange />
        )}
      </Stack>
    );
  }

  if (changeDomain && targetOrganizationId && !targetOrganization) {
    return (
      <Alert color="red" title="団体が見つかりません">
        指定された政治団体が見つからないか、あなたが管理者として認証されていません。
        <Button component="a" href="/profile/organization" size="xs" mt="sm">政治団体情報に戻る</Button>
      </Alert>
    );
  }

  const pendingDns = organizationManagerVerifications.find(
    (v) => v.status === 'pending' && v.verification_method === 'dns_txt'
  );

  return (
    <Stack>
      {message && <Alert color={message.type === 'success' ? 'green' : 'red'}>{message.text}</Alert>}

      {managedOrganizations.length > 0 && (
        <Card withBorder>
          <Title order={4}>管理している政治団体</Title>
          <Stack mt="sm">
            {managedOrganizations.map((org) => (
              <Paper key={org.id} p="md" bg="gray.1" radius="md">
                <Group justify="space-between">
                  <Group gap="xs">
                    <IconShieldCheck size={20} color="var(--mantine-color-green-6)" />
                    <Text fw={500}>{org.name}</Text>
                    <Badge variant="outline" size="sm">{organizationTypeLabels[org.type] || org.type}</Badge>
                  </Group>
                  <Text size="sm" c="dimmed">{org.manager_verified_domain}</Text>
                </Group>
              </Paper>
            ))}
          </Stack>
        </Card>
      )}

      {pendingDns && <DnsTxtVerificationUI verification={pendingDns} />}

      {organizationManagerVerifications.filter((v) => v.status !== 'approved').length > 0 && (
        <VerificationHistory verifications={organizationManagerVerifications.filter((v) => v.status !== 'approved')} />
      )}

      {activeVerificationId && <CodeInputCard />}

      {showForm ? (
        <Card withBorder>
          <Title order={4}>認証申請</Title>
          <form onSubmit={handleSubmit}><Stack>
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <TextInput label="政治団体を検索・選択" value={searchQuery}
                onChange={(e) => { setSearchQuery(e.currentTarget.value); setSelectedOrg(null); setIsDropdownOpen(true); }}
                onFocus={() => setIsDropdownOpen(true)} placeholder="団体名を入力して検索..."
                description="既存の政治団体を選択するか、新規作成できます" />
              {isDropdownOpen && (
                <Paper withBorder shadow="xl" style={{ position: 'absolute', zIndex: 50, width: '100%', maxHeight: 240, overflowY: 'auto' }}>
                  <Stack gap={0}>
                    <Button variant="subtle" fullWidth justify="flex-start" onClick={() => handleSelectOrg(null)}>
                      <Text fw={500} c="blue">＋ 新規作成</Text><Text size="sm" c="dimmed" ml="xs">（一覧にない場合）</Text>
                    </Button>
                    {filteredOrgs.map((org) => (
                      <Button key={org.id} variant={selectedOrg?.id === org.id ? 'light' : 'subtle'} fullWidth justify="flex-start" onClick={() => handleSelectOrg(org)}>
                        <Text fw={500}>{org.name}</Text><Badge variant="outline" size="xs" ml="xs">{organizationTypeLabels[org.type] || org.type}</Badge>
                      </Button>
                    ))}
                    {filteredOrgs.length === 0 && searchQuery && <Text p="sm" c="dimmed">「{searchQuery}」に一致する団体が見つかりません</Text>}
                  </Stack>
                </Paper>
              )}
            </div>

            {!selectedOrg && (
              <Paper p="md" bg="gray.1" radius="md">
                <SimpleGrid cols={{ base: 1, md: 2 }}>
                  <TextInput label="政治団体名 *" value={orgName} onChange={(e) => setOrgName(e.currentTarget.value)} placeholder="○○後援会" required={!selectedOrg} />
                  <Select label="団体種別 *" data={Object.entries(organizationTypeLabels).map(([value, label]) => ({ value, label }))} value={orgType} onChange={(v) => setOrgType(v || 'other')} required />
                </SimpleGrid>
              </Paper>
            )}

            <TextInput label="公式メールアドレス *" type="email" value={orgEmail} onChange={(e) => setOrgEmail(e.currentTarget.value)} placeholder="例: info@party.example.jp" required description={orgEmail ? (isLgDomain ? '🏛️ lg.jpドメイン - メール認証を使用します' : '🔐 DNS TXT認証が必要です') : undefined} />
            <TextInput label="役職" value={orgRole} onChange={(e) => setOrgRole(e.currentTarget.value)} placeholder="例: 事務局長、会計責任者" />

            <FundReportInfoForm value={fundInfo} onChange={setFundInfo} />

            <Group>
              <Button type="submit" loading={isSubmitting} disabled={!selectedOrg && !orgName}>申請する</Button>
              <Button variant="default" onClick={() => { setShowForm(false); setSelectedOrg(null); setSearchQuery(''); }}>キャンセル</Button>
            </Group>
          </Stack></form>
        </Card>
      ) : (
        <Card withBorder>
          <Title order={4}>新規認証申請</Title>
          <Text c="dimmed" mb="md">政治団体の管理者として認証されると、その団体の収支台帳を管理できるようになります。認証にはlg.jpドメインの場合はメール認証、それ以外はDNS TXT認証が必要です。</Text>
          <Button onClick={() => setShowForm(true)}>認証を申請する</Button>
        </Card>
      )}
    </Stack>
  );
}
