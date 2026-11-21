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
  /** 即時登録（registerJournal）できるか。false なら承認申請として登録する */
  canRegister?: boolean;
  /** 関係者を追加できるか（manageContacts）。true ならフォームから台帳に紐付けて関係者を登録できる */
  canManageContacts?: boolean;
  /** 登録成功後に呼ばれる（親ページでのデータ再取得用） */
  onSuccess?: () => void;
}

export function JournalFormDrawer({
  ledgerType,
  ledgerId,
  accountCodes,
  contacts,
  subAccounts,
  selectedYear,
  isReadOnly = false,
  canRegister = true,
  canManageContacts = false,
  onSuccess,
}: JournalFormDrawerProps) {
  const [opened, setOpened] = useState(false);
  const router = useRouter();

  const handleSuccess = () => {
    setOpened(false);
    onSuccess?.();
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
          canRegister={canRegister}
          canManageContacts={canManageContacts}
          onSuccess={handleSuccess}
          onCancel={() => setOpened(false)}
        />
      </Drawer>
    </>
  );
}
