'use client';

import { useState } from 'react';
import {
  Button,
  Group,
  Stack,
  Text,
  Title,
  Card,
  Table,
  Badge,
  Modal,
  Alert,
  TextInput,
  Select,
  SegmentedControl,
  Loader,
} from '@mantine/core';
import { IconPlus, IconTag } from '@tabler/icons-react';

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

interface SubAccountManagerProps {
  initialSubAccounts: SubAccount[];
  accountMaster: AccountMaster[];
}

type ModalMode = 'closed' | 'add' | 'edit';

export function SubAccountManager({
  initialSubAccounts,
  accountMaster,
}: SubAccountManagerProps) {
  const [subAccounts, setSubAccounts] =
    useState<SubAccount[]>(initialSubAccounts);
  const [modalMode, setModalMode] = useState<ModalMode>('closed');
  const [editingSubAccount, setEditingSubAccount] = useState<SubAccount | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filterLedgerType, setFilterLedgerType] = useState<string>('all');

  const [formData, setFormData] = useState({
    ledger_type: 'political_organization' as
      | 'political_organization'
      | 'election',
    parent_account_code: '',
    name: '',
  });

  const getFilteredAccounts = (ledgerType: string) =>
    accountMaster.filter((account) => {
      if (!account.code.startsWith('EXP_')) return false;
      const type =
        ledgerType === 'political_organization'
          ? 'political_organization'
          : 'election';
      return account.available_ledger_types?.includes(type);
    });

  const getAccountName = (code: string) =>
    accountMaster.find((a) => a.code === code)?.name || code;

  const filteredSubAccounts =
    filterLedgerType === 'all'
      ? subAccounts
      : subAccounts.filter((s) => s.ledger_type === filterLedgerType);

  const groupedSubAccounts = filteredSubAccounts.reduce(
    (groups, subAccount) => {
      const key = subAccount.parent_account_code;
      if (!groups[key]) groups[key] = [];
      groups[key].push(subAccount);
      return groups;
    },
    {} as Record<string, SubAccount[]>
  );

  const resetForm = () => {
    setFormData({
      ledger_type: 'political_organization',
      parent_account_code: '',
      name: '',
    });
    setError(null);
  };

  const openAddModal = () => {
    resetForm();
    setEditingSubAccount(null);
    setModalMode('add');
  };

  const openEditModal = (subAccount: SubAccount) => {
    setFormData({
      ledger_type: subAccount.ledger_type,
      parent_account_code: subAccount.parent_account_code,
      name: subAccount.name,
    });
    setEditingSubAccount(subAccount);
    setModalMode('edit');
  };

  const closeModal = () => {
    setModalMode('closed');
    setEditingSubAccount(null);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!formData.name.trim()) {
      setError('補助科目名は必須です');
      setIsLoading(false);
      return;
    }

    if (modalMode === 'add' && !formData.parent_account_code) {
      setError('勘定科目を選択してください');
      setIsLoading(false);
      return;
    }

    try {
      if (modalMode === 'add') {
        const res = await fetch('/api/sub-accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ledger_type: formData.ledger_type,
            parent_account_code: formData.parent_account_code,
            name: formData.name.trim(),
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || '登録に失敗しました');
        }

        const { data } = await res.json();
        setSubAccounts(
          [...subAccounts, data].sort((a, b) =>
            a.parent_account_code.localeCompare(b.parent_account_code)
          )
        );
      } else if (modalMode === 'edit' && editingSubAccount) {
        const res = await fetch(`/api/sub-accounts/${editingSubAccount.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: formData.name.trim() }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || '更新に失敗しました');
        }

        const { data } = await res.json();
        setSubAccounts(
          subAccounts.map((s) => (s.id === editingSubAccount.id ? data : s))
        );
      }

      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (subAccount: SubAccount) => {
    if (!confirm(`「${subAccount.name}」を削除しますか？`)) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/sub-accounts/${subAccount.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '削除に失敗しました');
      }

      setSubAccounts(subAccounts.filter((s) => s.id !== subAccount.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : '削除に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Stack>
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <Text c="dimmed">
          勘定科目の内訳を細分化するための補助科目を管理します。
        </Text>
        <Group>
          <Select
            size="xs"
            value={filterLedgerType}
            onChange={(value) => setFilterLedgerType(value || 'all')}
            data={[
              { label: 'すべて', value: 'all' },
              { label: '政治団体用', value: 'political_organization' },
              { label: '選挙用', value: 'election' },
            ]}
          />
          <Button
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={openAddModal}
          >
            新規登録
          </Button>
        </Group>
      </Group>

      {Object.keys(groupedSubAccounts).length === 0 ? (
        <Card withBorder p="xl">
          <Stack align="center" py="xl">
            <IconTag size={64} stroke={1} color="var(--mantine-color-dimmed)" />
            <Title order={4}>補助科目がまだ登録されていません</Title>
            <Text c="dimmed">
              「新規登録」ボタンから補助科目を追加してください。
            </Text>
          </Stack>
        </Card>
      ) : (
        <Stack>
          {Object.entries(groupedSubAccounts).map(([accountCode, items]) => (
            <Card key={accountCode} withBorder>
              <Stack>
                <Group>
                  <Title order={5}>{getAccountName(accountCode)}</Title>
                  <Badge variant="light" size="sm">
                    {accountCode}
                  </Badge>
                </Group>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>補助科目名</Table.Th>
                      <Table.Th>台帳タイプ</Table.Th>
                      <Table.Th />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {items.map((subAccount) => (
                      <Table.Tr key={subAccount.id}>
                        <Table.Td fw={500}>{subAccount.name}</Table.Td>
                        <Table.Td>
                          <Badge
                            size="sm"
                            color={
                              subAccount.ledger_type ===
                              'political_organization'
                                ? 'blue'
                                : 'yellow'
                            }
                          >
                            {subAccount.ledger_type ===
                            'political_organization'
                              ? '政治団体'
                              : '選挙'}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs" justify="flex-end">
                            <Button
                              variant="subtle"
                              size="compact-xs"
                              onClick={() => openEditModal(subAccount)}
                            >
                              編集
                            </Button>
                            <Button
                              variant="subtle"
                              color="red"
                              size="compact-xs"
                              onClick={() => handleDelete(subAccount)}
                              disabled={isLoading}
                            >
                              削除
                            </Button>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Stack>
            </Card>
          ))}
        </Stack>
      )}

      <Modal
        opened={modalMode !== 'closed'}
        onClose={closeModal}
        title={
          modalMode === 'add' ? '補助科目の新規登録' : '補助科目の編集'
        }
      >
        {error && (
          <Alert color="red" mb="md">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Stack>
            {modalMode === 'add' && (
              <SegmentedControl
                value={formData.ledger_type}
                onChange={(value) =>
                  setFormData({
                    ...formData,
                    ledger_type: value as 'political_organization' | 'election',
                    parent_account_code: '',
                  })
                }
                data={[
                  { label: '政治団体', value: 'political_organization' },
                  { label: '選挙', value: 'election' },
                ]}
              />
            )}

            {modalMode === 'add' && (
              <Select
                label="勘定科目"
                required
                placeholder="選択してください"
                value={formData.parent_account_code || null}
                onChange={(value) =>
                  setFormData({
                    ...formData,
                    parent_account_code: value || '',
                  })
                }
                data={getFilteredAccounts(formData.ledger_type).map(
                  (account) => ({
                    label: account.name,
                    value: account.code,
                  })
                )}
              />
            )}

            {modalMode === 'edit' && editingSubAccount && (
              <TextInput
                label="勘定科目"
                value={getAccountName(editingSubAccount.parent_account_code)}
                disabled
              />
            )}

            <TextInput
              label="補助科目名"
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.currentTarget.value })
              }
              placeholder="例: 電気代、ガソリン代"
            />

            <Group justify="flex-end">
              <Button
                variant="subtle"
                onClick={closeModal}
                disabled={isLoading}
              >
                キャンセル
              </Button>
              <Button type="submit" loading={isLoading}>
                {modalMode === 'add' ? '登録' : '更新'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
