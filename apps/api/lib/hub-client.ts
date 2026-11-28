/**
 * Polimoney Hub API クライアント
 */

import type {
  ApiError,
  ApiResponse,
  CandidateRegistrationInfo,
  CreateOrganizationManagerVerificationInput,
  CreatePoliticianVerificationInput,
  Election,
  ElectionRequest,
  Organization,
  OrganizationManagerVerification,
  OrganizationRequest,
  PoliticalFundReportInfo,
  Politician,
  PoliticianVerification,
  UpdateOrganizationInput,
} from "@polimoney-ledger/shared/hub-types.ts";

// ============================================
// 環境変数から Hub API の設定を取得
// ============================================

/** 本番/開発の判定 */
// 注意: DENO_ENV は Deno Deploy で予約済みのため APP_ENV を使用
const IS_PRODUCTION = Deno.env.get("APP_ENV") === "production";

/**
 * Hub API URL / API Key
 * - 本番環境 (APP_ENV=production): PROD 設定を使用
 * - 開発環境 (APP_ENV!=production): DEV 設定を使用
 * - テストユーザー: 常に DEV キーを使用（is_test=true のデータを取得）
 *
 * 注意: テストユーザーのデータは is_test フラグで区別されます。
 * DEV キーで呼ぶと is_test=true、PROD キーで呼ぶと is_test=false のデータが返ります。
 */
const HUB_API_URL_PROD = Deno.env.get("HUB_API_URL_PROD") ||
  "https://api.polimoney.dd2030.org";
const HUB_API_URL_DEV = Deno.env.get("HUB_API_URL_DEV") ||
  "http://localhost:3722";
const HUB_API_KEY_PROD = Deno.env.get("HUB_API_KEY_PROD") || "";
const HUB_API_KEY_DEV = Deno.env.get("HUB_API_KEY_DEV") || "";

// デフォルト環境（非テストユーザー用）
const HUB_API_URL = IS_PRODUCTION ? HUB_API_URL_PROD : HUB_API_URL_DEV;
const HUB_API_KEY = IS_PRODUCTION ? HUB_API_KEY_PROD : HUB_API_KEY_DEV;

// API キーが設定されていない場合は起動時に警告
if (!HUB_API_KEY_PROD && IS_PRODUCTION) {
  console.warn(
    "[Hub API] Warning: HUB_API_KEY_PROD is not set. Production API calls will fail.",
  );
}
if (!HUB_API_KEY_DEV) {
  console.warn(
    "[Hub API] Warning: HUB_API_KEY_DEV is not set. Test user API calls will fail.",
  );
}

// ============================================
// テストユーザー定数（開発用ダミーデータの所有者）
// ============================================

/** テストユーザー ID（seed-supabase.ts と一致させる） */
export const TEST_USER_ID = "00000000-0000-0000-0000-000000000001";

/**
 * 指定されたユーザー ID がテストユーザーかどうかを判定
 */
export function isTestUser(userId: string | null | undefined): boolean {
  return userId === TEST_USER_ID;
}

// ============================================
// 型定義（packages/shared/src/hub-types.ts で定義し、ここから再エクスポート）
// ============================================

export type {
  ApiError,
  ApiResponse,
  CandidateRegistrationInfo,
  CreateOrganizationManagerVerificationInput,
  CreatePoliticianVerificationInput,
  Election,
  ElectionRequest,
  Organization,
  OrganizationManagerVerification,
  OrganizationRequest,
  PoliticalFundReportInfo,
  Politician,
  PoliticianVerification,
  UpdateOrganizationInput,
};

// ============================================
// ヘルパー関数
// ============================================

/**
 * Hub API のエラー（HTTP ステータスを持つ）
 * status が 0 の場合は接続エラーや不正なレスポンスなど、Hub に到達できなかったことを表す。
 */
export class HubApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "HubApiError";
  }
}

