'use client';

import { useState } from 'react';
import { Card, TextInput, Button, Alert, Group, Stack, Title, Text } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

interface Props {
  currentEmail: string;
}

export function EmailChangeForm({ currentEmail }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || newEmail === currentEmail) {
      setMessage({ type: 'error', text: '新しいメールアドレスを入力してください' });
      return;
    }
    setIsSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch('/api/account/email', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '変更に失敗しました');
      }
      setMessage({
        type: 'success',
        text: '確認メールを送信しました。メール内の「メールアドレスを確認する」ボタンをクリックして変更を完了してください。※メールは noreply@mail.app.supabase.io から届きます。',
      });
      setIsEditing(false);
      setNewEmail('');
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : '変更に失敗しました' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card withBorder>
      <Title order={3}>メールアドレス</Title>
      <Stack mt="sm">
        {message && <Alert color={message.type === 'error' ? 'red' : message.type === 'success' ? 'green' : 'blue'}>{message.text}</Alert>}

        {isEditing ? (
          <form onSubmit={handleSubmit}>
            <Stack>
              <TextInput label="現在のメールアドレス" value={currentEmail} disabled />
              <TextInput label="新しいメールアドレス" type="email" value={newEmail} onChange={(e) => setNewEmail(e.currentTarget.value)} placeholder="new@example.com" required />
              <Group>
                <Button type="submit" loading={isSubmitting} disabled={!newEmail || newEmail === currentEmail}>変更を申請</Button>
                <Button variant="default" onClick={() => { setIsEditing(false); setNewEmail(''); setMessage(null); }}>キャンセル</Button>
              </Group>
            </Stack>
          </form>
        ) : (<>
          <Text c="dimmed">{currentEmail}</Text>
          <Group><Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>メールアドレスを変更</Button></Group>
        </>)}

        <Alert icon={<IconInfoCircle />} color="blue">
          ログインに使用するメールアドレスです。政治家認証・政治団体管理者認証で使用する「公式メールアドレス」とは別です。
        </Alert>
      </Stack>
    </Card>
  );
}
