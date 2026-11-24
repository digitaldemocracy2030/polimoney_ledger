'use client';

import { apiFetch } from '@/lib/api-client';
import { useState } from 'react';
import { Card, TextInput, Button, Alert, Group, Stack, Title, Text, SimpleGrid, Badge, Anchor } from '@mantine/core';
import { ImageCropper } from '@/components/common/ImageCropper';

interface Politician {
  id: string;
  name: string;
  name_kana: string | null;
  official_url: string | null;
  party: string | null;
  photo_url: string | null;
  verified_at: string | null;
  verified_domain: string | null;
  sns_x: string | null;
  sns_instagram: string | null;
  sns_facebook: string | null;
  sns_tiktok: string | null;
}

interface Props {
  politician: Politician;
}

export function PoliticianProfileForm({ politician }: Props) {
  const [photoUrl, setPhotoUrl] = useState(politician.photo_url);
  const [name, setName] = useState(politician.name);
  const [nameKana, setNameKana] = useState(politician.name_kana || '');
  const [officialUrl, setOfficialUrl] = useState(politician.official_url || '');
  const [party, setParty] = useState(politician.party || '');
  const [snsX, setSnsX] = useState(politician.sns_x || '');
  const [snsInstagram, setSnsInstagram] = useState(politician.sns_instagram || '');
  const [snsFacebook, setSnsFacebook] = useState(politician.sns_facebook || '');
  const [snsTiktok, setSnsTiktok] = useState(politician.sns_tiktok || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    try {
      const response = await apiFetch('/v1/profile/politician', {
        method: 'PUT',
        body: JSON.stringify({
          name, name_kana: nameKana || null, official_url: officialUrl || null,
          party: party || null, photo_url: photoUrl || null,
          sns_x: snsX || null, sns_instagram: snsInstagram || null,
          sns_facebook: snsFacebook || null, sns_tiktok: snsTiktok || null,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '更新に失敗しました');
      }
      setMessage({ type: 'success', text: '政治家情報を更新しました' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : '更新に失敗しました' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Stack>
      {message && <Alert color={message.type === 'success' ? 'green' : 'red'}>{message.text}</Alert>}

      <form onSubmit={handleSubmit}>
        <Stack>
          <Card withBorder>
            <Title order={4}>プロフィール写真</Title>
            <ImageCropper currentImageUrl={photoUrl} shape="circle" uploadType="politician_photo" entityId={politician.id} onUploadComplete={(url: string) => setPhotoUrl(url)} />
          </Card>

          <Card withBorder>
            <Title order={4}>基本情報</Title>
            <SimpleGrid cols={{ base: 1, md: 2 }} mt="sm">
              <TextInput label="氏名 *" value={name} onChange={(e) => setName(e.currentTarget.value)} placeholder="山田 太郎" required />
              <TextInput label="ふりがな" value={nameKana} onChange={(e) => setNameKana(e.currentTarget.value)} placeholder="やまだ たろう" />
              <TextInput label="公式サイト URL" type="url" value={officialUrl} onChange={(e) => setOfficialUrl(e.currentTarget.value)} placeholder="https://" />
              <TextInput label="所属政党" value={party} onChange={(e) => setParty(e.currentTarget.value)} placeholder="無所属" />
            </SimpleGrid>
          </Card>

          <Card withBorder>
            <Title order={4}>SNSアカウント</Title>
            <SimpleGrid cols={{ base: 1, md: 2 }} mt="sm">
              <TextInput label="X (Twitter)" type="url" value={snsX} onChange={(e) => setSnsX(e.currentTarget.value)} placeholder="https://x.com/username" />
              <TextInput label="Instagram" type="url" value={snsInstagram} onChange={(e) => setSnsInstagram(e.currentTarget.value)} placeholder="https://instagram.com/username" />
              <TextInput label="Facebook" type="url" value={snsFacebook} onChange={(e) => setSnsFacebook(e.currentTarget.value)} placeholder="https://facebook.com/username" />
              <TextInput label="TikTok" type="url" value={snsTiktok} onChange={(e) => setSnsTiktok(e.currentTarget.value)} placeholder="https://tiktok.com/@username" />
            </SimpleGrid>
          </Card>

          {politician.verified_domain && (
            <Card withBorder>
              <Title order={4}>認証ドメイン</Title>
              <Text size="sm" c="dimmed" mb="sm">公式サイト URL は認証済みドメインである必要があります。</Text>
              <Group justify="space-between">
                <div>
                  <Text size="sm" c="dimmed">現在の認証ドメイン</Text>
                  <Text size="lg" ff="monospace">{politician.verified_domain}</Text>
                </div>
                <Anchor href="/verify/politician?change_domain=true"><Button variant="outline" size="sm">ドメインを変更</Button></Anchor>
              </Group>
            </Card>
          )}

          <Group justify="flex-end">
            <Button type="submit" loading={isSubmitting} disabled={!name.trim()}>変更を保存</Button>
          </Group>
        </Stack>
      </form>
    </Stack>
  );
}
