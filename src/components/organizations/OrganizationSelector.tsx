'use client';

import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  FileInput,
  Group,
  Loader,
  Modal,
  NativeSelect,
  Paper,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { IconAlertTriangle, IconSearch } from '@tabler/icons-react';
import type { Organization } from '@/lib/hub-client';

interface Props {
  initialOrganizations: Organization[];
}

const ORGANIZATION_TYPES: Record<string, string> = {
  political_party: '政党',
  support_group: '後援会',
  fund_management: '資金管理団体',
  other: 'その他の政治団体',
};

const EVIDENCE_TYPES: Record<string, string> = {
  registration_form: '政治団体設立届出書（控え）',
  name_list: '政治団体名簿のスクリーンショット',
  financial_report: '政治資金収支報告書の表紙',
};

export function OrganizationSelector({ initialOrganizations }: Props) {
  const [organizations] = useState<Organization[]>(initialOrganizations);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [showRequestForm, setShowRequestForm] = useState(false);

  const filteredOrganizations = useMemo(() => {
    return organizations.filter((org) => {
      const matchesSearch = org.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = !selectedType || org.type === selectedType;
      return matchesSearch && matchesType;
    });
  }, [organizations, searchTerm, selectedType]);

  const groupedByType = useMemo(() => {
    return filteredOrganizations.reduce(
      (acc, org) => {
        if (!acc[org.type]) acc[org.type] = [];
        acc[org.type].push(org);
        return acc;
      },
      {} as Record<string, Organization[]>,
    );
  }, [filteredOrganizations]);

  return (
    <div>
      <Card withBorder mb="lg">
        <Group wrap="wrap" gap="md">
          <TextInput
            flex={1}
            miw={200}
            label="🔍 検索"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.currentTarget.value)}
            placeholder="団体名で検索..."
            leftSection={<IconSearch size={16} />}
          />
          <NativeSelect
            w={192}
            label="種別"
            value={selectedType}
            onChange={(e) => setSelectedType(e.currentTarget.value)}
            data={[
              { value: '', label: 'すべて' },
              ...Object.entries(ORGANIZATION_TYPES).map(([value, label]) => ({ value, label })),
            ]}
          />
        </Group>
      </Card>

      <Stack gap="lg">
        {Object.keys(groupedByType).length > 0 ? (
          Object.entries(ORGANIZATION_TYPES).map(([type, typeName]) => {
            const orgs = groupedByType[type];
            if (!orgs || orgs.length === 0) return null;
            return (
              <div key={type}>
                <Group gap="xs" mb="sm">
                  <Text size="xl" fw={600}>
                    🏛️ {typeName}
                  </Text>
                </Group>
                <Card withBorder p={0}>
                  {orgs.map((org, i) => (
                    <Group
                      key={org.id}
                      justify="space-between"
                      p="md"
                      style={
                        i < orgs.length - 1
                          ? { borderBottom: '1px solid var(--mantine-color-default-border)' }
                          : undefined
                      }
                    >
                      <div>
                        <Text fw={500}>{org.name}</Text>
                        <Group gap="xs" mt={4}>
                          <Badge color="green" size="sm">
                            {ORGANIZATION_TYPES[org.type] || org.type}
                          </Badge>
                          <Text size="xs" c="dimmed">
                            {new Date(org.created_at).toLocaleDateString('ja-JP')}
                          </Text>
                        </Group>
                      </div>
                      <Button
                        component="a"
                        href={`/organizations/${org.id}/ledger`}
                        size="sm"
                      >
                        台帳を開く
                      </Button>
                    </Group>
                  ))}
                </Card>
              </div>
            );
          })
        ) : (
          <Card withBorder>
            <Stack align="center" py="lg">
              <Text c="dimmed">該当する政治団体が見つかりません</Text>
            </Stack>
          </Card>
        )}
      </Stack>

      <Alert color="yellow" icon={<IconAlertTriangle />} mt="xl" title="該当する政治団体がない場合">
        <Text size="sm">
          お探しの政治団体が見つからない場合は、証明書類を添付して登録をリクエストできます。
        </Text>
        <Button
          size="sm"
          color="yellow"
          variant="filled"
          mt="sm"
          onClick={() => setShowRequestForm(true)}
        >
          登録をリクエスト
        </Button>
      </Alert>

      <OrganizationRequestModal
        opened={showRequestForm}
        onClose={() => setShowRequestForm(false)}
      />
    </div>
  );
}

function OrganizationRequestModal({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'support_group',
    registration_authority: '',
    evidence_type: 'registration_form',
    evidence_file_url: '',
    evidence_file_name: '',
    notes: '',
    requested_by_email: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (file: File | null) => {
    if (!file) return;
    setIsUploading(true);
    setError(null);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      const response = await fetch('/api/upload', { method: 'POST', body: formDataUpload });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'ファイルのアップロードに失敗しました');
      }
      const data = await response.json();
      setFormData((prev) => ({
        ...prev,
        evidence_file_url: data.url,
        evidence_file_name: file.name,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'アップロードエラー');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.evidence_file_url) {
      setError('証明書類をアップロードしてください');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/organization-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'リクエストの送信に失敗しました');
      }
      alert('登録リクエストを送信しました。承認されるまでお待ちください。');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="政治団体の登録リクエスト" size="lg">
      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            label="団体名"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.currentTarget.value })}
            placeholder="例: 山田太郎後援会"
          />
          <NativeSelect
            label="団体種別"
            required
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.currentTarget.value })}
            data={Object.entries(ORGANIZATION_TYPES).map(([value, label]) => ({ value, label }))}
          />
          <TextInput
            label="届出先"
            value={formData.registration_authority}
            onChange={(e) =>
              setFormData({ ...formData, registration_authority: e.currentTarget.value })
            }
            placeholder="例: 東京都選挙管理委員会"
          />
          <NativeSelect
            label="証明書類の種類"
            required
            value={formData.evidence_type}
            onChange={(e) => setFormData({ ...formData, evidence_type: e.currentTarget.value })}
            data={Object.entries(EVIDENCE_TYPES).map(([value, label]) => ({ value, label }))}
          />
          <div>
            <FileInput
              label="証明書類のアップロード"
              required
              accept="image/*,.pdf"
              onChange={handleFileUpload}
              placeholder="ファイルを選択"
            />
            {isUploading && (
              <Group gap="xs" mt="xs">
                <Loader size="xs" />
                <Text size="sm">アップロード中...</Text>
              </Group>
            )}
            {formData.evidence_file_name && !isUploading && (
              <Text size="sm" c="green" mt="xs">
                ✅ {formData.evidence_file_name}
              </Text>
            )}
            <Text size="xs" c="dimmed" mt={4}>
              政治団体設立届出書の控え、名簿のスクリーンショット等をアップロードしてください
            </Text>
          </div>
          <TextInput
            label="連絡先メールアドレス"
            type="email"
            value={formData.requested_by_email}
            onChange={(e) =>
              setFormData({ ...formData, requested_by_email: e.currentTarget.value })
            }
            placeholder="example@email.com"
          />
          <Textarea
            label="備考"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.currentTarget.value })}
            rows={3}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={onClose}>
              キャンセル
            </Button>
            <Button
              type="submit"
              loading={isSubmitting}
              disabled={isSubmitting || !formData.evidence_file_url}
            >
              リクエストを送信
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
