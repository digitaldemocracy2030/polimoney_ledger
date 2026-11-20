import { Container, Paper, Title, Text, List, ListItem, Alert, Anchor } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

export const metadata = {
  title: '利用規約 - Polimoney Ledger',
};

export default function TermsPage() {
  return (
    <Container size="sm" py="xl">
      <Paper p="xl" shadow="sm" radius="md">
        <Title order={1} mb="md">利用規約</Title>

        <Text size="sm" c="dimmed" mb="lg">最終更新日: 2024年12月20日</Text>

        <Title order={2} size="h3" mt="lg" mb="xs">第1条（本規約の適用）</Title>
        <Text mb="md">
          この利用規約（以下「本規約」といいます）は、Polimoney Ledger（以下「本サービス」といいます）の利用条件を定めるものです。
          本サービスをご利用いただく方（以下「ユーザー」といいます）は、本規約に同意したものとみなします。
        </Text>

        <Title order={2} size="h3" mt="lg" mb="xs">第2条（本サービスの目的）</Title>
        <Text mb="md">
          本サービスは、政治家及び会計責任者が政治資金の収支を記録・管理するためのツールです。
          政治資金の透明化と適正な管理を支援することを目的としています。
        </Text>

        <Title order={2} size="h3" mt="lg" mb="xs">第3条（利用資格）</Title>
        <Text mb="xs">本サービスは、以下のいずれかに該当する方が利用できます。</Text>
        <List mb="md">
          <ListItem>政治家本人</ListItem>
          <ListItem>政治団体の会計責任者</ListItem>
          <ListItem>上記の者から招待を受けた方</ListItem>
        </List>

        <Title order={2} size="h3" mt="lg" mb="xs">第3条の2（認証に関する注意事項）</Title>
        <Text mb="xs">本サービスにおける政治家認証および政治団体管理者認証について、以下の事項をご了承ください。</Text>
        <List type="ordered" mb="md">
          <ListItem>
            <Text fw={700}>承認の順序について</Text>
            <Text>承認フローの関係上、申請順に承認を出せないことがあります。</Text>
          </ListItem>
          <ListItem>
            <Text fw={700}>却下理由の非開示について</Text>
            <Text>承認が却下された場合、セキュリティの都合上、基本的にその理由をお伝えできません。</Text>
          </ListItem>
          <ListItem>
            <Text fw={700}>虚偽申請への対応について</Text>
            <Text>虚偽の情報による申請が発覚した場合、アカウントを停止する場合があります。</Text>
          </ListItem>
        </List>

        <Title order={2} size="h3" mt="lg" mb="xs">第4条（禁止事項）</Title>
        <Text mb="xs">ユーザーは、以下の行為を行ってはなりません。</Text>
        <List mb="md">
          <ListItem>虚偽の情報を登録する行為</ListItem>
          <ListItem>他人になりすます行為</ListItem>
          <ListItem>本サービスの運営を妨害する行為</ListItem>
          <ListItem>法令または公序良俗に違反する行為</ListItem>
          <ListItem>本サービスを政治資金管理以外の目的で利用する行為</ListItem>
        </List>

        <Title order={2} size="h3" mt="lg" mb="xs">第5条（免責事項）</Title>
        <Text mb="md">
          本サービスは現状有姿で提供されます。
          本サービスの利用により生じた損害について、運営者は一切の責任を負いません。
        </Text>

        <Alert color="yellow" icon={<IconAlertTriangle />} title="フィッシングサイトに関する注意事項" my="lg">
          <Text size="sm">
            Polimoney Ledger はオープンソースソフトウェアとして開発されています。
            Webサイトは公に公開するという性質上、コピーされやすく、なりすましサイトの構築をされやすいものです。
            また、それはAI（LLM）の普及により、より容易くなっています。
          </Text>
          <Text size="sm" mt="xs">
            Polimoney Ledger は現状ベータ版での公開で無料のサービスです。
            ボランティアによる運営のため、サポートが行き届かない可能性があります。
          </Text>
          <Text size="sm" mt="xs" fw={600}>
            フィッシングサイトには十分にご注意頂き、ご利用ください。
          </Text>
        </Alert>

        <Title order={2} size="h3" mt="lg" mb="xs">第6条（サービスの変更・終了）</Title>
        <Text mb="md">
          運営者は、事前の通知なく本サービスの内容を変更、または提供を終了することができます。
        </Text>

        <Title order={2} size="h3" mt="lg" mb="xs">第7条（本規約の変更）</Title>
        <Text mb="md">
          運営者は、必要に応じて本規約を変更することができます。
          変更後の規約は、本サービス上に掲載した時点で効力を生じるものとします。
        </Text>

        <Title order={2} size="h3" mt="lg" mb="xs">第8条（準拠法・管轄裁判所）</Title>
        <Text mb="md">
          本規約の解釈にあたっては、日本法を準拠法とします。
          本サービスに関して紛争が生じた場合には、東京地方裁判所を第一審の専属的合意管轄裁判所とします。
        </Text>

        <Anchor href="/register" mt="lg" display="block">
          ← 登録画面に戻る
        </Anchor>
      </Paper>
    </Container>
  );
}
