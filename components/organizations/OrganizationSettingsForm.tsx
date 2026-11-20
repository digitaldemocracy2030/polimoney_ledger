'use client';

import { useState } from 'react';
import {
  Alert,
  Anchor,
  Button,
  Card,
  Group,
  NativeSelect,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';

interface OrganizationFormData {
  name: string;
  type: string;
  official_url: string;
  registration_authority: string;
  established_date: string;
  office_address: string;
  representative_name: string;
  accountant_name: string;
  sns_x: string;
  sns_instagram: string;
  sns_facebook: string;
  sns_tiktok: string;
}

interface Props {
  organizationId: string;
  initialData: OrganizationFormData;
  currentLogoUrl?: string | null;
  verifiedDomain?: string | null;
}

const organizationTypes = [
  { value: 'political_party', label: '政党' },
  { value: 'support_group', label: '後援会' },
  { value: 'fund_management', label: '資金管理団体' },
  { value: 'other', label: 'その他の政治団体' },
];

export function OrganizationSettingsForm({
  organizationId,
  initialData,
  currentLogoUrl,
  verifiedDomain,
}: Props) {
  const [formData, setFormData] = useState<OrganizationFormData>(initialData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.currentTarget;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/organizations/${organizationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          official_url: formData.official_url || null,
          registration_authority: formData.registration_authority || null,
          established_date: formData.established_date || null,
          office_address: formData.office_address || null,
          representative_name: formData.representative_name || null,
          accountant_name: formData.accountant_name || null,
          sns_x: formData.sns_x || null,
          sns_instagram: formData.sns_instagram || null,
          sns_facebook: formData.sns_facebook || null,
          sns_tiktok: formData.sns_tiktok || null,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || '更新に失敗しました');
      }

      setMessage({ type: 'success', text: '政治団体情報を更新しました' });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : '更新に失敗しました',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack>
        {message && (
          <Alert color={message.type === 'success' ? 'green' : 'red'}>{message.text}</Alert>
        )}

        <Card withBorder>
          <Stack>
            <Title order={4}>基本情報</Title>
            <Text size="sm" c="dimmed">
              <Text span c="red">*</Text> は必須項目です。
            </Text>
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <TextInput
                label="団体名"
                required
                name="name"
                value={formData.name}
                onChange={handleChange}
              />
              <NativeSelect
                label="団体種別"
                required
                name="type"
                value={formData.type}
                onChange={handleChange}
                data={organizationTypes}
              />
              <TextInput
                label="届出先選挙管理委員会"
                name="registration_authority"
                value={formData.registration_authority}
                onChange={handleChange}
                placeholder="例: 東京都選挙管理委員会"
              />
              <TextInput
                label="届出年月日"
                type="date"
                name="established_date"
                value={formData.established_date}
                onChange={handleChange}
              />
            </SimpleGrid>
            <TextInput
              label="主たる事務所の所在地"
              name="office_address"
              value={formData.office_address}
              onChange={handleChange}
              placeholder="例: 東京都千代田区"
              description="公開時は都道府県レベルまでの表示となります"
            />
            <TextInput
              label="公式サイト URL"
              type="url"
              name="official_url"
              value={formData.official_url}
              onChange={handleChange}
              placeholder="https://example.com"
              description="認証済みドメインのURLを入力してください"
            />
          </Stack>
        </Card>

        <Card withBorder>
          <Stack>
            <Title order={4}>役職者情報</Title>
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <TextInput
                label="代表者名"
                name="representative_name"
                value={formData.representative_name}
                onChange={handleChange}
              />
              <TextInput
                label="会計責任者名"
                name="accountant_name"
                value={formData.accountant_name}
                onChange={handleChange}
              />
            </SimpleGrid>
          </Stack>
        </Card>

        <Card withBorder>
          <Stack>
            <Title order={4}>SNS リンク</Title>
            <Text size="sm" c="dimmed">
              公式アカウントのURLを入力してください。すべて任意項目です。
            </Text>
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <TextInput
                label="X (Twitter)"
                type="url"
                name="sns_x"
                value={formData.sns_x}
                onChange={handleChange}
                placeholder="https://x.com/username"
              />
              <TextInput
                label="Instagram"
                type="url"
                name="sns_instagram"
                value={formData.sns_instagram}
                onChange={handleChange}
                placeholder="https://instagram.com/username"
              />
              <TextInput
                label="Facebook"
                type="url"
                name="sns_facebook"
                value={formData.sns_facebook}
                onChange={handleChange}
                placeholder="https://facebook.com/pagename"
              />
              <TextInput
                label="TikTok"
                type="url"
                name="sns_tiktok"
                value={formData.sns_tiktok}
                onChange={handleChange}
                placeholder="https://tiktok.com/@username"
              />
            </SimpleGrid>
          </Stack>
        </Card>

        {verifiedDomain && (
          <Card withBorder>
            <Stack>
              <Title order={4}>認証ドメイン</Title>
              <Text size="sm" c="dimmed">
                公式サイト URL は認証済みドメインである必要があります。
              </Text>
              <Group justify="space-between">
                <div>
                  <Text size="sm" c="dimmed">
                    現在の認証ドメイン
                  </Text>
                  <Text size="lg" ff="monospace">
                    {verifiedDomain}
                  </Text>
                </div>
                <Button
                  component="a"
                  href={`/verify/organization?change_domain=true&organization_id=${organizationId}`}
                  variant="outline"
                  size="sm"
                >
                  ドメインを変更
                </Button>
              </Group>
            </Stack>
          </Card>
        )}

        <Group justify="flex-end">
          <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
            変更を保存
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
