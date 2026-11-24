'use client';

import { apiFetch } from '@/lib/api-client';
import { useState } from 'react';
import {
  Button,
  Group,
  Stack,
  Text,
  Title,
  Card,
  Table,
  Badge,
  Modal,
  Alert,
  TextInput,
  Select,
  Textarea,
  Checkbox,
  SegmentedControl,
  Loader,
} from '@mantine/core';
import { IconPlus, IconUsers } from '@tabler/icons-react';

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

interface ContactManagerProps {
  initialContacts: Contact[];
}

type ModalMode = 'closed' | 'add' | 'edit';

const contactTypeLabels: Record<string, string> = {
  person: '個人',
  corporation: '法人',
  political_organization: '政治団体',
};

const contactTypeBadgeColor: Record<string, string> = {
  person: 'blue',
  corporation: 'yellow',
  political_organization: 'violet',
};

export function ContactManager({ initialContacts }: ContactManagerProps) {
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [modalMode, setModalMode] = useState<ModalMode>('closed');
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    contact_type: 'person' as 'person' | 'corporation' | 'political_organization',
    name: '',
    address: '',
    occupation: '',
    hub_organization_id: '',
    is_name_private: false,
    is_address_private: false,
    is_occupation_private: false,
    privacy_reason_type: '' as '' | 'personal_info' | 'other',
    privacy_reason_other: '',
  });

  const [isFetchingOrg, setIsFetchingOrg] = useState(false);
  const [orgFetchError, setOrgFetchError] = useState<string | null>(null);

  const resetForm = () => {
    setFormData({
      contact_type: 'person',
      name: '',
      address: '',
      occupation: '',
      hub_organization_id: '',
      is_name_private: false,
      is_address_private: false,
      is_occupation_private: false,
      privacy_reason_type: '',
      privacy_reason_other: '',
    });
    setOrgFetchError(null);
    setError(null);
  };

  const fetchOrganizationInfo = async () => {
    if (!formData.hub_organization_id.trim()) {
      setOrgFetchError('政治団体IDを入力してください');
      return;
    }

    setIsFetchingOrg(true);
    setOrgFetchError(null);

    try {
      const response = await apiFetch(
        `/v1/hub-organizations/${formData.hub_organization_id.trim()}`
      );

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || '政治団体情報の取得に失敗しました');
      }

      const result = await response.json();
      const org = result.data;

      setFormData((prev) => ({
        ...prev,
        name: org.name,
        address: org.office_address || prev.address,
      }));
    } catch (err) {
      setOrgFetchError(
        err instanceof Error ? err.message : '取得に失敗しました'
      );
    } finally {
      setIsFetchingOrg(false);
    }
  };

  const openAddModal = () => {
    resetForm();
    setEditingContact(null);
    setModalMode('add');
  };

  const openEditModal = (contact: Contact) => {
    setFormData({
      contact_type: contact.contact_type,
      name: contact.name,
      address: contact.address || '',
      occupation: contact.occupation || '',
      hub_organization_id: contact.hub_organization_id || '',
      is_name_private: contact.is_name_private,
      is_address_private: contact.is_address_private,
      is_occupation_private: contact.is_occupation_private,
      privacy_reason_type:
        (contact.privacy_reason_type as '' | 'personal_info' | 'other') || '',
      privacy_reason_other: contact.privacy_reason_other || '',
    });
    setEditingContact(contact);
    setModalMode('edit');
  };

  const closeModal = () => {
    setModalMode('closed');
    setEditingContact(null);
    resetForm();
  };

  const hasPrivacySetting =
    formData.is_name_private ||
    formData.is_address_private ||
    formData.is_occupation_private;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!formData.name.trim()) {
      setError('氏名/団体名は必須です');
      setIsLoading(false);
      return;
    }

    if (hasPrivacySetting && !formData.privacy_reason_type) {
      setError('非公開設定がある場合は理由を選択してください');
      setIsLoading(false);
      return;
    }

    if (
      formData.privacy_reason_type === 'other' &&
      !formData.privacy_reason_other.trim()
    ) {
      setError('その他の理由を入力してください');
      setIsLoading(false);
      return;
    }

    if (
      formData.contact_type === 'political_organization' &&
      !formData.hub_organization_id.trim()
    ) {
      setError('政治団体IDを入力してください');
      setIsLoading(false);
      return;
    }

    const requestData = {
      contact_type: formData.contact_type,
      name: formData.name.trim(),
      hub_organization_id:
        formData.contact_type === 'political_organization'
          ? formData.hub_organization_id.trim()
          : null,
      address: formData.address.trim() || null,
      occupation:
        formData.contact_type === 'person'
          ? formData.occupation.trim() || null
          : null,
      is_name_private: formData.is_name_private,
      is_address_private: formData.is_address_private,
      is_occupation_private:
        formData.contact_type === 'person'
          ? formData.is_occupation_private
          : false,
      privacy_reason_type: hasPrivacySetting
        ? formData.privacy_reason_type
        : null,
      privacy_reason_other:
        hasPrivacySetting && formData.privacy_reason_type === 'other'
          ? formData.privacy_reason_other.trim()
          : null,
    };

    try {
      if (modalMode === 'add') {
        const res = await apiFetch('/v1/contacts', {
          method: 'POST',
          body: JSON.stringify(requestData),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || '登録に失敗しました');
        }

        const { data } = await res.json();
        setContacts(
          [...contacts, data].sort((a, b) => a.name.localeCompare(b.name))
        );
      } else if (modalMode === 'edit' && editingContact) {
        const res = await apiFetch(`/v1/contacts/${editingContact.id}`, {
          method: 'PUT',
          body: JSON.stringify(requestData),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || '更新に失敗しました');
        }

        const { data } = await res.json();
        setContacts(
          contacts
            .map((c) => (c.id === editingContact.id ? data : c))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      }

      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (contact: Contact) => {
    if (!confirm(`「${contact.name}」を削除しますか？`)) return;

    setIsLoading(true);
    try {
      const res = await apiFetch(`/v1/contacts/${contact.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '削除に失敗しました');
      }

      setContacts(contacts.filter((c) => c.id !== contact.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : '削除に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Text c="dimmed">
          仕訳で使用する関係者（寄附者、支払先、銀行など）を管理します。
        </Text>
        <Button leftSection={<IconPlus size={16} />} onClick={openAddModal}>
          新規登録
        </Button>
      </Group>

      {contacts.length === 0 ? (
        <Card withBorder p="xl">
          <Stack align="center" py="xl">
            <IconUsers size={64} stroke={1} color="var(--mantine-color-dimmed)" />
            <Title order={4}>関係者がまだ登録されていません</Title>
            <Text c="dimmed">
              「新規登録」ボタンから関係者を追加してください。
            </Text>
          </Stack>
        </Card>
      ) : (
        <Card withBorder>
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>種別</Table.Th>
                <Table.Th>氏名/団体名</Table.Th>
                <Table.Th>住所</Table.Th>
                <Table.Th>職業</Table.Th>
                <Table.Th>非公開</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {contacts.map((contact) => (
                <Table.Tr key={contact.id}>
                  <Table.Td>
                    <Badge
                      color={contactTypeBadgeColor[contact.contact_type]}
                      size="sm"
                    >
                      {contactTypeLabels[contact.contact_type]}
                    </Badge>
                  </Table.Td>
                  <Table.Td fw={500}>{contact.name}</Table.Td>
                  <Table.Td
                    c="dimmed"
                    fz="sm"
                    style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {contact.address || '-'}
                  </Table.Td>
                  <Table.Td c="dimmed" fz="sm">
                    {contact.contact_type === 'person'
                      ? contact.occupation || '-'
                      : '-'}
                  </Table.Td>
                  <Table.Td>
                    {(contact.is_name_private ||
                      contact.is_address_private ||
                      contact.is_occupation_private) && (
                      <Badge variant="light" size="sm">
                        あり
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Button
                        variant="subtle"
                        size="compact-sm"
                        onClick={() => openEditModal(contact)}
                      >
                        編集
                      </Button>
                      <Button
                        variant="subtle"
                        color="red"
                        size="compact-sm"
                        onClick={() => handleDelete(contact)}
                        disabled={isLoading}
                      >
                        削除
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}

      <Modal
        opened={modalMode !== 'closed'}
        onClose={closeModal}
        title={modalMode === 'add' ? '関係者の新規登録' : '関係者の編集'}
        size="lg"
      >
        {error && (
          <Alert color="red" mb="md">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Stack>
            <SegmentedControl
              value={formData.contact_type}
              onChange={(value) =>
                setFormData({
                  ...formData,
                  contact_type: value as 'person' | 'corporation' | 'political_organization',
                })
              }
              data={[
                { label: '個人', value: 'person' },
                { label: '法人/団体', value: 'corporation' },
                { label: '政治団体', value: 'political_organization' },
              ]}
            />

            {formData.contact_type === 'political_organization' && (
              <Stack gap="xs">
                <Group align="flex-end">
                  <TextInput
                    label="政治団体ID"
                    required
                    placeholder="例: 12345678-1234-1234-1234-123456789012"
                    value={formData.hub_organization_id}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        hub_organization_id: e.currentTarget.value,
                      })
                    }
                    style={{ flex: 1 }}
                  />
                  <Button
                    variant="light"
                    onClick={fetchOrganizationInfo}
                    disabled={isFetchingOrg || !formData.hub_organization_id.trim()}
                    loading={isFetchingOrg}
                  >
                    取得
                  </Button>
                </Group>
                {orgFetchError && (
                  <Text c="red" fz="sm">
                    {orgFetchError}
                  </Text>
                )}
                <Text c="dimmed" fz="xs">
                  Hub DBに登録されている政治団体のIDを入力してください
                </Text>
              </Stack>
            )}

            <TextInput
              label={formData.contact_type === 'person' ? '氏名' : '団体名/法人名'}
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.currentTarget.value })
              }
              placeholder={
                formData.contact_type === 'person' ? '山田 太郎' : '株式会社〇〇'
              }
              description={
                <Checkbox
                  label="非公開にする"
                  size="xs"
                  checked={formData.is_name_private}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      is_name_private: e.currentTarget.checked,
                    })
                  }
                />
              }
            />

            <TextInput
              label="住所"
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.currentTarget.value })
              }
              placeholder="東京都千代田区..."
              description={
                <Group justify="space-between">
                  <Checkbox
                    label="非公開にする"
                    size="xs"
                    checked={formData.is_address_private}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        is_address_private: e.currentTarget.checked,
                      })
                    }
                  />
                  <Text fz="xs" c="yellow.6">
                    5万円超の支出/寄附には住所が必要です
                  </Text>
                </Group>
              }
            />

            {formData.contact_type === 'person' && (
              <TextInput
                label="職業"
                value={formData.occupation}
                onChange={(e) =>
                  setFormData({ ...formData, occupation: e.currentTarget.value })
                }
                placeholder="会社員"
                description={
                  <Group justify="space-between">
                    <Checkbox
                      label="非公開にする"
                      size="xs"
                      checked={formData.is_occupation_private}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          is_occupation_private: e.currentTarget.checked,
                        })
                      }
                    />
                    <Text fz="xs" c="yellow.6">
                      5万円超の個人寄附には職業が必要です
                    </Text>
                  </Group>
                }
              />
            )}

            {hasPrivacySetting && (
              <Stack gap="xs">
                <Select
                  label="非公開理由"
                  required
                  value={formData.privacy_reason_type || null}
                  onChange={(value) =>
                    setFormData({
                      ...formData,
                      privacy_reason_type: (value || '') as '' | 'personal_info' | 'other',
                    })
                  }
                  data={[
                    { label: '選択してください', value: '' },
                    { label: '個人情報保護のため', value: 'personal_info' },
                    { label: 'その他', value: 'other' },
                  ]}
                />
                {formData.privacy_reason_type === 'other' && (
                  <Textarea
                    placeholder="具体的な理由を入力"
                    value={formData.privacy_reason_other}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        privacy_reason_other: e.currentTarget.value,
                      })
                    }
                  />
                )}
              </Stack>
            )}

            <Group justify="flex-end">
              <Button
                variant="subtle"
                onClick={closeModal}
                disabled={isLoading}
              >
                キャンセル
              </Button>
              <Button type="submit" loading={isLoading}>
                {modalMode === 'add' ? '登録' : '更新'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
