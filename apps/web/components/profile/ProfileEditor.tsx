'use client';

import { apiFetch } from '@/lib/api-client';
import { useState } from 'react';
import { Card, TextInput, Button, Alert, Group, Stack, Title, Text } from '@mantine/core';

interface Props {
  initialDisplayName: string;
}

export function ProfileEditor({ initialDisplayName }: Props) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSave = async () => {
    if (!displayName.trim()) {
      setError('姓名を入力してください');
      return;
    }
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiFetch('/v1/profile', {
        method: 'PUT',
        body: JSON.stringify({ display_name: displayName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '更新に失敗しました');
      }
      setSuccess('プロフィールを更新しました');
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setDisplayName(initialDisplayName);
    setIsEditing(false);
    setError(null);
  };

  return (
    <Card withBorder>
      <Title order={3}>プロフィール</Title>
      <Stack mt="sm">
        {error && <Alert color="red">{error}</Alert>}
        {success && <Alert color="green">{success}</Alert>}
        <div>
          <Text size="sm" fw={500} mb={4}>姓名</Text>
          {isEditing ? (
            <Group>
              <TextInput flex={1} value={displayName} onChange={(e) => setDisplayName(e.currentTarget.value)} placeholder="山田 太郎" />
              <Button variant="default" onClick={handleCancel} disabled={isLoading}>キャンセル</Button>
              <Button onClick={handleSave} loading={isLoading}>保存</Button>
            </Group>
          ) : (
            <Group>
              <TextInput flex={1} value={displayName || '（未設定）'} disabled />
              <Button variant="default" onClick={() => setIsEditing(true)}>編集</Button>
            </Group>
          )}
          <Text size="xs" c="dimmed" mt={4}>政治家認証やメンバー一覧に表示されます。本名を入力してください。</Text>
        </div>
      </Stack>
    </Card>
  );
}
