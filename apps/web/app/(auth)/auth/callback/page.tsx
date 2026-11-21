'use client';

/**
 * 認証メールのリンク（メールアドレス確認・パスワード再設定）の着地ページ
 *
 * @supabase/ssr のブラウザクライアントは初期化時に URL の ?code=（PKCE）や
 * #access_token=（implicit）を検出してセッションを Cookie に保存する。
 * ここでは getSession() で初期化の完了を待ち、セッションができたら遷移する。
 * - ?next=/reset-password ならパスワード再設定画面へ
 * - それ以外は利用規約への同意状況などを見て /onboarding / /dashboard へ
 */

import { useEffect, useState } from 'react';
import { Button, Card, Loader, Stack, Text, Title } from '@mantine/core';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { resolvePostLoginPath, safeRedirectPath } from '@/lib/supabase/auth';

function readUrlError(): string | null {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.substring(1));
  return (
    query.get('error_description') ??
    hash.get('error_description') ??
    query.get('error') ??
    hash.get('error')
  );
}

export default function AuthCallbackPage() {
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const run = async () => {
      try {
        const urlError = readUrlError();
        if (urlError) {
          throw new Error(urlError);
        }

        const supabase = getSupabaseBrowserClient();
        let {
          data: { session },
        } = await supabase.auth.getSession();

        // 自動検出で交換されなかった場合のみ、明示的に code を交換する
        const query = new URLSearchParams(window.location.search);
        const code = query.get('code');
        if (!session && code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          session = data.session;
        }

        if (!session) {
          throw new Error(
            '認証リンクが無効か、期限切れです。別のブラウザで開いた場合はメールアドレスの確認が完了している可能性があるため、ログインをお試しください。',
          );
        }

        const next = query.get('next');
        const target = next === '/reset-password'
          ? '/reset-password'
          : await resolvePostLoginPath(safeRedirectPath(next));
        window.location.replace(target);
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : '認証に失敗しました');
      }
    };

    run();
  }, []);

  return (
    <Card shadow="xl" padding="xl" radius="md" w="100%" maw={420}>
      {!errorMessage ? (
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Title order={3}>認証処理中...</Title>
          <Text c="dimmed">しばらくお待ちください。</Text>
        </Stack>
      ) : (
        <Stack align="center" gap="md">
          <Title order={3} c="red">認証に失敗しました</Title>
          <Text c="dimmed" ta="center">{errorMessage}</Text>
          <Stack gap="xs" w="100%" maw={300}>
            <Button component="a" href="/login" fullWidth>
              ログインページへ
            </Button>
            <Button component="a" href="/register" variant="outline" fullWidth>
              新規登録
            </Button>
          </Stack>
        </Stack>
      )}
    </Card>
  );
}