/** Hub のエラーレスポンスからメッセージを取り出す（FastAPI は detail、旧 API は error） */
function hubErrorMessage(json: ApiError): string {
  if (typeof json.detail === "string" && json.detail) return json.detail;
  if (json.error) return json.error;
  return "API request failed";
}

/** Hub が 404 を返したかどうか */
export function isHubNotFound(error: unknown): boolean {
  return error instanceof HubApiError && error.status === 404;
}

interface FetchApiOptions extends RequestInit {
  /** テストユーザー判定用の userId（テストユーザーの場合は DEV キーを使用） */
  userId?: string;
}

async function fetchApi<T>(
  endpoint: string,
  options: FetchApiOptions = {},
): Promise<T> {
  const { userId, ...fetchOptions } = options;

  // テストユーザーの場合は DEV キーを使用（is_test=true のデータを取得）
  // URL は環境ごとに同じ Hub を使い、キーだけを切り替える
  const useDevKey = isTestUser(userId);
  const apiUrl = HUB_API_URL;
  const apiKey = useDevKey ? HUB_API_KEY_DEV : HUB_API_KEY;

  // API キーのバリデーション
  if (!apiKey) {
    throw new HubApiError(
      `Hub API key is not configured. Set ${
        useDevKey
          ? "HUB_API_KEY_DEV"
          : IS_PRODUCTION
          ? "HUB_API_KEY_PROD"
          : "HUB_API_KEY_DEV"
      } environment variable.`,
      0,
    );
  }

  const headers = new Headers(fetchOptions.headers);
  headers.set("Content-Type", "application/json");
  headers.set("X-API-Key", apiKey);

  const url = `${apiUrl}${endpoint}`;
  console.log(
    `[Hub API] Fetching: ${url} (key: ${useDevKey ? "DEV" : "default"})`,
  );

  let response: Response;
  try {
    response = await fetch(url, {
      ...fetchOptions,
      headers,
    });
  } catch (error) {
    console.error(`[Hub API] Request to ${url} failed:`, error);
    throw new HubApiError("Hub API に接続できませんでした", 0);
  }

  // レスポンスのContent-Typeを確認
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    const text = await response.text();
    console.error(
      `[Hub API] Non-JSON response from ${url}:`,
      text.slice(0, 200),
    );
    throw new HubApiError(
      `Hub API returned non-JSON response (${response.status})`,
      response.ok ? 0 : response.status,
    );
  }

  const json = await response.json();

  if (!response.ok) {
    throw new HubApiError(hubErrorMessage(json as ApiError), response.status);
  }

  return json as T;
}

// ============================================
// 選挙 API
// ============================================

export async function getElections(
  options: { userId?: string } = {},
): Promise<Election[]> {
  const result = await fetchApi<ApiResponse<Election[]>>("/api/v1/elections", {
    userId: options.userId,
  });
  return result.data;
}

export async function getElection(id: string): Promise<Election> {
  const result = await fetchApi<ApiResponse<Election>>(
    `/api/v1/elections/${id}`,
  );
  return result.data;
}

// ============================================
// 政治家×選挙 / 政治家×政治団体 の紐付け
// （ledgers.hub_politician_election_id / hub_politician_organization_id に保存し、Hub 同期で使う）
// ============================================

/** Hub の紐付け（politician_elections / politician_organizations）の ID */
export interface HubLink {
  id: string;
}

/**
 * 政治家×選挙 の紐付けを取得する（無ければ Hub が作成する）
 * Hub は、政治家が認証済みで ledger_user_id が一致することを確認する（一致しなければ 403）。
 */
export async function resolvePoliticianElection(params: {
  ledgerUserId: string;
  politicianId: string;
  electionId: string;
}): Promise<HubLink> {
  const result = await fetchApi<ApiResponse<HubLink>>(
    "/api/v1/politician-elections",
    {
      method: "POST",
      body: JSON.stringify({
        ledger_user_id: params.ledgerUserId,
        politician_id: params.politicianId,
        election_id: params.electionId,
      }),
      userId: params.ledgerUserId,
    },
  );
  return result.data;
}

