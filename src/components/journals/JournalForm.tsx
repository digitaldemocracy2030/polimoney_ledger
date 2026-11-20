'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  FileInput,
  Group,
  NativeSelect,
  NumberInput,
  Radio,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';

export interface AccountCode {
  code: string;
  name: string;
  type: string;
  report_category: string;
  ledger_type: string;
  is_public_subsidy_eligible?: boolean;
}

export interface Contact {
  id: string;
  name: string;
  contact_type: string;
  address?: string | null;
  occupation?: string | null;
  hub_organization_id?: string | null;
}

export interface SubAccount {
  id: string;
  name: string;
  parent_account_code: string;
}

type EntryType = 'expense' | 'revenue' | 'transfer';

interface JournalFormProps {
  ledgerType: 'organization' | 'election';
  ledgerId: string;
  accountCodes: AccountCode[];
  contacts: Contact[];
  subAccounts: SubAccount[];
  selectedYear?: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const PUBLIC_SUBSIDY_ELIGIBLE_CODES = ['EXP_PRINTING_ELEC', 'EXP_ADVERTISING_ELEC'];
const THRESHOLD_AMOUNT = 50000;
const PUBLIC_SUBSIDY_ACCOUNT_CODE = 'SUBSIDY_PUBLIC';

function getDefaultDate(selectedYear?: number): string {
  const now = new Date();
  const currentYear = now.getFullYear();
  if (!selectedYear || selectedYear === currentYear) return now.toISOString().split('T')[0];
  return `${selectedYear}-01-01`;
}

export function JournalForm({
  ledgerType,
  ledgerId,
  accountCodes,
  contacts: initialContacts,
  subAccounts,
  selectedYear,
  onSuccess,
  onCancel,
}: JournalFormProps) {
  const router = useRouter();
  const [entryType, setEntryType] = useState<EntryType>('expense');
  const [date, setDate] = useState(getDefaultDate(selectedYear));
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [contactsList, setContactsList] = useState<Contact[]>(initialContacts);
  const [contactId, setContactId] = useState('');
  const [debitAccountCode, setDebitAccountCode] = useState('');
  const [creditAccountCode, setCreditAccountCode] = useState('');
  const [debitSubAccountId, setDebitSubAccountId] = useState('');
  const [creditSubAccountId, setCreditSubAccountId] = useState('');
  const [classification, setClassification] = useState<'pre-campaign' | 'campaign'>('campaign');
  const [politicalGrantAmount, setPoliticalGrantAmount] = useState('');
  const [politicalFundAmount, setPoliticalFundAmount] = useState('');
  const [publicSubsidyAmount, setPublicSubsidyAmount] = useState('');
  const [isFullPublicSubsidy, setIsFullPublicSubsidy] = useState(false);
  const [nonMonetaryBasis, setNonMonetaryBasis] = useState('');
  const [notes, setNotes] = useState('');
  const [isReceiptHardToCollect, setIsReceiptHardToCollect] = useState(false);
  const [receiptHardToCollectReason, setReceiptHardToCollectReason] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isAssetAcquisition, setIsAssetAcquisition] = useState(false);
  const [assetType, setAssetType] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const assetAccounts = accountCodes.filter((a) => a.type === 'asset');
  const expenseAccounts = accountCodes.filter((a) => a.type === 'expense');
  const revenueAccounts = accountCodes.filter((a) => a.type === 'revenue' || a.type === 'equity');

  useEffect(() => {
    setDebitAccountCode('');
    setCreditAccountCode('');
    setDebitSubAccountId('');
    setCreditSubAccountId('');
  }, [entryType]);

  const getSubAccountsFor = (accountCode: string) =>
    subAccounts.filter((s) => s.parent_account_code === accountCode);

  const showPublicSubsidyField =
    ledgerType === 'election' &&
    entryType === 'expense' &&
    PUBLIC_SUBSIDY_ELIGIBLE_CODES.includes(debitAccountCode);

