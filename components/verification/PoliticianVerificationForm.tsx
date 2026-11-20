'use client';

import { useState, useEffect } from 'react';
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
  Code,
  SimpleGrid,
  SegmentedControl,
  Box,
} from '@mantine/core';
import {
  IconInfoCircle,
  IconAlertTriangle,
  IconCircleCheck,
} from '@tabler/icons-react';

interface Politician {
  id: string;
  name: string;
  verified_at: string | null;
  verified_domain: string | null;
}

interface PoliticianVerification {
  id: string;
  name: string;
  official_email: string;
  official_domain: string;
  status: string;
  created_at: string;
  request_type?: string;
  verification_method?: string;
  is_lg_domain?: boolean;
  dns_txt_token?: string;
}

interface CandidateRegistrationInfo {
  election_name: string;
  district: string;
  candidate_name: string;
  registration_date: string;
}

interface PoliticalFundReportInfo {
  organization_name: string;
  representative_name: string;
  registration_authority: string;
}

interface Props {
  userId: string;
  userEmail: string;
  verifiedPolitician: Politician | null;
  politicianVerifications: PoliticianVerification[];
  changeDomain?: boolean;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: '認証待ち', color: 'yellow' },
  email_sent: { label: 'メール送信済', color: 'blue' },
  email_verified: { label: '承認待ち', color: 'blue' },
  dns_verified: { label: '承認待ち', color: 'blue' },
  approved: { label: '承認済み', color: 'green' },
  rejected: { label: '却下', color: 'red' },
};

const registrationAuthorities = [
  '総務省', '北海道選管', '青森県選管', '岩手県選管', '宮城県選管',
  '秋田県選管', '山形県選管', '福島県選管', '茨城県選管', '栃木県選管',
  '群馬県選管', '埼玉県選管', '千葉県選管', '東京都選管', '神奈川県選管',
  '新潟県選管', '富山県選管', '石川県選管', '福井県選管', '山梨県選管',
  '長野県選管', '岐阜県選管', '静岡県選管', '愛知県選管', '三重県選管',
  '滋賀県選管', '京都府選管', '大阪府選管', '兵庫県選管', '奈良県選管',
  '和歌山県選管', '鳥取県選管', '島根県選管', '岡山県選管', '広島県選管',
  '山口県選管', '徳島県選管', '香川県選管', '愛媛県選管', '高知県選管',
  '福岡県選管', '佐賀県選管', '長崎県選管', '熊本県選管', '大分県選管',
  '宮崎県選管', '鹿児島県選管', '沖縄県選管',
];

function isLgJpDomain(domain: string): boolean {
  const lowerDomain = domain.toLowerCase();
  return lowerDomain === 'lg.jp' || lowerDomain.endsWith('.lg.jp');
}

function getDomainFromEmail(email: string): string {
  return email.split('@')[1] || '';
}