/**
 * 政治団体の代表者との紐付け（politician_organizations, role = representative）を取得する
 * Hub は、ユーザーがその団体の管理者（または代表者本人）であることを確認する（違えば 403）。
 * 代表者の紐付けが無い・複数ある場合は 409（Hub 管理者の設定が必要）。紐付けは作成しない。
 */
export async function resolvePoliticianOrganization(params: {
  ledgerUserId: string;
  organizationId: string;
}): Promise<HubLink> {
  const result = await fetchApi<ApiResponse<HubLink>>(
    "/api/v1/politician-organizations/resolve",
    {
      method: "POST",
      body: JSON.stringify({
        ledger_user_id: params.ledgerUserId,
        organization_id: params.organizationId,
      }),
      userId: params.ledgerUserId,
    },
  );
  return result.data;
}

// ============================================
// 政治団体 API
// ============================================

export async function getOrganizations(
  options: { userId?: string } = {},
): Promise<Organization[]> {
  const result = await fetchApi<ApiResponse<Organization[]>>(
    "/api/v1/organizations",
    { userId: options.userId },
  );
  return result.data;
}

export async function getOrganization(
  id: string,
  options: { userId?: string } = {},
): Promise<Organization> {
  const result = await fetchApi<ApiResponse<Organization>>(
    `/api/v1/organizations/${id}`,
    { userId: options.userId },
  );
  return result.data;
}

/**
 * 政治団体を更新【v2.1 追加】
 */
