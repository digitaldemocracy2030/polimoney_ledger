import { Container, Center, Stack, Title, Text, Button, Group, SimpleGrid, Anchor, Card } from '@mantine/core';
import { IconBuilding, IconClipboard } from '@tabler/icons-react';

export default function HomePage() {
  return (
    <Container size="sm">
      <Center h="70vh">
        <Stack align="center" ta="center">
          <Text size="3.5rem">📒</Text>
          <Title order={2}>Polimoney Ledger へようこそ</Title>
          <Text c="dimmed" maw={400}>
            政治資金収支報告書の作成・管理ツールです。左のメニューから台帳を選択してください。
          </Text>
          <Stack>
            <Button component="a" href="/organizations" size="lg" leftSection={<IconBuilding size={24} />}>
              政治団体から始める
            </Button>
            <Button component="a" href="/elections" size="lg" variant="outline" leftSection={<IconClipboard size={24} />}>
              選挙から始める
            </Button>
          </Stack>
        </Stack>
      </Center>
    </Container>
  );
}
