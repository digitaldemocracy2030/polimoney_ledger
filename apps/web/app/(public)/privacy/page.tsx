import fs from 'fs/promises';
import path from 'path';
import { Container, Paper, Anchor, Group, Text, Image } from '@mantine/core';

export const metadata = {
  title: 'プライバシーポリシー - Polimoney Ledger',
};

export default async function PrivacyPage() {
  let htmlContent = '';
  try {
    const markdown = await fs.readFile(path.join(process.cwd(), 'docs/privacy-policy.md'), 'utf-8');
    htmlContent = markdown
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n- /g, '</p><ul><li>')
      .replace(/<\/li>\n/g, '</li>');
  } catch {
    htmlContent = '<p>プライバシーポリシーは準備中です。</p>';
  }

  return (
    <div>
      <Group component="header" h={60} px="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
        <Anchor href="/" underline="never">
          <Group gap="xs">
            <Image src="/logo-ledger.svg" alt="" h={32} w={32} />
            <Text fw={700} size="xl" c="teal.6">Polimoney Ledger</Text>
          </Group>
        </Anchor>
      </Group>

      <Container size="md" py="xl">
        <Paper p="xl" shadow="sm" radius="md">
          <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
        </Paper>

        <Group justify="center" mt="xl">
          <Anchor href="/" component="a">トップページに戻る</Anchor>
        </Group>
      </Container>

      <Group component="footer" justify="center" p="lg" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
        <Text size="sm" c="dimmed">© 2025 Digital Democracy 2030. オープンソースプロジェクト</Text>
      </Group>
    </div>
  );
}