'use client';

import { useState } from 'react';
import { Alert, Anchor, Button, Card, Group, List, Select, Stack, Text, TextInput, Textarea } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import Link from 'next/link';

const ELECTION_TYPES: Record<string, string> = {
  HR: '衆議院議員選挙',
  HC: '参議院議員選挙',
  PG: '都道府県知事選挙',
  PA: '都道府県議会選挙',
  GM: '市区町村長選挙',
  CM: '市区町村議会選挙',
};

interface ElectionRequestFormProps {
  userEmail?: string;
}

export function ElectionRequestForm({ userEmail }: ElectionRequestFormProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<string | null>(null);
  const [areaDescription, setAreaDescription] = useState('');
  const [electionDate, setElectionDate] = useState('');
  const [email, setEmail] = useState(userEmail || '');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    if (!name.trim()) {
      setMessage({ type: 'error', text: '選挙名を入力してください' });
      setIsSubmitting(false);
      return;
    }

    if (!type) {
      setMessage({ type: 'error', text: '選挙種別を選択してください' });
      setIsSubmitting(false);
      return;
    }

    if (!areaDescription.trim()) {
      setMessage({ type: 'error', text: '選挙区の説明を入力してください' });
      setIsSubmitting(false);
      return;
    }

    if (!electionDate) {
      setMessage({ type: 'error', text: '選挙日を入力してください' });
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/election-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          type,
          area_description: areaDescription.trim(),
          election_date: electionDate,
          requested_by_email: email.trim() || null,
          evidence_url: evidenceUrl.trim() || null,
          notes: notes.trim() || null,
        }),
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || 'リクエストの送信に失敗しました');
      }

      setMessage({
        type: 'success',
        text: '選挙登録リクエストを送信しました。運営が確認後、承認されると選挙が利用可能になります。',
      });

      setName('');
      setType(null);
      setAreaDescription('');
      setElectionDate('');
      setEvidenceUrl('');
      setNotes('');
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'リクエストの送信に失敗しました',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="lg">
        {message && (
          <Alert color={message.type === 'success' ? 'green' : 'red'}>
            {message.text}
          </Alert>
        )}

        <Card withBorder bg="gray.0">
          <Stack>
            <Text fw={500}>選挙情報</Text>

            <TextInput
              label="選挙名"
              required
              placeholder="例: 2025年 渋谷区議会議員選挙"
              description="正式な選挙名を入力してください"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
            />

            <Select
              label="選挙種別"
              required
              placeholder="選択してください"
              data={Object.entries(ELECTION_TYPES).map(([code, label]) => ({
                value: code,
                label,
              }))}
              value={type}
              onChange={setType}
            />

            <Textarea
              label="選挙区・地域の説明"
              required
              placeholder="例: 東京都渋谷区（定数34名）"
              description="選挙区の範囲や定数など、選挙を特定できる情報を入力してください"
              rows={2}
              value={areaDescription}
              onChange={(e) => setAreaDescription(e.currentTarget.value)}
            />

            <TextInput
              label="選挙日（投開票日）"
              required
              type="date"
              value={electionDate}
              onChange={(e) => setElectionDate(e.currentTarget.value)}
            />
          </Stack>
        </Card>

        <Card withBorder bg="gray.0">
          <Stack>
            <Text fw={500}>連絡先・補足情報</Text>

            <TextInput
              label="連絡先メールアドレス"
              type="email"
              placeholder="example@email.com"
              description="承認結果の連絡や確認が必要な場合に使用します"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
            />

            <TextInput
              label="参考URL"
              type="url"
              placeholder="https://..."
              description="選挙管理委員会のページや告示など、選挙情報を確認できるURLがあれば入力してください"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.currentTarget.value)}
            />

            <Textarea
              label="備考"
              placeholder="補足情報があれば入力してください"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
            />
          </Stack>
        </Card>

        <Group>
          <Button component={Link} href="/elections/new" variant="outline">
            戻る
          </Button>
          <Button
            type="submit"
            flex={1}
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            {isSubmitting ? '送信中...' : '登録をリクエスト'}
          </Button>
        </Group>

        <Alert color="blue" icon={<IconInfoCircle />}>
          <Text fw={700}>リクエスト後の流れ</Text>
          <List size="sm" mt="xs">
            <List.Item>運営が内容を確認し、承認・却下を判断します</List.Item>
            <List.Item>承認されると、選挙が一覧に追加されます</List.Item>
            <List.Item>通常1〜3営業日以内に処理されます</List.Item>
          </List>
        </Alert>
      </Stack>
    </form>
  );
}
