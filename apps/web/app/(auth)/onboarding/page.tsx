'use client';

/**
 * /onboarding - 利用規約・プライバシーポリシーへの同意
 *
 * メール確認が必要な設定では signUp 時点でセッションが無く Ledger API を呼べないため、
 * 確認後の初回ログイン時にここで同意を記録する（POST /v1/me/onboarding）。
 */

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Alert, Anchor, Button, Card, Checkbox, Stack, Text, Title } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { completeOnboarding, safeRedirectPath, signOutAndRedirect } from '@/lib/supabase/auth';

function OnboardingForm() {
  const searchParams = useSearchParams();
  const redirectTo = safeRedirectPath(searchParams.get('redirect'));
  const [tosAccepted, setTosAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!tosAccepted) {
      setError('利用規約への同意が必要です');
      return;
    }
    if (!privacyAccepted) {
      setError('プライバシーポリシーへの同意が必要です');
      return;
    }

    setLoading(true);
    try {
      await completeOnboarding();
      window.location.href = redirectTo;
    } catch (err) {
      setError(err instanceof Error ? err.message : '同意の記録に失敗しました');
      setLoading(false);
    }
  };

  return (
    <Card shadow="xl" padding="xl" radius="md" w="100%" maw={420}>
      <Stack align="center" mb="md">
        <Title order={2}>ご利用の前に</Title>
        <Text c="dimmed" ta="center" size="sm">
          Polimoney Ledger をご利用いただくには、利用規約とプライバシーポリシーへの同意が必要です。
        </Text>
      </Stack>

      {error && (
        <Alert color="red" icon={<IconAlertCircle />} mb="md">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <Checkbox
            label={
              <>
                <Anchor href="/terms" target="_blank">利用規約</Anchor>
                に同意する
              </>
            }
            checked={tosAccepted}
            onChange={(e) => setTosAccepted(e.currentTarget.checked)}
          />
          <Checkbox
            label={
              <>
                <Anchor href="/privacy" target="_blank">プライバシーポリシー</Anchor>
                に同意する
              </>
            }
            checked={privacyAccepted}
            onChange={(e) => setPrivacyAccepted(e.currentTarget.checked)}
          />
          <Button type="submit" fullWidth loading={loading}>
            同意して利用を開始する
          </Button>
          <Button variant="subtle" fullWidth onClick={() => signOutAndRedirect()}>
            ログアウト
          </Button>
        </Stack>
      </form>
    </Card>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<Text>読み込み中...</Text>}>
      <OnboardingForm />
    </Suspense>
  );
}