export async function updateOrganization(
  id: string,
  data: UpdateOrganizationInput,
  options: { userId?: string } = {},
): Promise<Organization> {
  const result = await fetchApi<ApiResponse<Organization>>(
    `/api/v1/organizations/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
      userId: options.userId,
    },
  );
  return result.data;
}

/** 管理する政治団体（認証済み）【v2.1 更新】 */
export interface ManagedOrganization extends Organization {
  manager_verified_at: string;
  manager_verified_domain: string;
}

/**
 * ユーザーが管理する政治団体一覧を取得
 * Hub の organization_managers テーブルを参照
 *
 * Hub が 404 を返した場合（エンドポイント未実装など）は「管理している団体なし」として空配列を返す。
 * Hub に到達できない等のその他のエラーは HubApiError を throw する
 * （認可判断に使う呼び出し側で 503 などを返すため）。
 */
export async function getManagedOrganizations(
  ledgerUserId: string,
): Promise<ManagedOrganization[]> {
  try {
    const result = await fetchApi<ApiResponse<ManagedOrganization[]>>(
      `/api/v1/organizations/managed?ledger_user_id=${
        encodeURIComponent(ledgerUserId)
      }`,
      { userId: ledgerUserId },
    );
    return result.data ?? [];
  } catch (error) {
    if (isHubNotFound(error)) return [];
    throw error;
  }
}

// ============================================
// マスタデータ API（勘定科目など）
// ============================================

/** 勘定科目マスタ */
export interface AccountCode {
  code: string;
  name: string;
  name_kana: string | null;
  type: string; // 'asset', 'liability', 'equity', 'revenue', 'expense', 'subsidy'
  report_category: string; // '経常経費', '政治活動費', '選挙運動費用'
  ledger_type: string; // 'both', 'organization', 'election'
  is_public_subsidy_eligible: boolean;
  display_order: number;
  polimoney_category: string | null;
  parent_code: string | null;
  description: string | null;
}

/**
 * 勘定科目一覧を取得
 * @param params.ledgerType 台帳タイプでフィルタ ('organization' | 'election')
 * @param params.type 勘定科目タイプでフィルタ ('asset' | 'liability' | 'equity' | 'revenue' | 'expense')
 */
export async function getAccountCodes(params?: {
  ledgerType?: string;
  type?: string;
  /** テストユーザーの場合は DEV キーを使う */
  userId?: string;
}): Promise<AccountCode[]> {
  const searchParams = new URLSearchParams();
  if (params?.ledgerType) searchParams.set("ledger_type", params.ledgerType);
  if (params?.type) searchParams.set("type", params.type);

  const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
  const result = await fetchApi<ApiResponse<AccountCode[]>>(
    `/api/v1/master/account-codes${query}`,
    { userId: params?.userId },
  );
  return result.data;
}

/**
 * 特定の勘定科目を取得
 */
export async function getAccountCode(code: string): Promise<AccountCode> {
  const result = await fetchApi<ApiResponse<AccountCode>>(
    `/api/v1/master/account-codes/${code}`,
  );
  return result.data;
}

// ============================================
// 政治家 API
// ============================================

/**
 * Ledger ユーザーに紐付いた政治家を取得する（Hub は ledger_user_id で絞り込む）
 */
export async function getPoliticiansByLedgerUserId(
  ledgerUserId: string,
): Promise<Politician[]> {
  const result = await fetchApi<ApiResponse<Politician[]>>(
    `/api/v1/politicians?ledger_user_id=${encodeURIComponent(ledgerUserId)}`,
    { userId: ledgerUserId },
  );
  return result.data;
}

export async function getPolitician(
  id: string,
  options: { userId?: string } = {},
): Promise<Politician> {
  const result = await fetchApi<ApiResponse<Politician>>(
    `/api/v1/politicians/${id}`,
    { userId: options.userId },
  );
  return result.data;
}

export async function createPolitician(
  data: {
    name: string;
    name_kana?: string;
  },
  options: { userId?: string } = {},
): Promise<Politician> {
  const result = await fetchApi<ApiResponse<Politician>>(
    "/api/v1/politicians",
    {
      method: "POST",
      body: JSON.stringify(data),
      userId: options.userId,
    },
  );
  return result.data;
}

/** 政治家更新用入力 */
export interface UpdatePoliticianInput {
  name?: string;
  name_kana?: string | null;
  official_url?: string | null;
  party?: string | null;
  photo_url?: string | null;
  // SNS
  sns_x?: string | null;
  sns_instagram?: string | null;
  sns_facebook?: string | null;
  sns_tiktok?: string | null;
}

/**
 * 政治家情報を更新（認証済み政治家のみ）
 */
export async function updatePolitician(
  id: string,
  data: UpdatePoliticianInput,
  options: { userId?: string } = {},
): Promise<Politician> {
  const result = await fetchApi<ApiResponse<Politician>>(
    `/api/v1/politicians/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
      userId: options.userId,
    },
  );
  return result.data;
}

/**
 * ユーザー本人として Hub で認証済みの政治家一覧を返す
 * （ledger_user_id がそのユーザーで is_verified の政治家）。
 * 政治家本人であることの判定はこれを使う（Ledger の profiles.hub_politician_id は使わない）。
 */
export async function getVerifiedPoliticiansByUserId(
  ledgerUserId: string,
): Promise<Politician[]> {
  // テストユーザーの場合は DEV キーを使用
  const politicians = await getPoliticiansByLedgerUserId(ledgerUserId);
  return politicians.filter(
    (p) => p.ledger_user_id === ledgerUserId && p.is_verified,
  );
}

/**
 * 認証済み政治家かどうかをチェック
 * ledger_user_id で Hub を検索し、認証済みの政治家（最初の 1 件）を返す
 */
export async function getVerifiedPoliticianByUserId(
  ledgerUserId: string,
): Promise<Politician | null> {
  const verified = await getVerifiedPoliticiansByUserId(ledgerUserId);
  return verified[0] ?? null;
}

// ============================================
// 政治家認証申請 API【v2 追加】
// ============================================

/**
 * 政治家認証申請を作成
 */
