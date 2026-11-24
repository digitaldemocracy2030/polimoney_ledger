'use client';

import { apiFetch } from '@/lib/api-client';
import { useEffect, useState } from 'react';
import { Container, Title, Alert, Loader, Stack } from '@mantine/core';
import { SubAccountManager } from '@/components/common/SubAccountManager';

interface SubAccount {
  id: string;
  ledger_type: 'political_organization' | 'election';
  parent_account_code: string;
  name: string;
  created_at: string;
}

interface AccountMaster {
  code: string;
  name: string;
  type: string;
  report_category: string;
  available_ledger_types: string[];
}

export default function SubAccountsPage() {
  const [subAccounts, setSubAccounts] = useState<SubAccount[]>([]);
  const [accountMaster, setAccountMaster] = useState<AccountMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch('/v1/sub-accounts').then((res) => {
        if (!res.ok) throw new Error('補助科目の取得に失敗しました');
        return res.json();
      }),
      apiFetch('/v1/account-master').then((res) => {
        if (!res.ok) return { data: [] };
        return res.json();
      }),
    ])
      .then(([subAccountsJson, accountMasterJson]) => {
        setSubAccounts(subAccountsJson.data || []);
        setAccountMaster(accountMasterJson.data || []);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : '取得に失敗しました')
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Container size="lg" py="xl">
        <Stack align="center" py="xl">
          <Loader />
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="lg" py="xl">
      <Title order={2} mb="lg">
        補助科目
      </Title>
      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}
      <SubAccountManager
        initialSubAccounts={subAccounts}
        accountMaster={accountMaster}
      />
    </Container>
  );
}