function VerificationInfoForm({
  type,
  setType,
  candidate,
  setCandidate,
  fund,
  setFund,
}: {
  type: 'candidate' | 'fund';
  setType: (v: 'candidate' | 'fund') => void;
  candidate: CandidateRegistrationInfo;
  setCandidate: (v: CandidateRegistrationInfo) => void;
  fund: PoliticalFundReportInfo;
  setFund: (v: PoliticalFundReportInfo) => void;
}) {
  return (
    <Stack>
      <Alert color="yellow" icon={<IconAlertTriangle size={16} />}>
        本人確認のため、以下のいずれかの情報を入力してください。
      </Alert>

      <SegmentedControl
        value={type}
        onChange={(v) => setType(v as 'candidate' | 'fund')}
        data={[
          { label: '立候補届出情報', value: 'candidate' },
          { label: '政治資金収支報告書', value: 'fund' },
        ]}
      />

      {type === 'candidate' ? (
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          <TextInput
            label="選挙名 *"
            value={candidate.election_name}
            onChange={(e) =>
              setCandidate({ ...candidate, election_name: e.currentTarget.value })
            }
            placeholder="例: 第50回衆議院議員総選挙"
            required
          />
          <TextInput
            label="選挙区 *"
            value={candidate.district}
            onChange={(e) =>
              setCandidate({ ...candidate, district: e.currentTarget.value })
            }
            placeholder="例: 東京都第1区"
            required
          />
          <TextInput
            label="氏名 *"
            value={candidate.candidate_name}
            onChange={(e) =>
              setCandidate({ ...candidate, candidate_name: e.currentTarget.value })
            }
            placeholder="例: 山田太郎"
            required
          />
          <TextInput
            label="届出年月日 *"
            type="date"
            value={candidate.registration_date}
            onChange={(e) =>
              setCandidate({ ...candidate, registration_date: e.currentTarget.value })
            }
            required
          />
        </SimpleGrid>
      ) : (
        <SimpleGrid cols={{ base: 1, md: 3 }}>
          <TextInput
            label="団体名 *"
            value={fund.organization_name}
            onChange={(e) =>
              setFund({ ...fund, organization_name: e.currentTarget.value })
            }
            placeholder="例: 山田太郎後援会"
            required
          />
          <TextInput
            label="代表者名 *"
            value={fund.representative_name}
            onChange={(e) =>
              setFund({ ...fund, representative_name: e.currentTarget.value })
            }
            placeholder="例: 山田太郎"
            required
          />
          <NativeSelect
            label="届出先 *"
            value={fund.registration_authority}
            onChange={(e) =>
              setFund({ ...fund, registration_authority: e.currentTarget.value })
            }
            data={[
              { value: '', label: '選択してください' },
              ...registrationAuthorities.map((a) => ({ value: a, label: a })),
            ]}
            required
          />
        </SimpleGrid>
      )}
    </Stack>
  );
}