  useEffect(() => {
    if (isFullPublicSubsidy && publicSubsidyAmount) {
      setAmount(publicSubsidyAmount);
      setCreditAccountCode(PUBLIC_SUBSIDY_ACCOUNT_CODE);
    }
  }, [isFullPublicSubsidy, publicSubsidyAmount]);

  useEffect(() => {
    if (!showPublicSubsidyField) setIsFullPublicSubsidy(false);
  }, [showPublicSubsidyField]);

  useEffect(() => {
    if (!isAssetAcquisition) setAssetType('');
  }, [isAssetAcquisition]);

  const selectedContact = contactsList.find((c) => c.id === contactId);
  const amountNum = Number(amount) || 0;
  const isOver50k = amountNum > THRESHOLD_AMOUNT;
  const showAddressWarning =
    isOver50k && entryType !== 'transfer' && selectedContact && !selectedContact.address;
  const showOccupationWarning =
    isOver50k &&
    entryType === 'revenue' &&
    selectedContact?.contact_type === 'person' &&
    !selectedContact.occupation;

  const assetTypes = [
    { value: 'land', label: '土地' },
    { value: 'building', label: '建物' },
    { value: 'vehicle', label: '車両・動産' },
    { value: 'securities', label: '有価証券' },
    { value: 'facility_rights', label: '施設利用権' },
    { value: 'deposit', label: '敷金・保証金' },
  ];