export async function createPoliticianVerification(
  data: CreatePoliticianVerificationInput,
): Promise<PoliticianVerification> {
  const result = await fetchApi<ApiResponse<PoliticianVerification>>(
    "/api/v1/politician-verifications",
    {
      method: "POST",
      body: JSON.stringify(data),
      userId: data.ledger_user_id,
    },
  );
  return result.data;
}

/**
 * ユーザーの政治家認証申請一覧を取得
 */
export async function getPoliticianVerificationsByUser(
  ledgerUserId: string,
): Promise<PoliticianVerification[]> {
  const result = await fetchApi<ApiResponse<PoliticianVerification[]>>(
    `/api/v1/politician-verifications/user/${ledgerUserId}`,
    { userId: ledgerUserId },
  );
  return result.data;
}

/**
 * メール認証コードを送信
 */
export async function sendPoliticianVerificationCode(
  verificationId: string,
  options: { userId?: string } = {},
): Promise<{ message: string; code?: string }> {
  const result = await fetchApi<{ message: string; code?: string }>(
    `/api/v1/politician-verifications/${verificationId}/send-verification`,
    {
      method: "POST",
      body: JSON.stringify({ ledger_user_id: options.userId }),
      userId: options.userId,
    },
  );
  return result;
}

/**
 * メール認証コードを検証
 */
export async function verifyPoliticianEmail(
  verificationId: string,
  code: string,
  options: { userId?: string } = {},
): Promise<{ message: string }> {
  const result = await fetchApi<{ message: string }>(
    `/api/v1/politician-verifications/${verificationId}/verify-email`,
    {
      method: "POST",
      body: JSON.stringify({ ledger_user_id: options.userId, code }),
      userId: options.userId,
    },
  );
  return result;
}

/**
 * DNS TXT認証を検証
 */
export async function verifyPoliticianDns(
  verificationId: string,
  options: { userId?: string } = {},
): Promise<{ message: string }> {
  const result = await fetchApi<{ message: string }>(
    `/api/v1/politician-verifications/${verificationId}/verify-dns`,
    {
      method: "POST",
      body: JSON.stringify({ ledger_user_id: options.userId }),
      userId: options.userId,
    },
  );
  return result;
}

// ============================================
// 政治団体管理者認証申請 API【v2 追加】
// ============================================

/**
 * 政治団体管理者認証申請を作成
 */
export async function createOrganizationManagerVerification(
  data: CreateOrganizationManagerVerificationInput,
): Promise<OrganizationManagerVerification> {
  const result = await fetchApi<ApiResponse<OrganizationManagerVerification>>(
    "/api/v1/organization-manager-verifications",
    {
      method: "POST",
      body: JSON.stringify(data),
      userId: data.ledger_user_id,
    },
  );
  return result.data;
}

/**
 * ユーザーの政治団体管理者認証申請一覧を取得
 */
export async function getOrganizationManagerVerificationsByUser(
  ledgerUserId: string,
): Promise<OrganizationManagerVerification[]> {
  const result = await fetchApi<ApiResponse<OrganizationManagerVerification[]>>(
    `/api/v1/organization-manager-verifications/user/${ledgerUserId}`,
    { userId: ledgerUserId },
  );
  return result.data;
}

/**
 * メール認証コードを送信
 */
export async function sendOrganizationManagerVerificationCode(
  verificationId: string,
  options: { userId?: string } = {},
): Promise<{ message: string; code?: string }> {
  const result = await fetchApi<{ message: string; code?: string }>(
    `/api/v1/organization-manager-verifications/${verificationId}/send-verification`,
    {
      method: "POST",
      body: JSON.stringify({ ledger_user_id: options.userId }),
      userId: options.userId,
    },
  );
  return result;
}

/**
 * メール認証コードを検証
 */
export async function verifyOrganizationManagerEmail(
  verificationId: string,
  code: string,
  options: { userId?: string } = {},
): Promise<{ message: string }> {
  const result = await fetchApi<{ message: string }>(
    `/api/v1/organization-manager-verifications/${verificationId}/verify-email`,
    {
      method: "POST",
      body: JSON.stringify({ ledger_user_id: options.userId, code }),
      userId: options.userId,
    },
  );
  return result;
}

