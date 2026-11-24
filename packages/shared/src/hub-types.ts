/**
 * Polimoney Hub API の型定義
 *
 * apps/api の hub-client と apps/web の画面で共有する。
 */

export interface Election {
  id: string;
  name: string;
  type: string; // HR, HC, PG, CM, GM
  district_id: string | null;
  is_active: boolean;
  election_date: string;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  type: string; // political_party, support_group, fund_management, other
  // 詳細情報【v2.1 追加】
  official_url: string | null;
  registration_authority: string | null;
  established_date: string | null;
  office_address: string | null;
  representative_name: string | null;
  accountant_name: string | null;
  contact_email: string | null;
  description: string | null;
  // SNS【v2.1 追加】
  sns_x: string | null;
  sns_instagram: string | null;
  sns_facebook: string | null;
  sns_tiktok: string | null;
  // ロゴ【v2.2 追加】
  logo_url: string | null;
  // 認証情報【v2.1 追加】
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** 政治団体更新用入力【v2.1 追加, v2.2 logo_url追加】 */
export interface UpdateOrganizationInput {
  name?: string;
  type?: string;
  official_url?: string | null;
  registration_authority?: string | null;
  established_date?: string | null;
  office_address?: string | null;
  representative_name?: string | null;
  accountant_name?: string | null;
  contact_email?: string | null;
  description?: string | null;
  sns_x?: string | null;
  sns_instagram?: string | null;
  sns_facebook?: string | null;
  sns_tiktok?: string | null;
  logo_url?: string | null;
}

export interface Politician {
  id: string;
  name: string;
  name_kana: string | null;
  ledger_user_id: string | null;
  official_url: string | null;
  party: string | null;
  photo_url: string | null;
  // SNS
  sns_x: string | null;
  sns_instagram: string | null;
  sns_facebook: string | null;
  sns_tiktok: string | null;
  // 認証
  is_verified: boolean;
  verified_at: string | null;
  verified_domain: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// 政治家認証申請 API【v2 追加】
// ============================================

/** 立候補届出情報 */
export interface CandidateRegistrationInfo {
  election_name: string;
  district: string;
  candidate_name: string;
  registration_date: string;
}

/** 政治資金収支報告書情報 */
export interface PoliticalFundReportInfo {
  organization_name: string;
  representative_name: string;
  registration_authority: string;
}

export interface PoliticianVerification {
  id: string;
  ledger_user_id: string;
  /** 承認時に登録・更新された Hub の政治家 */
  approved_politician_id: string | null;
  politician_name: string;
  official_email: string;
  official_domain: string;
  official_url: string | null;
  party: string | null;
  status:
    | "pending"
    | "email_sent"
    | "email_verified"
    | "dns_verified"
    | "approved"
    | "rejected";
  request_type: string;
  previous_domain: string | null;
  verification_method: string;
  is_lg_domain: boolean;
  dns_txt_token: string | null;
  candidate_registration_info: CandidateRegistrationInfo | null;
  political_fund_report_info: PoliticalFundReportInfo | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePoliticianVerificationInput {
  ledger_user_id: string;
  ledger_user_email: string;
  name: string;
  official_email: string;
  official_url?: string;
  party?: string;
  /** 申請種別: new=新規, domain_change=ドメイン変更 */
  request_type?: "new" | "domain_change";
  /** ドメイン変更時の変更前ドメイン */
  previous_domain?: string;
  /** 立候補届出情報（どちらか必須） */
  candidate_registration_info?: CandidateRegistrationInfo;
  /** 政治資金収支報告書情報（どちらか必須） */
  political_fund_report_info?: PoliticalFundReportInfo;
}

// ============================================
// 政治団体管理者認証申請 API【v2 追加】
// ============================================

export interface OrganizationManagerVerification {
  id: string;
  ledger_user_id: string;
  organization_id: string | null;
  organization_name: string;
  official_email: string;
  official_domain: string;
  role_in_organization: string | null;
  status:
    | "pending"
    | "email_sent"
    | "email_verified"
    | "dns_verified"
    | "approved"
    | "rejected";
  request_type: string;
  previous_domain: string | null;
  verification_method: string;
  is_lg_domain: boolean;
  dns_txt_token: string | null;
  political_fund_report_info: PoliticalFundReportInfo | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateOrganizationManagerVerificationInput {
  ledger_user_id: string;
  ledger_user_email: string;
  organization_id?: string;
  organization_name: string;
  organization_type?: string;
  official_email: string;
  role_in_organization?: string;
  /** 申請種別: new=新規, domain_change=ドメイン変更 */
  request_type?: "new" | "domain_change";
  /** ドメイン変更時の変更前ドメイン */
  previous_domain?: string;
  /** 政治資金収支報告書情報（必須） */
  political_fund_report_info: PoliticalFundReportInfo;
}

export interface ElectionRequest {
  id: string;
  name: string;
  type: string;
  area_description: string;
  election_date: string;
  requested_by_politician_id: string | null;
  requested_by_email: string | null;
  evidence_url: string | null;
  notes: string | null;
  status: "pending" | "approved" | "rejected" | "needs_info";
  rejection_reason: string | null;
  approved_election_id: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export interface OrganizationRequest {
  id: string;
  name: string;
  type: string;
  registration_authority: string | null;
  requested_by_politician_id: string | null;
  requested_by_email: string | null;
  evidence_type: string;
  evidence_file_url: string;
  /** Ledger Storage 上の証明書類のパス（evidence_file_url の期限切れ後に再発行するため） */
  evidence_file_path?: string | null;
  evidence_file_name: string | null;
  notes: string | null;
  status: "pending" | "approved" | "rejected" | "needs_info";
  rejection_reason: string | null;
  approved_organization_id: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error?: string;
  /** Hub（FastAPI）のエラー。文字列、またはバリデーションエラーの配列 */
  detail?: string | unknown[];
}
