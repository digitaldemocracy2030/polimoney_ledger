'use client';

import { AppShell, NavLink, Burger, Group, Text, Badge, Image, Stack, Divider } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  IconBuilding,
  IconClipboardList,
  IconAddressBook,
  IconTag,
  IconUserCheck,
  IconShieldCheck,
  IconPencil,
  IconBuildingCommunity,
  IconUserCircle,
  IconSettings,
  IconLogout,
} from '@tabler/icons-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface NavCategory {
  title: string;
  items: NavItem[];
}

const navCategories: NavCategory[] = [
  {
    title: '台帳',
    items: [
      { href: '/organizations', label: '政治団体', icon: <IconBuilding size={20} /> },
      { href: '/elections', label: '選挙', icon: <IconClipboardList size={20} /> },
    ],
  },
  {
    title: 'マスタ',
    items: [
      { href: '/contacts', label: '関係者', icon: <IconAddressBook size={20} /> },
      { href: '/sub-accounts', label: '補助科目', icon: <IconTag size={20} /> },
    ],
  },
  {
    title: '認証',
    items: [
      { href: '/verify/politician', label: '政治家認証', icon: <IconUserCheck size={20} /> },
      { href: '/verify/organization', label: '政治団体管理者認証', icon: <IconShieldCheck size={20} /> },
    ],
  },
  {
    title: '情報',
    items: [
      { href: '/profile/politician', label: '政治家情報', icon: <IconPencil size={20} /> },
      { href: '/profile/organization', label: '政治団体情報', icon: <IconBuildingCommunity size={20} /> },
    ],
  },
];

const bottomNavItems: NavItem[] = [
  { href: '/account', label: 'アカウント', icon: <IconUserCircle size={20} /> },
  { href: '/settings', label: '設定', icon: <IconSettings size={20} /> },
];

export function AppShellLayout({ children }: { children: React.ReactNode }) {
  const [opened, { toggle, close }] = useDisclosure();
  const pathname = usePathname();

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 280,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md">
          <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
          <Link href="/dashboard" style={{ textDecoration: 'none' }}>
            <Group gap="xs">
              <Image src="/logo-ledger.svg" alt="" h={32} w={32} />
              <Text fw={700} size="xl" c="violet.6">Polimoney</Text>
              <Badge color="yellow" size="sm">β</Badge>
            </Group>
          </Link>
          <Text fw={500} c="teal.6" size="sm" mt={4}>Ledger</Text>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <AppShell.Section grow>
          <Stack gap="xs">
            {navCategories.map((category) => (
              <div key={category.title}>
                <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={4}>
                  {category.title}
                </Text>
                {category.items.map((item) => (
                  <NavLink
                    key={item.href}
                    component={Link}
                    href={item.href}
                    label={item.label}
                    leftSection={item.icon}
                    active={pathname === item.href || pathname.startsWith(item.href + '/')}
                    onClick={close}
                  />
                ))}
              </div>
            ))}
          </Stack>
        </AppShell.Section>

        <AppShell.Section>
          <Divider my="sm" />
          {bottomNavItems.map((item) => (
            <NavLink
              key={item.href}
              component={Link}
              href={item.href}
              label={item.label}
              leftSection={item.icon}
              active={pathname === item.href}
              onClick={close}
            />
          ))}
          <NavLink
            component={Link}
            href="/logout"
            label="ログアウト"
            leftSection={<IconLogout size={20} />}
            c="red"
            onClick={close}
          />
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
