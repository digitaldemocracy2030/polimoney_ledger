import {
  Container, Title, Text, Button, Group, Card, SimpleGrid, Badge,
  Anchor, Image, Stack, Alert,
} from '@mantine/core';
import { IconAlertTriangle, IconBrandGithub } from '@tabler/icons-react';

export const metadata = {
  title: 'Polimoney Ledger - 政治資金収支管理ツール',
};

export default function WelcomePage() {
  return (
    <div>
      {/* ヘッダー */}
      <Group component="header" h={60} px="md" justify="space-between" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
        <Anchor href="/welcome" underline="never">
          <Group gap="xs">
            <Image src="/logo-ledger.svg" alt="" h={32} w={32} />
            <Text fw={700} size="xl" c="teal.6">Polimoney Ledger</Text>
            <Badge color="yellow" size="sm">β</Badge>
          </Group>
        </Anchor>
        <Group gap="xs">
          <Button component="a" href="/login" variant="subtle">ログイン</Button>
          <Button component="a" href="/register">新規登録</Button>
        </Group>
      </Group>

      {/* ヒーローセクション */}
      <Container size="md" py={80}>
        <Stack align="center" ta="center" gap="lg">
          <Image src="/logo-ledger.svg" alt="Polimoney Ledger" h={96} w={96} />
          <Badge color="yellow" size="lg">🚧 ベータ版</Badge>
          <Title order={1} size={42}>
            政治資金収支の管理を<br />
            <Text span c="blue" inherit>シンプルに</Text>
          </Title>
          <Text size="lg" c="dimmed" maw={500}>
            Polimoney Ledger は、政治資金収支報告書の作成・管理を簡単にするオープンソースのツールです。
          </Text>
          <Alert color="yellow" icon={<IconAlertTriangle />} maw={500}>
            本サービスはベータ版です。予期せぬ動作やデータ損失の可能性があります。重要なデータは別途バックアップをお取りください。
          </Alert>
          <Group gap="md">
            <Button component="a" href="/register" size="lg">無料で始める</Button>
            <Button
              component="a"
              href="https://github.com/digitaldemocracy2030/polimoney_ledger"
              target="_blank"
              rel="noopener noreferrer"
              variant="outline"
              size="lg"
              leftSection={<IconBrandGithub size={20} />}
            >
              GitHub
            </Button>
          </Group>
        </Stack>
      </Container>

      {/* 特徴セクション */}
      <div style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
        <Container size="lg" py={80}>
          <Title order={2} ta="center" mb="xl">特徴</Title>
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
            <Card padding="lg" ta="center">
              <Text size={40} mb="md">📊</Text>
              <Title order={3} size="h4" mb="xs">簡単な収支管理</Title>
              <Text c="dimmed">
                直感的な UI で収入・支出を記録。手軽に記録を始められます。
              </Text>
            </Card>
            <Card padding="lg" ta="center">
              <Text size={40} mb="md">📄</Text>
              <Group justify="center" mb="xs">
                <Title order={3} size="h4">報告書出力</Title>
                <Badge variant="outline" size="sm">予定</Badge>
              </Group>
              <Text c="dimmed">
                政治資金収支報告書のフォーマットに対応した帳票出力を目指しています。（選挙種別・届出先により様式が異なるため開発中）
              </Text>
            </Card>
            <Card padding="lg" ta="center">
              <Text size={40} mb="md">🔒</Text>
              <Title order={3} size="h4" mb="xs">セキュアなデータ管理</Title>
              <Text c="dimmed">
                データは暗号化して保存。あなたのデータはあなただけのものです。
              </Text>
            </Card>
          </SimpleGrid>
        </Container>
      </div>

      {/* CTA セクション */}
      <Container size="sm" py={80} ta="center">
        <Title order={2} mb="md">今すぐ始めましょう</Title>
        <Text c="dimmed" mb="lg">
          Polimoney Ledger は無料でご利用いただけます。アカウントを作成して、政治資金の管理を始めましょう。
        </Text>
        <Button component="a" href="/register" size="lg">無料で登録する</Button>
      </Container>

      {/* フッター */}
      <Stack component="footer" align="center" gap="xs" p="xl" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
        <Group gap="xs">
          <Text size="lg">📒</Text>
          <Text fw={700}>Polimoney Ledger</Text>
        </Group>
        <Text size="sm" c="dimmed">
          © 2025 Digital Democracy 2030. オープンソースプロジェクト
        </Text>
        <Group gap="md">
          <Anchor href="/privacy" size="sm">プライバシーポリシー</Anchor>
          <Anchor href="https://github.com/digitaldemocracy2030/polimoney_ledger" target="_blank" rel="noopener noreferrer" size="sm">GitHub</Anchor>
          <Anchor href="https://dd2030.org" target="_blank" rel="noopener noreferrer" size="sm">DD2030</Anchor>
        </Group>
      </Stack>
    </div>
  );
}
