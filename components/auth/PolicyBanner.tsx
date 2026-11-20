'use client';

import { useEffect, useState } from 'react';
import { ActionIcon, Box, Group, Text } from '@mantine/core';
import { IconInfoCircle, IconX } from '@tabler/icons-react';
import Link from 'next/link';

const CURRENT_POLICY_VERSION = '2025-01-01';
const STORAGE_KEY = 'policy_acknowledged_version';

export function PolicyBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const acknowledgedVersion = localStorage.getItem(STORAGE_KEY);
    if (acknowledgedVersion !== CURRENT_POLICY_VERSION) {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, CURRENT_POLICY_VERSION);
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <Box bg="blue.6" c="white" px="md" py="sm">
      <Group justify="space-between" maw={896} mx="auto">
        <Group gap="sm">
          <IconInfoCircle size={20} style={{ flexShrink: 0 }} />
          <Text size="sm">
            プライバシーポリシーが更新されました。
            <Text
              component={Link}
              href="/privacy"
              c="white"
              td="underline"
              fw={500}
              ml="xs"
            >
              詳細を確認
            </Text>
          </Text>
        </Group>
        <ActionIcon
          variant="subtle"
          c="white"
          size="sm"
          onClick={handleDismiss}
          aria-label="閉じる"
        >
          <IconX size={18} />
        </ActionIcon>
      </Group>
    </Box>
  );
}