/**
 * DNS TXT認証を検証
 */
export async function verifyOrganizationManagerDns(
  verificationId: string,
  options: { userId?: string } = {},
): Promise<{ message: string }> {
  const result = await fetchApi<{ message: string }>(
    `/api/v1/organization-manager-verifications/${verificationId}/verify-dns`,
    {
      method: "POST",
      body: JSON.stringify({ ledger_user_id: options.userId }),
      userId: options.userId,
    },
  );
  return result;
}

// ============================================
// 選挙登録リクエスト API
// ============================================

export interface CreateElectionRequestInput {
  name: string;
  type: string;
  area_description: string;
  election_date: string;
  requested_by_politician_id?: string;
  requested_by_email?: string;
  evidence_url?: string;
  notes?: string;
}

export async function createElectionRequest(
  data: CreateElectionRequestInput,
  options: { userId?: string } = {},
): Promise<ElectionRequest> {
  const result = await fetchApi<ApiResponse<ElectionRequest>>(
    "/api/v1/election-requests",
    {
      method: "POST",
      body: JSON.stringify(data),
      userId: options.userId,
    },
  );
  return result.data;
}

export async function getElectionRequests(params?: {
  politician_id?: string;
  status?: string;
}): Promise<ElectionRequest[]> {
  const searchParams = new URLSearchParams();
  if (params?.politician_id) {
    searchParams.set("politician_id", params.politician_id);
  }
  if (params?.status) searchParams.set("status", params.status);

  const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
  const result = await fetchApi<ApiResponse<ElectionRequest[]>>(
    `/api/v1/election-requests${query}`,
  );
  return result.data;
}

export async function getElectionRequest(id: string): Promise<ElectionRequest> {
  const result = await fetchApi<ApiResponse<ElectionRequest>>(
    `/api/v1/election-requests/${id}`,
  );
  return result.data;
}

// ============================================
// 政治団体登録リクエスト API
// ============================================

export interface CreateOrganizationRequestInput {
  name: string;
  type: string;
  registration_authority?: string;
  requested_by_politician_id?: string;
  requested_by_email?: string;
  evidence_type: string;
  /** 審査用の署名付き URL（期限あり） */
  evidence_file_url: string;
  /** Ledger Storage（evidence-files バケット）上のパス。URL の期限切れ後の再発行に使う */
  evidence_file_path: string;
  evidence_file_name?: string;
  notes?: string;
}

export async function createOrganizationRequest(
  data: CreateOrganizationRequestInput,
  options: { userId?: string } = {},
): Promise<OrganizationRequest> {
  const result = await fetchApi<ApiResponse<OrganizationRequest>>(
    "/api/v1/organization-requests",
    {
      method: "POST",
      body: JSON.stringify(data),
      userId: options.userId,
    },
  );
  return result.data;
}

export async function getOrganizationRequests(params?: {
  politician_id?: string;
  status?: string;
}): Promise<OrganizationRequest[]> {
  const searchParams = new URLSearchParams();
  if (params?.politician_id) {
    searchParams.set("politician_id", params.politician_id);
  }
  if (params?.status) searchParams.set("status", params.status);

  const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
  const result = await fetchApi<ApiResponse<OrganizationRequest[]>>(
    `/api/v1/organization-requests${query}`,
  );
  return result.data;
}

export async function getOrganizationRequest(
  id: string,
): Promise<OrganizationRequest> {
  const result = await fetchApi<ApiResponse<OrganizationRequest>>(
    `/api/v1/organization-requests/${id}`,
  );
  return result.data;
}

// ============================================
// 同期 API
// ============================================