  const handleSubmitWithStatus = async (status: 'draft' | 'approved') => {
    setIsSubmitting(true);
    setMessage(null);

    if (!debitAccountCode || !creditAccountCode) {
      setMessage({ type: 'error', text: '勘定科目を選択してください' });
      setIsSubmitting(false);
      return;
    }
    if (entryType !== 'transfer' && !contactId) {
      setMessage({ type: 'error', text: '関係者を選択してください' });
      setIsSubmitting(false);
      return;
    }
    if (isAssetAcquisition && !assetType) {
      setMessage({ type: 'error', text: '資産種別を選択してください' });
      setIsSubmitting(false);
      return;
    }
    if (isReceiptHardToCollect && !receiptHardToCollectReason.trim()) {
      setMessage({ type: 'error', text: '証憑を添付できない理由を入力してください' });
      setIsSubmitting(false);
      return;
    }
    if (status === 'approved' && !isReceiptHardToCollect && !receiptFile) {
      setMessage({ type: 'error', text: '証憑ファイルを選択してください' });
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/journals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ledger_id: ledgerId,
          journal_date: date || null,
          description,
          contact_id: entryType !== 'transfer' ? contactId : null,
          classification: ledgerType === 'election' ? classification : null,
          non_monetary_basis: nonMonetaryBasis || null,
          notes: notes || null,
          amount_political_grant: politicalGrantAmount ? Number(politicalGrantAmount) : 0,
          amount_political_fund: politicalFundAmount ? Number(politicalFundAmount) : 0,
          amount_public_subsidy: publicSubsidyAmount ? Number(publicSubsidyAmount) : 0,
          is_receipt_hard_to_collect: isReceiptHardToCollect,
          receipt_hard_to_collect_reason: isReceiptHardToCollect ? receiptHardToCollectReason : null,
          status,
          is_asset_acquisition: isAssetAcquisition,
          asset_type: isAssetAcquisition ? assetType : null,
          entries: [
            {
              account_code: debitAccountCode,
              sub_account_id: debitSubAccountId || null,
              debit_amount: Number(amount),
              credit_amount: 0,
            },
            {
              account_code: creditAccountCode,
              sub_account_id: creditSubAccountId || null,
              debit_amount: 0,
              credit_amount: Number(amount),
            },
          ],
        }),
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || '登録に失敗しました');
      }

      const result = await response.json();
      const journalId = result.data?.id;

      if (receiptFile && journalId) {
        const formData = new FormData();
        formData.append('file', receiptFile);
        formData.append('journal_id', journalId);
        await fetch('/api/receipts', { method: 'POST', body: formData }).catch(console.error);
      }

      setMessage({
        type: 'success',
        text: status === 'draft' ? '下書きを保存しました' : '仕訳を登録しました',
      });

      setDescription('');
      setAmount('');
      setContactId('');
      setDebitAccountCode('');
      setCreditAccountCode('');
      setDebitSubAccountId('');
      setCreditSubAccountId('');
      setNonMonetaryBasis('');
      setNotes('');
      setPoliticalGrantAmount('');
      setPoliticalFundAmount('');
      setPublicSubsidyAmount('');
      setIsFullPublicSubsidy(false);
      setIsReceiptHardToCollect(false);
      setReceiptHardToCollectReason('');
      setReceiptFile(null);
      setIsAssetAcquisition(false);
      setAssetType('');

      if (onSuccess) {
        onSuccess();
      } else {
        setTimeout(() => router.refresh(), 1000);
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : '登録に失敗しました',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSubmitWithStatus('approved');
  };

  const renderAccountSelect = (
    label: string,
    accounts: AccountCode[],
    value: string,
    onChange: (v: string) => void,
    subValue: string,
    onSubChange: (v: string) => void,
  ) => (
    <Stack gap="xs">
      <NativeSelect
        label={label}
        required
        value={value}
        onChange={(e) => {
          onChange(e.currentTarget.value);
          onSubChange('');
        }}
        data={[{ value: '', label: '選択してください' }, ...accounts.map((a) => ({ value: a.code, label: a.name }))]}
      />
      {value && getSubAccountsFor(value).length > 0 && (
        <NativeSelect
          label="補助科目"
          size="sm"
          value={subValue}
          onChange={(e) => onSubChange(e.currentTarget.value)}
          data={[
            { value: '', label: '（なし）' },
            ...getSubAccountsFor(value).map((s) => ({ value: s.id, label: s.name })),
          ]}
        />
      )}
    </Stack>
  );

  return (
    <form onSubmit={handleSubmit}>
      <Stack>
        <Group>
          <Button
            variant={entryType === 'expense' ? 'filled' : 'outline'}
            color="red"
            onClick={() => setEntryType('expense')}
          >
            支出
          </Button>
          <Button
            variant={entryType === 'revenue' ? 'filled' : 'outline'}
            onClick={() => setEntryType('revenue')}
          >
            収入
          </Button>
          <Button
            variant={entryType === 'transfer' ? 'filled' : 'outline'}
            color="violet"
            onClick={() => setEntryType('transfer')}
          >
            振替
          </Button>
        </Group>

        <Card withBorder>
          <Stack>
            <Title order={5}>基本情報</Title>
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <TextInput
                label={`日付${isFullPublicSubsidy ? '（任意）' : ''}`}
                type="date"
                value={date}
                onChange={(e) => setDate(e.currentTarget.value)}
                required={!isFullPublicSubsidy}
                description={isFullPublicSubsidy ? '全額公費負担の場合、日付不明でも登録できます' : undefined}
              />
              <TextInput
                label="金額"
                type="number"
                required
                placeholder="0"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.currentTarget.value)}
                disabled={isFullPublicSubsidy}
                description={isFullPublicSubsidy ? '公費負担額から自動設定' : undefined}
              />
            </SimpleGrid>
            <TextInput
              label="摘要"
              required
              placeholder="例: 事務所家賃 5月分"
              value={description}
              onChange={(e) => setDescription(e.currentTarget.value)}
            />
            {entryType !== 'transfer' && (
              <div>
                <NativeSelect
                  label="関係者（支払先・寄付者など）"
                  required
                  value={contactId}
                  onChange={(e) => setContactId(e.currentTarget.value)}
                  data={[
                    { value: '', label: '選択してください' },
                    ...contactsList.map((c) => ({
                      value: c.id,
                      label: `${c.name}${c.contact_type === 'corporation' ? '（法人）' : ''}`,
                    })),
                  ]}
                />
                {showAddressWarning && (
                  <Alert color="yellow" icon={<IconAlertTriangle size={16} />} mt="xs">
                    <Text size="sm">
                      5万円超の{entryType === 'expense' ? '支出' : '寄附'}には<strong>住所</strong>の記載が必要です。
                    </Text>
                  </Alert>
                )}
                {showOccupationWarning && (
                  <Alert color="yellow" icon={<IconAlertTriangle size={16} />} mt="xs">
                    <Text size="sm">
                      5万円超の個人からの寄附には<strong>職業</strong>の記載が必要です。
                    </Text>
                  </Alert>
                )}
              </div>
            )}
          </Stack>
        </Card>

        <Card withBorder>
          <Stack>
            <Title order={5}>勘定科目</Title>
            {entryType === 'expense' && (
              <SimpleGrid cols={{ base: 1, md: 2 }}>
                {renderAccountSelect(
                  '支出科目（何に使ったか）',
                  expenseAccounts,
                  debitAccountCode,
                  setDebitAccountCode,
                  debitSubAccountId,
                  setDebitSubAccountId,
                )}
                {isFullPublicSubsidy ? (
                  <TextInput label="支払元" value="公費負担（自動設定）" disabled description="全額公費負担のため、候補者の資産からの支出はありません" />
                ) : (
                  renderAccountSelect(
                    '支払元（どの資産から払ったか）',
                    assetAccounts,
                    creditAccountCode,
                    setCreditAccountCode,
                    creditSubAccountId,
                    setCreditSubAccountId,
                  )
                )}
              </SimpleGrid>
            )}
            {entryType === 'revenue' && (
              <SimpleGrid cols={{ base: 1, md: 2 }}>
                {renderAccountSelect(
                  '入金先（どの資産が増えたか）',
                  assetAccounts,
                  debitAccountCode,
                  setDebitAccountCode,
                  debitSubAccountId,
                  setDebitSubAccountId,
                )}
                {renderAccountSelect(
                  '収入科目（何による収入か）',
                  revenueAccounts,
                  creditAccountCode,
                  setCreditAccountCode,
                  creditSubAccountId,
                  setCreditSubAccountId,
                )}
              </SimpleGrid>
            )}
            {entryType === 'transfer' && (
              <SimpleGrid cols={{ base: 1, md: 2 }}>
                {renderAccountSelect(
                  '振替元（どの資産から）',
                  assetAccounts,
                  creditAccountCode,
                  setCreditAccountCode,
                  creditSubAccountId,
                  setCreditSubAccountId,
                )}
                {renderAccountSelect(
                  '振替先（どの資産へ）',
                  assetAccounts,
                  debitAccountCode,
                  setDebitAccountCode,
                  debitSubAccountId,
                  setDebitSubAccountId,
                )}
              </SimpleGrid>
            )}
          </Stack>
        </Card>

        <Card withBorder>
          <Stack>
            <Title order={5}>追加情報</Title>

            {ledgerType === 'election' && (
              <Radio.Group label="活動区分" value={classification} onChange={(v) => setClassification(v as 'pre-campaign' | 'campaign')}>
                <Group>
                  <Radio value="pre-campaign" label="立候補準備" />
                  <Radio value="campaign" label="選挙運動" />
                </Group>
              </Radio.Group>
            )}

            {showPublicSubsidyField && (
              <Stack>
                <TextInput
                  label={<>公費負担額 <Badge size="xs" color="blue">公費対象科目</Badge></>}
                  type="number"
                  placeholder="0"
                  min={0}
                  value={publicSubsidyAmount}
                  onChange={(e) => setPublicSubsidyAmount(e.currentTarget.value)}
                  required={isFullPublicSubsidy}
                />
                <Checkbox
                  label="全額公費負担（業者直接請求）"
                  description="候補者を介さず業者が直接請求する場合"
                  checked={isFullPublicSubsidy}
                  onChange={(e) => setIsFullPublicSubsidy(e.currentTarget.checked)}
                />
                {isFullPublicSubsidy && (
                  <Alert color="blue" icon={<IconInfoCircle size={16} />}>
                    <Text fw={500}>全額公費負担モード</Text>
                    <ul style={{ margin: '4px 0 0', paddingLeft: 20, fontSize: '0.85rem' }}>
                      <li>日付は任意（不明な場合は空欄可）</li>
                      <li>金額は公費負担額から自動設定</li>
                      <li>支払元は「公費負担」に自動設定</li>
                    </ul>
                  </Alert>
                )}
              </Stack>
            )}

            {ledgerType === 'organization' && (
              <SimpleGrid cols={{ base: 1, md: 2 }}>
                <TextInput
                  label="政党交付金充当額"
                  type="number"
                  placeholder="0"
                  min={0}
                  value={politicalGrantAmount}
                  onChange={(e) => setPoliticalGrantAmount(e.currentTarget.value)}
                />
                <TextInput
                  label="政党基金充当額"
                  type="number"
                  placeholder="0"
                  min={0}
                  value={politicalFundAmount}
                  onChange={(e) => setPoliticalFundAmount(e.currentTarget.value)}
                />
              </SimpleGrid>
            )}

            {entryType === 'expense' && (
              <Checkbox
                label="資産取得"
                description="土地・建物・車両等の資産を取得した場合にチェック"
                checked={isAssetAcquisition}
                onChange={(e) => setIsAssetAcquisition(e.currentTarget.checked)}
              />
            )}

            {isAssetAcquisition && (
              <NativeSelect
                label="資産種別"
                required
                value={assetType}
                onChange={(e) => setAssetType(e.currentTarget.value)}
                data={[{ value: '', label: '選択してください' }, ...assetTypes]}
                description="収支報告書の「資産等」に記載されます"
              />
            )}

            <TextInput
              label="金銭以外の見積の根拠"
              placeholder="現物寄付等の場合に記入"
              value={nonMonetaryBasis}
              onChange={(e) => setNonMonetaryBasis(e.currentTarget.value)}
            />

            <Textarea
              label="備考"
              placeholder="任意入力"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
            />

            <Radio.Group
              label="証憑"
              value={isReceiptHardToCollect ? 'hard' : 'attach'}
              onChange={(v) => setIsReceiptHardToCollect(v === 'hard')}
            >
              <Stack gap="xs">
                <Radio value="attach" label="証憑を添付する" description="領収書、契約書、利用明細書など" />
                <Radio value="hard" label="証憑を添付できない" description="自動販売機、交通費など" />
              </Stack>
            </Radio.Group>

            {!isReceiptHardToCollect && (
              <div>
                <FileInput
                  label="証憑ファイル"
                  required
                  accept="image/*,.pdf"
                  value={receiptFile}
                  onChange={setReceiptFile}
                  placeholder="ファイルを選択"
                />
                {!receiptFile && (
                  <Text size="xs" c="yellow" mt={4}>
                    証憑のスキャン画像またはPDFを選択してください
                  </Text>
                )}
              </div>
            )}

            {isReceiptHardToCollect && (
              <TextInput
                label="添付できない理由"
                required
                placeholder="例: 自動販売機での購入のため"
                value={receiptHardToCollectReason}
                onChange={(e) => setReceiptHardToCollectReason(e.currentTarget.value)}
                description="理由は収支報告書に記載されます"
              />
            )}
          </Stack>
        </Card>

        {message && (
          <Alert color={message.type === 'success' ? 'green' : 'red'}>{message.text}</Alert>
        )}

        <Group justify="flex-end">
          {onCancel && (
            <Button variant="subtle" onClick={onCancel}>
              キャンセル
            </Button>
          )}
          <Button
            variant="outline"
            loading={isSubmitting}
            disabled={isSubmitting}
            onClick={() => handleSubmitWithStatus('draft')}
          >
            下書き保存
          </Button>
          <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
            仕訳を登録
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
