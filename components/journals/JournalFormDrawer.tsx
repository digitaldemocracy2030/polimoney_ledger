'use client';

import { useState } from 'react';
import { Button, Drawer, Group, Title } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { JournalForm } from '@/components/journals/JournalForm';
import type { AccountCode, Contact, SubAccount } from '@/components/journals/JournalForm';
import { useRouter } from 'next/navigation';

interface JournalFormDrawerProps {
  ledgerType: 'organization' | 'election';
  ledgerId: string;
  accountCodes: AccountCode[];
  contacts: Contact[];
  subAccounts: SubAccount[];
  selectedYear?: number;
  isReadOnly?: boolean;
}

export function JournalFormDrawer({
  ledgerType,
  ledgerId,
  accountCodes,
  contacts,
  subAccounts,
  selectedYear,
  isReadOnly = false,
}: JournalFormDrawerProps) {
  const [opened, setOpened] = useState(false);
  const router = useRouter();

  const handleSuccess = () => {
    setOpened(false);
    router.refresh();
  };

  if (isReadOnly) return null;

  return (
    <>
      <Button leftSection={<IconPlus size={18} />} onClick={() => setOpened(true)}>
        仕訳を登録
      </Button>

      <Drawer
        opened={opened}
        onClose={() => setOpened(false)}
        title={<Title order={4}>仕訳を登録</Title>}
        position="right"
        size="85%"
        padding="md"
      >
        <JournalForm
          ledgerType={ledgerType}
          ledgerId={ledgerId}
          accountCodes={accountCodes}
          contacts={contacts}
          subAccounts={subAccounts}
          selectedYear={selectedYear}
          onSuccess={handleSuccess}
          onCancel={() => setOpened(false)}
        />
      </Drawer>
    </>
  );
}