/** Ledger から Hub に送信する関係者データ */
export interface SyncContactInput {
  /** Ledger 側の contacts.id — ユニーク識別子 */
  contact_source_id: string;
  /** Hub 側の public_ledgers.id */
  ledger_id: string;
  /** 関係者種別 */
  contact_type: string;
  /** 名前（非公開の場合は null） */
  name: string | null;
  /** 住所（非公開の場合は null） */
  address: string | null;
  /** 職業（非公開の場合は null） */
  occupation: string | null;
  /** 名前非公開フラグ */
  is_name_private: boolean;
  /** 住所非公開フラグ */
  is_address_private: boolean;
  /** 職業非公開フラグ */
  is_occupation_private: boolean;
  /** 非公開理由種別 */
  privacy_reason_type?: string | null;
  /** 非公開理由（その他） */
  privacy_reason_other?: string | null;
  /** 政治団体ID（法人の場合） */
  hub_organization_id?: string | null;
}

export interface SyncContactResult {
  /** Hub 側の public_contacts.id */
  hub_contact_id: string;
  /** Ledger 側の contacts.id */
  contact_source_id: string;
  /** 同期アクション */
  action: "created" | "updated" | "skipped";
}

export interface SyncContactsResponse {
  data: SyncContactResult[];
}

/**
 * 関係者データを Hub に同期
 *
 * contact_source_id（Ledger の contacts.id — UUID）をユニークキーとして
 * upsert する。同姓同名でも UUID で確実に区別される。
 *
 * @returns Ledger contact_id → Hub public_contacts.id のマッピング
 */
export async function syncContacts(
  contacts: SyncContactInput[],
  options: { userId?: string } = {},
): Promise<SyncContactsResponse> {
  const result = await fetchApi<SyncContactsResponse>(
    "/api/v1/sync/contacts",
    {
      method: "POST",
      body: JSON.stringify(contacts),
      userId: options.userId,
    },
  );
  return result;
}

/** Ledger から Hub に送信する同期データ */
export interface SyncJournalInput {
  /** Ledger 側の仕訳 ID */
  journal_source_id: string;
  /** Ledger 側の台帳 ID（Hub では ledger_source_id として使用） */
  ledger_source_id: string;
  /** 取引日 */
  date: string | null;
  /** 摘要（目的） */
  description: string | null;
  /** 金額 */
  amount: number;
  /** 関係者ID（public_contacts.id — Hub 側で参照） */
  contact_id: string | null;
  /** 勘定科目コード */
  account_code: string;
  /** 活動区分 (campaign / pre-campaign) */
  classification: string | null;
  /** 金銭以外の寄附の見積根拠 */
  non_monetary_basis: string | null;
  /** 備考 */
  note: string | null;
  /** 公費負担額 */
  public_expense_amount: number | null;
  /** コンテンツハッシュ（重複検知用） */
  content_hash: string;
  /** テストデータフラグ */
  is_test?: boolean;
}

export interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  error_details?: { journal_source_id: string; error: string }[];
}

export interface SyncStatus {
  status: "ready" | "error";
  message: string;
  stats?: {
    public_ledgers: number;
    public_journals: number;
  };
}

/** Hub に送信する台帳データ */
export interface SyncLedgerInput {
  /** Ledger 側の台帳 ID */
  ledger_source_id: string;
  /** 台帳種別 */
  ledger_type: "political_fund" | "election_fund";
  /**
   * 政治家×政治団体の中間テーブルID (Hub の politician_organizations.id)。political_fund で必須。
   * Ledger では ledgers.hub_politician_organization_id に保持する（lib/hub-ledger.ts）
   */
  politician_organization_id?: string;
  /**
   * 政治家×選挙の中間テーブルID (Hub の politician_elections.id)。election_fund で必須。
   * Ledger では ledgers.hub_politician_election_id に保持する（lib/hub-ledger.ts）
   */
  politician_election_id?: string;
  /** 会計年度 */
  fiscal_year: number;
  /** 収入合計 */
  total_income: number;
  /** 支出合計 */
  total_expense: number;
  /** 仕訳件数 */
  journal_count: number;
  /** テストデータフラグ */
  is_test?: boolean;
}