export function PoliticianVerificationForm({
  userId,
  userEmail,
  verifiedPolitician,
  politicianVerifications,
  changeDomain = false,
}: Props) {
  const router = useRouter();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [url, setUrl] = useState('');
  const [party, setParty] = useState('');

  const [isLgDomain, setIsLgDomain] = useState(false);

  const [infoType, setInfoType] = useState<'candidate' | 'fund'>('candidate');
  const [candidateInfo, setCandidateInfo] = useState<CandidateRegistrationInfo>({
    election_name: '',
    district: '',
    candidate_name: '',
    registration_date: '',
  });
  const [fundInfo, setFundInfo] = useState<PoliticalFundReportInfo>({
    organization_name: '',
    representative_name: '',
    registration_authority: '',
  });

  const [newEmail, setNewEmail] = useState('');
  const [newInfoType, setNewInfoType] = useState<'candidate' | 'fund'>('candidate');
  const [newCandidateInfo, setNewCandidateInfo] = useState<CandidateRegistrationInfo>({
    election_name: '',
    district: '',
    candidate_name: '',
    registration_date: '',
  });
  const [newFundInfo, setNewFundInfo] = useState<PoliticalFundReportInfo>({
    organization_name: '',
    representative_name: '',
    registration_authority: '',
  });

  const [verificationCode, setVerificationCode] = useState('');
  const [activeVerificationId, setActiveVerificationId] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const domain = getDomainFromEmail(email);
    setIsLgDomain(isLgJpDomain(domain));
  }, [email]);

  const [newIsLgDomain, setNewIsLgDomain] = useState(false);
  useEffect(() => {
    const domain = getDomainFromEmail(newEmail);
    setNewIsLgDomain(isLgJpDomain(domain));
  }, [newEmail]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    const requestBody: Record<string, unknown> = {
      name,
      official_email: email,
      official_url: url || undefined,
      party: party || undefined,
      request_type: 'new',
    };

    if (infoType === 'candidate') {
      requestBody.candidate_registration_info = candidateInfo;
    } else {
      requestBody.political_fund_report_info = fundInfo;
    }

    try {
      const response = await fetch('/api/politicians/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '申請に失敗しました');
      }

      setMessage({ type: 'success', text: '認証申請を送信しました' });
      setShowForm(false);
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

  const handleDomainChangeSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!verifiedPolitician) return;

    setIsSubmitting(true);
    setMessage(null);

    const requestBody: Record<string, unknown> = {
      name: verifiedPolitician.name,
      official_email: newEmail,
      politician_id: verifiedPolitician.id,
      request_type: 'domain_change',
      previous_domain: verifiedPolitician.verified_domain,
    };

    if (newInfoType === 'candidate') {
      requestBody.candidate_registration_info = newCandidateInfo;
    } else {
      requestBody.political_fund_report_info = newFundInfo;
    }

    try {
      const response = await fetch('/api/politicians/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '申請に失敗しました');
      }

      setMessage({ type: 'success', text: 'ドメイン変更申請を送信しました' });
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

  const handleSendCode = async (verificationId: string) => {
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/politicians/verify/${verificationId}/send-code`,
        { method: 'POST' },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'コード送信に失敗しました');
      }

      setActiveVerificationId(verificationId);
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

  const handleVerifyDns = async (verificationId: string) => {
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/politicians/verify/${verificationId}/verify-dns`,
        { method: 'POST' },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'DNS TXT検証に失敗しました');
      }

      setMessage({
        type: 'success',
        text: 'DNS TXT認証が完了しました。管理者の承認をお待ちください。',
      });
      setTimeout(() => router.refresh(), 1500);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'DNS TXT検証に失敗しました',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeVerificationId) return;

    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/politicians/verify/${activeVerificationId}/verify-code`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: verificationCode }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '認証に失敗しました');
      }

      setMessage({ type: 'success', text: 'メール認証が完了しました' });
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

  const DnsTxtVerificationUI = ({
    verification,
  }: {
    verification: PoliticianVerification;
  }) => (
    <Card withBorder shadow="sm">
      <Stack>
        <Title order={4}>DNS TXT認証</Title>
        <Alert color="blue" icon={<IconInfoCircle size={16} />}>
          ドメインの所有権を確認するため、DNS TXTレコードを設定してください。
        </Alert>

        <Box p="md" bg="gray.1" style={{ borderRadius: 'var(--mantine-radius-md)', fontFamily: 'monospace', fontSize: 'var(--mantine-font-size-sm)' }}>
          <Stack gap="xs">
            <Group>
              <Text c="dimmed" size="sm">ドメイン:</Text>
              <Text fw={700} size="sm">{verification.official_domain}</Text>
            </Group>
            <Group>
              <Text c="dimmed" size="sm">タイプ:</Text>
              <Text fw={700} size="sm">TXT</Text>
            </Group>
            <Group>
              <Text c="dimmed" size="sm">値:</Text>
              <Code>polimoney-verify={verification.dns_txt_token}</Code>
            </Group>
          </Stack>
        </Box>

        <Text size="sm" c="dimmed">
          DNS設定が反映されるまで数分〜数時間かかる場合があります。
          設定後、「検証する」ボタンをクリックしてください。
        </Text>

        <Group justify="flex-end">
          <Button onClick={() => handleVerifyDns(verification.id)} loading={isSubmitting}>
            検証する
          </Button>
        </Group>
      </Stack>
    </Card>
  );

  const VerificationHistoryItem = ({ v }: { v: PoliticianVerification }) => (
    <Group justify="space-between" p="md" bg="gray.1" style={{ borderRadius: 'var(--mantine-radius-md)' }}>
      <Box>
        <Group gap="xs">
          <Text fw={500}>{v.name}</Text>
          <Text size="sm" c="dimmed">({v.official_email})</Text>
        </Group>
        <Group gap="xs" mt={4}>
          <Text size="xs" c="dimmed">
            {new Date(v.created_at).toLocaleDateString('ja-JP')}
          </Text>
          {v.is_lg_domain && <Badge size="xs" color="blue">lg.jp</Badge>}
          {v.verification_method === 'dns_txt' && <Badge size="xs" color="violet">DNS TXT</Badge>}
        </Group>
      </Box>
      <Group gap="xs">
        <Badge color={statusLabels[v.status]?.color || 'gray'}>
          {statusLabels[v.status]?.label || v.status}
        </Badge>
        {v.status === 'pending' && v.verification_method === 'email' && (
          <Button size="xs" onClick={() => handleSendCode(v.id)} loading={isSubmitting}>
            認証コードを送信
          </Button>
        )}
        {v.status === 'email_sent' && (
          <Button size="xs" variant="outline" onClick={() => handleSendCode(v.id)} loading={isSubmitting}>
            コードを再送信
          </Button>
        )}
      </Group>
    </Group>
  );

  const VerificationCodeInput = () => (
    <Card withBorder shadow="sm">
      <Stack>
        <Title order={4}>認証コードを入力</Title>
        <Text size="sm" c="dimmed">
          メールに送信された6桁のコードを入力してください。
        </Text>
        <form onSubmit={handleVerifyCode}>
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
        </form>
      </Stack>
    </Card>
  );

  if (changeDomain && verifiedPolitician) {
    const pendingDnsVerification = politicianVerifications.find(
      (v) =>
        v.request_type === 'domain_change' &&
        v.status === 'pending' &&
        v.verification_method === 'dns_txt',
    );

    return (
      <Stack>
        {message && (
          <Alert color={message.type === 'success' ? 'green' : 'red'}>
            {message.text}
          </Alert>
        )}

        <Card withBorder shadow="sm">
          <Stack>
            <Title order={4}>現在の認証情報</Title>
            <Box p="md" bg="gray.1" style={{ borderRadius: 'var(--mantine-radius-md)' }}>
              <SimpleGrid cols={2} spacing="xs">
                <Text c="dimmed" size="sm">氏名</Text>
                <Text fw={500} size="sm">{verifiedPolitician.name}</Text>
                <Text c="dimmed" size="sm">認証ドメイン</Text>
                <Text ff="monospace" size="sm">{verifiedPolitician.verified_domain}</Text>
                <Text c="dimmed" size="sm">認証日</Text>
                <Text size="sm">
                  {verifiedPolitician.verified_at
                    ? new Date(verifiedPolitician.verified_at).toLocaleDateString('ja-JP')
                    : '-'}
                </Text>
              </SimpleGrid>
            </Box>
          </Stack>
        </Card>

        {pendingDnsVerification && <DnsTxtVerificationUI verification={pendingDnsVerification} />}
        {activeVerificationId && <VerificationCodeInput />}

        <Card withBorder shadow="sm">
          <Stack>
            <Title order={4}>ドメイン変更申請</Title>
            <Alert color="yellow" icon={<IconAlertTriangle size={16} />}>
              新しいドメインで認証を行います。承認後、認証ドメインが変更されます。
            </Alert>

            <form onSubmit={handleDomainChangeSubmit}>
              <Stack>
                <TextInput
                  label={<>新しい公式メールアドレス <Text component="span" c="red">*</Text></>}
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.currentTarget.value)}
                  placeholder="例: info@new-domain.jp"
                  required
                  description={
                    newEmail
                      ? newIsLgDomain
                        ? '🏛️ lg.jpドメイン - メール認証を使用します'
                        : '🔐 DNS TXT認証が必要です'
                      : undefined
                  }
                />

                <VerificationInfoForm
                  type={newInfoType}
                  setType={setNewInfoType}
                  candidate={newCandidateInfo}
                  setCandidate={setNewCandidateInfo}
                  fund={newFundInfo}
                  setFund={setNewFundInfo}
                />

                <Group>
                  <Button type="submit" loading={isSubmitting} disabled={!newEmail}>
                    変更を申請
                  </Button>
                  <Button component="a" href="/profile/politician" variant="default">
                    キャンセル
                  </Button>
                </Group>
              </Stack>
            </form>
          </Stack>
        </Card>

        {politicianVerifications.filter((v) => v.request_type === 'domain_change').length > 0 && (
          <Card withBorder shadow="sm">
            <Stack>
              <Title order={4}>ドメイン変更申請履歴</Title>
              <Stack gap="sm">
                {politicianVerifications
                  .filter((v) => v.request_type === 'domain_change')
                  .map((v) => <VerificationHistoryItem key={v.id} v={v} />)}
              </Stack>
            </Stack>
          </Card>
        )}
      </Stack>
    );
  }

  const pendingDnsVerification = politicianVerifications.find(
    (v) => v.status === 'pending' && v.verification_method === 'dns_txt',
  );

  return (
    <Stack>
      {message && (
        <Alert color={message.type === 'success' ? 'green' : 'red'}>
          {message.text}
        </Alert>
      )}

      {verifiedPolitician && (
        <Card withBorder shadow="sm">
          <Group gap="md">
            <Box
              w={64}
              h={64}
              bg="green.1"
              style={{ borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <IconCircleCheck size={32} color="var(--mantine-color-green-6)" />
            </Box>
            <Box>
              <Text size="lg" fw={700}>{verifiedPolitician.name}</Text>
              <Text c="dimmed">認証済み（{verifiedPolitician.verified_domain}）</Text>
              <Text size="sm" c="dimmed">
                認証日:{' '}
                {verifiedPolitician.verified_at
                  ? new Date(verifiedPolitician.verified_at).toLocaleDateString('ja-JP')
                  : '-'}
              </Text>
            </Box>
          </Group>
        </Card>
      )}

      {!verifiedPolitician && (
        <>
          {pendingDnsVerification && <DnsTxtVerificationUI verification={pendingDnsVerification} />}

          {politicianVerifications.length > 0 && (
            <Card withBorder shadow="sm">
              <Stack>
                <Title order={4}>申請履歴</Title>
                <Stack gap="sm">
                  {politicianVerifications.map((v) => <VerificationHistoryItem key={v.id} v={v} />)}
                </Stack>
              </Stack>
            </Card>
          )}

          {activeVerificationId && <VerificationCodeInput />}

          {showForm ? (
            <Card withBorder shadow="sm">
              <Stack>
                <Title order={4}>認証申請</Title>
                <form onSubmit={handleSubmit}>
                  <Stack>
                    <SimpleGrid cols={{ base: 1, md: 2 }}>
                      <TextInput
                        label="氏名 *"
                        value={name}
                        onChange={(e) => setName(e.currentTarget.value)}
                        placeholder="山田 太郎"
                        required
                      />
                      <TextInput
                        label="公式メールアドレス *"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.currentTarget.value)}
                        placeholder="例: info@example.lg.jp"
                        required
                        description={
                          email
                            ? isLgDomain
                              ? '🏛️ lg.jpドメイン - メール認証を使用します'
                              : '🔐 DNS TXT認証が必要です'
                            : undefined
                        }
                      />
                      <TextInput
                        label="公式サイト URL"
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.currentTarget.value)}
                        placeholder="https://"
                      />
                      <TextInput
                        label="所属政党"
                        value={party}
                        onChange={(e) => setParty(e.currentTarget.value)}
                        placeholder="無所属"
                      />
                    </SimpleGrid>

                    <VerificationInfoForm
                      type={infoType}
                      setType={setInfoType}
                      candidate={candidateInfo}
                      setCandidate={setCandidateInfo}
                      fund={fundInfo}
                      setFund={setFundInfo}
                    />

                    <Group>
                      <Button type="submit" loading={isSubmitting}>
                        申請する
                      </Button>
                      <Button variant="default" onClick={() => setShowForm(false)}>
                        キャンセル
                      </Button>
                    </Group>
                  </Stack>
                </form>
              </Stack>
            </Card>
          ) : (
            <Card withBorder shadow="sm">
              <Stack>
                <Title order={4}>新規認証申請</Title>
                <Text c="dimmed">
                  政治家として認証されると、選挙台帳を作成できるようになります。
                  認証にはlg.jpドメインの場合はメール認証、それ以外はDNS TXT認証が必要です。
                </Text>
                <Box>
                  <Button onClick={() => setShowForm(true)}>認証を申請する</Button>
                </Box>
              </Stack>
            </Card>
          )}
        </>
      )}
    </Stack>
  );
}
