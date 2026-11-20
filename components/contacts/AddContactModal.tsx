'use client';

import { useState } from 'react';
import {
  Button,
  Group,
  Stack,
  Text,
  Modal,
  Alert,
  TextInput,
  Select,
  Radio,
  Checkbox,
  Divider,
} from '@mantine/core';

interface AddContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (contact: {
    id: string;
    name: string;
    contact_type: string;
    hub_organization_id?: string;
  }) => void;
}

type ContactType = 'person' | 'corporation' | 'political_organization';

export function AddContactModal({
  isOpen,
  onClose,
  onSuccess,
}: AddContactModalProps) {
  const [contactType, setContactType] = useState<ContactType>('person');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [occupation, setOccupation] = useState('');

  const [hubOrganizationId, setHubOrganizationId] = useState('');
  const [isFetchingOrg, setIsFetchingOrg] = useState(false);
  const [orgFetchError, setOrgFetchError] = useState<string | null>(null);

  const [isNamePrivate, setIsNamePrivate] = useState(false);
  const [isAddressPrivate, setIsAddressPrivate] = useState(false);
  const [isOccupationPrivate, setIsOccupationPrivate] = useState(false);
  const [privacyReasonType, setPrivacyReasonType] = useState<
    'personal_info' | 'other'
  >('personal_info');
  const [privacyReasonOther, setPrivacyReasonOther] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasPrivacySetting =
    isNamePrivate || isAddressPrivate || isOccupationPrivate;

  const fetchOrganizationInfo = async () => {
    if (!hubOrganizationId.trim()) {
      setOrgFetchError('政治団体IDを入力してください');
      return;
    }

    setIsFetchingOrg(true);
    setOrgFetchError(null);

    try {
      const response = await fetch(
        `/api/hub-organizations/${hubOrganizationId.trim()}`
      );

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || '政治団体情報の取得に失敗しました');
      }

      const result = await response.json();
      const org = result.data;

      setName(org.name);
      if (org.office_address) {
        setAddress(org.office_address);
      }
    } catch (err) {
      setOrgFetchError(
        err instanceof Error ? err.message : '取得に失敗しました'
      );
    } finally {
      setIsFetchingOrg(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_type: contactType,
          name,
          address: address || null,
          occupation: occupation || null,
          hub_organization_id:
            contactType === 'political_organization'
              ? hubOrganizationId.trim()
              : null,
          is_name_private: isNamePrivate,
          is_address_private: isAddressPrivate,
          is_occupation_private: isOccupationPrivate,
          privacy_reason_type: hasPrivacySetting ? privacyReasonType : null,
          privacy_reason_other:
            hasPrivacySetting && privacyReasonType === 'other'
              ? privacyReasonOther
              : null,
        }),
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || '登録に失敗しました');
      }

      const result = await response.json();
      onSuccess({
        id: result.data.id,
        name: result.data.name,
        contact_type: result.data.contact_type,
        hub_organization_id: result.data.hub_organization_id,
      });

      resetForm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '登録に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setContactType('person');
    setName('');
    setAddress('');
    setOccupation('');
    setHubOrganizationId('');
    setOrgFetchError(null);
    setIsNamePrivate(false);
    setIsAddressPrivate(false);
    setIsOccupationPrivate(false);
    setPrivacyReasonType('personal_info');
    setPrivacyReasonOther('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleContactTypeChange = (newType: string) => {
    setContactType(newType as ContactType);
    setName('');
    setAddress('');
    setOccupation('');
    setHubOrganizationId('');
    setOrgFetchError(null);
  };

  return (
    <Modal opened={isOpen} onClose={handleClose} title="関係者を追加" size="md">
      <form onSubmit={handleSubmit}>
        <Stack>
          <Radio.Group
            label="種別"
            required
            value={contactType}
            onChange={handleContactTypeChange}
          >
            <Group mt="xs">
              <Radio value="person" label="個人" />
              <Radio value="corporation" label="法人" />
              <Radio value="political_organization" label="政治団体" />
            </Group>
          </Radio.Group>

          {contactType === 'political_organization' && (
            <Stack gap="xs">
              <Group align="flex-end">
                <TextInput
                  label="政治団体ID"
                  required
                  placeholder="例: 12345678-1234-1234-1234-123456789012"
                  value={hubOrganizationId}
                  onChange={(e) => setHubOrganizationId(e.currentTarget.value)}
                  style={{ flex: 1 }}
                />
                <Button
                  variant="light"
                  onClick={fetchOrganizationInfo}
                  disabled={isFetchingOrg || !hubOrganizationId.trim()}
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
            label={
              contactType === 'person'
                ? '氏名'
                : contactType === 'corporation'
                ? '法人名'
                : '団体名'
            }
            required
            placeholder={
              contactType === 'person'
                ? '例: 山田 太郎'
                : contactType === 'corporation'
                ? '例: 株式会社○○'
                : '例: ○○後援会'
            }
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            disabled={
              contactType === 'political_organization' && isFetchingOrg
            }
          />

          <TextInput
            label="住所"
            placeholder="例: 東京都千代田区..."
            value={address}
            onChange={(e) => setAddress(e.currentTarget.value)}
            disabled={
              contactType === 'political_organization' && isFetchingOrg
            }
          />

          {contactType === 'person' && (
            <TextInput
              label="職業"
              placeholder="例: 会社員"
              value={occupation}
              onChange={(e) => setOccupation(e.currentTarget.value)}
            />
          )}

          {contactType !== 'political_organization' && (
            <>
              <Divider label="プライバシー設定" labelPosition="center" />

              <Stack gap="xs">
                <Checkbox
                  label="氏名を非公開にする"
                  checked={isNamePrivate}
                  onChange={(e) => setIsNamePrivate(e.currentTarget.checked)}
                />
                <Checkbox
                  label="住所を非公開にする"
                  checked={isAddressPrivate}
                  onChange={(e) => setIsAddressPrivate(e.currentTarget.checked)}
                />
                {contactType === 'person' && (
                  <Checkbox
                    label="職業を非公開にする"
                    checked={isOccupationPrivate}
                    onChange={(e) =>
                      setIsOccupationPrivate(e.currentTarget.checked)
                    }
                  />
                )}
              </Stack>

              {hasPrivacySetting && (
                <Stack gap="xs">
                  <Select
                    label="非公開の理由"
                    value={privacyReasonType}
                    onChange={(value) =>
                      setPrivacyReasonType(
                        (value as 'personal_info' | 'other') || 'personal_info'
                      )
                    }
                    data={[
                      { label: '個人情報保護のため', value: 'personal_info' },
                      { label: 'その他', value: 'other' },
                    ]}
                  />
                  {privacyReasonType === 'other' && (
                    <TextInput
                      placeholder="理由を入力"
                      value={privacyReasonOther}
                      onChange={(e) =>
                        setPrivacyReasonOther(e.currentTarget.value)
                      }
                    />
                  )}
                </Stack>
              )}
            </>
          )}

          {error && (
            <Alert color="red">
              {error}
            </Alert>
          )}

          <Group justify="flex-end">
            <Button variant="subtle" onClick={handleClose}>
              キャンセル
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {isSubmitting ? '登録中...' : '登録'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