export interface SyncLedgerResult {
  data: Record<string, unknown>;
  action: "created" | "updated";
}

/**
 * 仕訳データを Hub に同期
 */
export async function syncJournals(
  journals: SyncJournalInput[],
  options: { userId?: string } = {},
): Promise<SyncResult> {
  const result = await fetchApi<ApiResponse<SyncResult>>(
    "/api/v1/sync/journals",
    {
      method: "POST",
      body: JSON.stringify({ journals }),
      userId: options.userId,
    },
  );
  return result.data;
}

/**
 * 台帳データを Hub に同期
 */
export async function syncLedger(
  ledger: SyncLedgerInput,
  options: { userId?: string } = {},
): Promise<SyncLedgerResult> {
  const result = await fetchApi<SyncLedgerResult>("/api/v1/sync/ledger", {
    method: "POST",
    body: JSON.stringify({ ledger }),
    userId: options.userId,
  });
  return result;
}

/**
 * 同期ステータスを確認
 */
export async function getSyncStatus(
  options: { userId?: string } = {},
): Promise<SyncStatus> {
  const result = await fetchApi<SyncStatus>("/api/v1/sync/status", {
    userId: options.userId,
  });
  return result;
}

/**
 * 変更ログを記録
 */
export async function recordChangeLog(
  data: {
    ledger_source_id: string;
    change_summary: string;
    change_details?: Record<string, unknown>;
  },
  options: { userId?: string } = {},
): Promise<void> {
  await fetchApi("/api/v1/sync/change-log", {
    method: "POST",
    body: JSON.stringify(data),
    userId: options.userId,
  });
}

// ============================================
// ロック解除リクエスト API
// ============================================

/** ロック解除リクエスト */
export interface UnlockRequest {
  id: string;
  ledger_id: string;
  ledger_type: "election" | "organization";
  fiscal_year: number | null;
  requested_by_user_id: string;
  requested_by_email: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  approved_at: string | null;
  unlock_expires_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

/** ロック解除リクエスト作成用入力 */
export interface CreateUnlockRequestInput {
  ledger_id: string;
  ledger_type: "election" | "organization";
  fiscal_year?: number;
  requested_by_user_id: string;
  requested_by_email: string;
  reason: string;
}

/** ロック解除状態確認結果 */
export interface UnlockCheckResult {
  is_unlocked: boolean;
  unlock_request?: UnlockRequest;
  expires_at?: string;
  pending_request?: {
    id: string;
    created_at: string;
    reason: string;
  } | null;
}

/**
 * ロック解除リクエストを作成
 */
export async function createUnlockRequest(
  data: CreateUnlockRequestInput,
  options: { userId?: string } = {},
): Promise<UnlockRequest> {
  const result = await fetchApi<ApiResponse<UnlockRequest>>(
    "/api/v1/unlock-requests",
    {
      method: "POST",
      body: JSON.stringify(data),
      userId: options.userId,
    },
  );
  return result.data;
}

/**
 * 台帳のロック解除状態を確認
 */
export async function checkUnlockStatus(
  ledgerId: string,
  options: { userId?: string } = {},
): Promise<UnlockCheckResult> {
  const result = await fetchApi<UnlockCheckResult>(
    `/api/v1/unlock-requests/check/${ledgerId}`,
    { userId: options.userId },
  );
  return result;
}

/**
 * ロック解除リクエスト一覧を取得
 */
export async function getUnlockRequests(
  params?: { ledger_id?: string; status?: string },
  options: { userId?: string } = {},
): Promise<UnlockRequest[]> {
  const searchParams = new URLSearchParams();
  if (params?.ledger_id) searchParams.set("ledger_id", params.ledger_id);
  if (params?.status) searchParams.set("status", params.status);

  const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
  const result = await fetchApi<ApiResponse<UnlockRequest[]>>(
    `/api/v1/unlock-requests${query}`,
    { userId: options.userId },
  );
  return result.data;
}
