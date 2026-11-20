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
  Loader,
} from '@mantine/core';
import { IconUserPlus, IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';

type AppRole = 'admin' | 'accountant' | 'approver' | 'submitter' | 'viewer';

const roleDisplayNames: Record<AppRole, string> = {
  admin: '管理者',
  accountant: '経理担当',
  approver: '承認者',
  submitter: '入力者',
  viewer: '閲覧者',
};

const roleDescriptions: Record<AppRole, string> = {
  admin: 'メンバー管理、設定変更を含む全操作が可能',
  accountant: '仕訳の入力・編集・承認、帳簿の閲覧が可能',
  approver: '仕訳の承認、帳簿の閲覧が可能',
  submitter: '仕訳の入力・編集、帳簿の閲覧が可能',
  viewer: '帳簿の閲覧のみ可能',
};

interface Member {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
  invited_by_user_id: string;
  email?: string;
  display_name?: string;
}

interface MemberManagerProps {
  ledgerId?: string;
  initialMembers: Member[];
  isOwner: boolean;
  canManageMembers: boolean;
}

interface PendingTransfer {
  id: string;
  to_user_id?: string;
  to_user_name?: string;
  status: string;
  requested_at: string;
}

const roles: AppRole[] = ['admin', 'accountant', 'approver', 'submitter', 'viewer'];

export function MemberManager({
  ledgerId,
  initialMembers,
  isOwner,
  canManageMembers,
}: MemberManagerProps) {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<AppRole>('viewer');

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [pendingTransfer, setPendingTransfer] =
    useState<PendingTransfer | null>(null);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!inviteEmail.trim()) {
      setError('メールアドレスを入力してください');
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
          ledger_id: ledgerId || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '招待に失敗しました');
      }

      const { data, message } = await res.json();
      setMembers([...members, { ...data, email: inviteEmail }]);
      setSuccess(message || '招待を送信しました');
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteRole('viewer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: AppRole) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/members/${memberId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '更新に失敗しました');
      }

      const { data } = await res.json();
      setMembers(
        members.map((m) => (m.id === memberId ? { ...m, ...data } : m))
      );
      setSuccess('権限を更新しました');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (member: Member) => {
    if (
      !confirm(
        `${
          member.display_name || member.email || 'このメンバー'
        } を削除しますか？`
      )
    )
      return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/members/${member.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '削除に失敗しました');
      }

      setMembers(members.filter((m) => m.id !== member.id));
      setSuccess('メンバーを削除しました');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!selectedMemberId) {
      setError('譲渡先のメンバーを選択してください');
      setIsLoading(false);
      return;
    }

    const selectedMember = members.find((m) => m.user_id === selectedMemberId);

    try {
      const res = await fetch('/api/ownership-transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_user_id: selectedMemberId,
          ledger_id: ledgerId || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '譲渡申請の作成に失敗しました');
      }

      const { data, message } = await res.json();
      setPendingTransfer({
        id: data.id,
        to_user_id: selectedMemberId,
        to_user_name:
          selectedMember?.display_name || selectedMember?.email || 'メンバー',
        status: data.status,
        requested_at: data.requested_at,
      });
      setSuccess(message || '譲渡申請を作成しました');
      setShowTransferModal(false);
      setSelectedMemberId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelTransfer = async () => {
    if (!pendingTransfer) return;
    if (!confirm('譲渡申請をキャンセルしますか？')) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/ownership-transfers/${pendingTransfer.id}`,
        { method: 'DELETE' }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'キャンセルに失敗しました');
      }

      setPendingTransfer(null);
      setSuccess('譲渡申請をキャンセルしました');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Stack>
      {error && (
        <Alert color="red" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert color="green" withCloseButton onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Group justify="space-between">
        <Text c="dimmed">
          台帳にアクセスできるメンバーと権限を管理します。
        </Text>
        {canManageMembers && (
          <Button
            leftSection={<IconUserPlus size={16} />}
            onClick={() => setShowInviteModal(true)}
          >
            メンバーを招待
          </Button>
        )}
      </Group>

      <Card withBorder>
        <Stack>
          <Group justify="space-between" align="flex-start">
            <Stack gap="xs">
              <Title order={5}>オーナー</Title>
              <Text c="dimmed" fz="sm">
                オーナーはこの台帳の所有者です。全ての権限を持ち、削除できません。
              </Text>
              <Group gap="xs">
                <Badge>オーナー</Badge>
                {isOwner && (
                  <Text fz="sm" c="green">
                    （あなた）
                  </Text>
                )}
              </Group>
            </Stack>
            {isOwner && !pendingTransfer && (
              <Button
                variant="outline"
                size="xs"
                onClick={() => setShowTransferModal(true)}
              >
                オーナーを譲渡
              </Button>
            )}
          </Group>

          {pendingTransfer && (
            <Alert
              icon={<IconInfoCircle size={16} />}
              color="blue"
            >
              <Group justify="space-between" align="center">
                <Stack gap={2}>
                  <Text fw={500} fz="sm">オーナー譲渡申請中</Text>
                  <Text fz="sm">
                    {pendingTransfer.to_user_name} さんへの譲渡申請が承認待ちです
                  </Text>
                </Stack>
                <Button
                  variant="subtle"
                  size="compact-sm"
                  onClick={handleCancelTransfer}
                  disabled={isLoading}
                >
                  キャンセル
                </Button>
              </Group>
            </Alert>
          )}
        </Stack>
      </Card>

      <Card withBorder>
        <Stack>
          <Title order={5}>メンバー</Title>

          {members.length === 0 ? (
            <Text c="dimmed" py="md">
              まだメンバーがいません。「メンバーを招待」から追加してください。
            </Text>
          ) : (
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>メンバー</Table.Th>
                  <Table.Th>権限</Table.Th>
                  <Table.Th>招待日</Table.Th>
                  {canManageMembers && <Table.Th />}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {members.map((member) => (
                  <Table.Tr key={member.id}>
                    <Table.Td>
                      <Stack gap={0}>
                        <Text fw={500} fz="sm">
                          {member.display_name || member.email || '未設定'}
                        </Text>
                        {member.email && (
                          <Text c="dimmed" fz="xs">
                            {member.email}
                          </Text>
                        )}
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      {canManageMembers ? (
                        <Select
                          size="xs"
                          value={member.role}
                          onChange={(value) =>
                            handleRoleChange(member.id, value as AppRole)
                          }
                          data={roles.map((role) => ({
                            label: roleDisplayNames[role],
                            value: role,
                          }))}
                          disabled={isLoading}
                        />
                      ) : (
                        <Badge variant="light">
                          {roleDisplayNames[member.role]}
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text c="dimmed" fz="sm">
                        {new Date(member.created_at).toLocaleDateString('ja-JP')}
                      </Text>
                    </Table.Td>
                    {canManageMembers && (
                      <Table.Td>
                        <Button
                          variant="subtle"
                          color="red"
                          size="compact-sm"
                          onClick={() => handleDelete(member)}
                          disabled={isLoading}
                        >
                          削除
                        </Button>
                      </Table.Td>
                    )}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      </Card>

      <Card withBorder>
        <Stack>
          <Title order={5}>権限の説明</Title>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>権限</Table.Th>
                <Table.Th>説明</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {roles.map((role) => (
                <Table.Tr key={role}>
                  <Table.Td fw={500}>{roleDisplayNames[role]}</Table.Td>
                  <Table.Td c="dimmed">{roleDescriptions[role]}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Stack>
      </Card>

      {/* 招待モーダル */}
      <Modal
        opened={showInviteModal}
        onClose={() => {
          setShowInviteModal(false);
          setError(null);
        }}
        title="メンバーを招待"
      >
        {error && (
          <Alert color="red" mb="md">
            {error}
          </Alert>
        )}

        <form onSubmit={handleInvite}>
          <Stack>
            <TextInput
              label="メールアドレス"
              required
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.currentTarget.value)}
              placeholder="example@example.com"
            />

            <Select
              label="権限"
              value={inviteRole}
              onChange={(value) => setInviteRole((value as AppRole) || 'viewer')}
              data={roles.map((role) => ({
                label: `${roleDisplayNames[role]} - ${roleDescriptions[role]}`,
                value: role,
              }))}
            />

            <Group justify="flex-end">
              <Button
                variant="subtle"
                onClick={() => {
                  setShowInviteModal(false);
                  setError(null);
                }}
                disabled={isLoading}
              >
                キャンセル
              </Button>
              <Button type="submit" loading={isLoading}>
                招待を送信
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* オーナー譲渡モーダル */}
      <Modal
        opened={showTransferModal}
        onClose={() => {
          setShowTransferModal(false);
          setError(null);
          setSelectedMemberId('');
        }}
        title="オーナーを譲渡"
      >
        <Alert
          icon={<IconAlertTriangle size={16} />}
          color="yellow"
          mb="md"
        >
          <Stack gap={2}>
            <Text fw={500} fz="sm">注意</Text>
            <Text fz="sm">
              オーナーを譲渡すると、この台帳の所有権が移ります。あなたは管理者として残ります。
            </Text>
          </Stack>
        </Alert>

        {error && (
          <Alert color="red" mb="md">
            {error}
          </Alert>
        )}

        <form onSubmit={handleTransfer}>
          <Stack>
            {members.length === 0 ? (
              <Alert color="blue">
                譲渡先となるメンバーがいません。先にメンバーを招待してください。
              </Alert>
            ) : (
              <Select
                label="譲渡先のメンバー"
                required
                placeholder="選択してください"
                value={selectedMemberId || null}
                onChange={(value) => setSelectedMemberId(value || '')}
                data={members.map((member) => ({
                  label: `${member.display_name || member.email || '未設定'} (${roleDisplayNames[member.role]})`,
                  value: member.user_id,
                }))}
                description="選択したメンバーに譲渡申請メールが送信されます"
              />
            )}

            <Group justify="flex-end">
              <Button
                variant="subtle"
                onClick={() => {
                  setShowTransferModal(false);
                  setError(null);
                  setSelectedMemberId('');
                }}
                disabled={isLoading}
              >
                キャンセル
              </Button>
              <Button
                type="submit"
                color="yellow"
                loading={isLoading}
                disabled={members.length === 0}
              >
                譲渡申請を送信
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
