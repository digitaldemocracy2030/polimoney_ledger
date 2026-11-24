/**
 * 勘定科目マスタ定数
 *
 * ACCOUNT_CODES.md に基づく勘定科目の定義。
 * Hub DB に存在するマスタデータを、API レスポンス高速化のため
 * ソースコード内に定数として保持する。
 */

export interface AccountCode {
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense" | "subsidy";
  reportCategory: string;
  ledgerType: "organization" | "election" | "both";
}

/**
 * 勘定科目マスタマップ
 * key: 科目コード, value: 科目情報
 */
export const ACCOUNT_CODES: Record<string, AccountCode> = {
  // ============================================
  // 収入科目（政治団体用）
  // ============================================
  REV_MEMBERSHIP_FEE: {
    code: "REV_MEMBERSHIP_FEE",
    name: "党費・会費",
    type: "revenue",
    reportCategory: "党費・会費",
    ledgerType: "organization",
  },
  REV_DONATION_INDIVIDUAL: {
    code: "REV_DONATION_INDIVIDUAL",
    name: "個人からの寄附",
    type: "revenue",
    reportCategory: "寄附",
    ledgerType: "organization",
  },
  REV_DONATION_CORPORATE: {
    code: "REV_DONATION_CORPORATE",
    name: "法人その他の団体からの寄附",
    type: "revenue",
    reportCategory: "寄附",
    ledgerType: "organization",
  },
  REV_DONATION_POLITICAL: {
    code: "REV_DONATION_POLITICAL",
    name: "政治団体からの寄附",
    type: "revenue",
    reportCategory: "寄附",
    ledgerType: "organization",
  },
  REV_ANONYMOUS: {
    code: "REV_ANONYMOUS",
    name: "政党匿名寄附",
    type: "revenue",
    reportCategory: "寄附",
    ledgerType: "organization",
  },
  REV_MAGAZINE: {
    code: "REV_MAGAZINE",
    name: "機関紙誌の発行事業収入",
    type: "revenue",
    reportCategory: "事業収入",
    ledgerType: "organization",
  },
  REV_PARTY_EVENT: {
    code: "REV_PARTY_EVENT",
    name: "政治資金パーティー収入",
    type: "revenue",
    reportCategory: "事業収入",
    ledgerType: "organization",
  },
  REV_OTHER_BUSINESS: {
    code: "REV_OTHER_BUSINESS",
    name: "その他の事業収入",
    type: "revenue",
    reportCategory: "事業収入",
    ledgerType: "organization",
  },
  REV_GRANT_HQ: {
    code: "REV_GRANT_HQ",
    name: "本部・支部からの交付金",
    type: "revenue",
    reportCategory: "交付金",
    ledgerType: "organization",
  },
  REV_INTEREST: {
    code: "REV_INTEREST",
    name: "利子収入",
    type: "revenue",
    reportCategory: "その他の収入",
    ledgerType: "both",
  },
  REV_MISC: {
    code: "REV_MISC",
    name: "その他の収入",
    type: "revenue",
    reportCategory: "その他の収入",
    ledgerType: "organization",
  },

  // ============================================
  // 収入科目（選挙用）
  // ============================================
  REV_DONATION_INDIVIDUAL_ELEC: {
    code: "REV_DONATION_INDIVIDUAL_ELEC",
    name: "個人からの寄附",
    type: "revenue",
    reportCategory: "寄附",
    ledgerType: "election",
  },
  REV_DONATION_POLITICAL_ELEC: {
    code: "REV_DONATION_POLITICAL_ELEC",
    name: "政治団体からの寄附",
    type: "revenue",
    reportCategory: "寄附",
    ledgerType: "election",
  },
  REV_SELF_FINANCING: {
    code: "REV_SELF_FINANCING",
    name: "自己資金",
    type: "revenue",
    reportCategory: "その他の収入",
    ledgerType: "election",
  },
  REV_LOAN_ELEC: {
    code: "REV_LOAN_ELEC",
    name: "借入金",
    type: "revenue",
    reportCategory: "その他の収入",
    ledgerType: "election",
  },
  REV_MISC_ELEC: {
    code: "REV_MISC_ELEC",
    name: "その他の収入",
    type: "revenue",
    reportCategory: "その他の収入",
    ledgerType: "election",
  },

  // ============================================
  // 支出科目 - 経常経費（政治団体用）
  // ============================================
  EXP_PERSONNEL: {
    code: "EXP_PERSONNEL",
    name: "人件費",
    type: "expense",
    reportCategory: "経常経費",
    ledgerType: "organization",
  },
  EXP_UTILITIES: {
    code: "EXP_UTILITIES",
    name: "光熱水費",
    type: "expense",
    reportCategory: "経常経費",
    ledgerType: "organization",
  },
  EXP_SUPPLIES: {
    code: "EXP_SUPPLIES",
    name: "備品・消耗品費",
    type: "expense",
    reportCategory: "経常経費",
    ledgerType: "organization",
  },
  EXP_OFFICE: {
    code: "EXP_OFFICE",
    name: "事務所費",
    type: "expense",
    reportCategory: "経常経費",
    ledgerType: "organization",
  },

  // ============================================
  // 支出科目 - 政治活動費（政治団体用）
  // ============================================
  EXP_ORGANIZATION: {
    code: "EXP_ORGANIZATION",
    name: "組織活動費",
    type: "expense",
    reportCategory: "政治活動費",
    ledgerType: "organization",
  },
  EXP_ELECTION: {
    code: "EXP_ELECTION",
    name: "選挙関係費",
    type: "expense",
    reportCategory: "政治活動費",
    ledgerType: "organization",
  },
  EXP_MAGAZINE: {
    code: "EXP_MAGAZINE",
    name: "機関紙誌の発行事業費",
    type: "expense",
    reportCategory: "政治活動費",
    ledgerType: "organization",
  },
  EXP_PUBLICITY: {
    code: "EXP_PUBLICITY",
    name: "宣伝事業費",
    type: "expense",
    reportCategory: "政治活動費",
    ledgerType: "organization",
  },
  EXP_PARTY_EVENT: {
    code: "EXP_PARTY_EVENT",
    name: "政治資金パーティー開催事業費",
    type: "expense",
    reportCategory: "政治活動費",
    ledgerType: "organization",
  },
  EXP_OTHER_BUSINESS: {
    code: "EXP_OTHER_BUSINESS",
    name: "その他の事業費",
    type: "expense",
    reportCategory: "政治活動費",
    ledgerType: "organization",
  },
  EXP_RESEARCH: {
    code: "EXP_RESEARCH",
    name: "調査研究費",
    type: "expense",
    reportCategory: "政治活動費",
    ledgerType: "organization",
  },
  EXP_DONATION: {
    code: "EXP_DONATION",
    name: "寄附・交付金",
    type: "expense",
    reportCategory: "政治活動費",
    ledgerType: "organization",
  },
  EXP_MISC: {
    code: "EXP_MISC",
    name: "その他の経費",
    type: "expense",
    reportCategory: "政治活動費",
    ledgerType: "organization",
  },

  // ============================================
  // 支出科目 - 選挙運動費用（選挙用）
  // ============================================
  EXP_PERSONNEL_ELEC: {
    code: "EXP_PERSONNEL_ELEC",
    name: "人件費",
    type: "expense",
    reportCategory: "選挙運動費用",
    ledgerType: "election",
  },
  EXP_BUILDING_ELEC: {
    code: "EXP_BUILDING_ELEC",
    name: "家屋費",
    type: "expense",
    reportCategory: "選挙運動費用",
    ledgerType: "election",
  },
  EXP_BUILDING_ELEC_OFFICE: {
    code: "EXP_BUILDING_ELEC_OFFICE",
    name: "選挙事務所費",
    type: "expense",
    reportCategory: "選挙運動費用",
    ledgerType: "election",
  },
  EXP_BUILDING_ELEC_VENUE: {
    code: "EXP_BUILDING_ELEC_VENUE",
    name: "集合会場費等",
    type: "expense",
    reportCategory: "選挙運動費用",
    ledgerType: "election",
  },
  EXP_COMMUNICATION_ELEC: {
    code: "EXP_COMMUNICATION_ELEC",
    name: "通信費",
    type: "expense",
    reportCategory: "選挙運動費用",
    ledgerType: "election",
  },
  EXP_TRANSPORT_ELEC: {
    code: "EXP_TRANSPORT_ELEC",
    name: "交通費",
    type: "expense",
    reportCategory: "選挙運動費用",
    ledgerType: "election",
  },
  EXP_PRINTING_ELEC: {
    code: "EXP_PRINTING_ELEC",
    name: "印刷費",
    type: "expense",
    reportCategory: "選挙運動費用",
    ledgerType: "election",
  },
  EXP_ADVERTISING_ELEC: {
    code: "EXP_ADVERTISING_ELEC",
    name: "広告費",
    type: "expense",
    reportCategory: "選挙運動費用",
    ledgerType: "election",
  },
  EXP_STATIONERY_ELEC: {
    code: "EXP_STATIONERY_ELEC",
    name: "文具費",
    type: "expense",
    reportCategory: "選挙運動費用",
    ledgerType: "election",
  },
  EXP_FOOD_ELEC: {
    code: "EXP_FOOD_ELEC",
    name: "食料費",
    type: "expense",
    reportCategory: "選挙運動費用",
    ledgerType: "election",
  },
  EXP_LODGING_ELEC: {
    code: "EXP_LODGING_ELEC",
    name: "休泊費",
    type: "expense",
    reportCategory: "選挙運動費用",
    ledgerType: "election",
  },
  EXP_MISC_ELEC: {
    code: "EXP_MISC_ELEC",
    name: "雑費",
    type: "expense",
    reportCategory: "選挙運動費用",
    ledgerType: "election",
  },

  // ============================================
  // 公費負担（選挙用）
  // ============================================
  SUBSIDY_PUBLIC: {
    code: "SUBSIDY_PUBLIC",
    name: "公費負担",
    type: "subsidy",
    reportCategory: "公費負担",
    ledgerType: "election",
  },

  // ============================================
  // 資産科目（共通）
  // ============================================
  ASSET_CASH: {
    code: "ASSET_CASH",
    name: "現金",
    type: "asset",
    reportCategory: "資産",
    ledgerType: "both",
  },
  ASSET_BANK: {
    code: "ASSET_BANK",
    name: "普通預金",
    type: "asset",
    reportCategory: "資産",
    ledgerType: "both",
  },
  ASSET_SAVINGS: {
    code: "ASSET_SAVINGS",
    name: "定期預金",
    type: "asset",
    reportCategory: "資産",
    ledgerType: "both",
  },
  ASSET_PREPAID: {
    code: "ASSET_PREPAID",
    name: "前払金",
    type: "asset",
    reportCategory: "資産",
    ledgerType: "both",
  },
  ASSET_DEPOSIT: {
    code: "ASSET_DEPOSIT",
    name: "敷金・保証金",
    type: "asset",
    reportCategory: "資産",
    ledgerType: "both",
  },

  // ============================================
  // 負債科目（共通）
  // ============================================
  LIAB_LOAN: {
    code: "LIAB_LOAN",
    name: "借入金",
    type: "liability",
    reportCategory: "負債",
    ledgerType: "both",
  },
  LIAB_ACCOUNTS_PAYABLE: {
    code: "LIAB_ACCOUNTS_PAYABLE",
    name: "未払金",
    type: "liability",
    reportCategory: "負債",
    ledgerType: "both",
  },

  // ============================================
  // 純資産科目（共通）
  // ============================================
  EQUITY_CAPITAL: {
    code: "EQUITY_CAPITAL",
    name: "元入金",
    type: "equity",
    reportCategory: "純資産",
    ledgerType: "both",
  },
  EQUITY_CARRYOVER: {
    code: "EQUITY_CARRYOVER",
    name: "前年繰越額",
    type: "equity",
    reportCategory: "純資産",
    ledgerType: "both",
  },
};

/**
 * 科目コードから科目名を取得
 */
export function getAccountName(code: string): string {
  return ACCOUNT_CODES[code]?.name ?? code;
}

/**
 * 科目コードから報告書分類を取得
 */
export function getReportCategory(code: string): string {
  return ACCOUNT_CODES[code]?.reportCategory ?? "不明";
}

/**
 * 科目コードから勘定タイプを取得
 */
export function getAccountType(code: string): string {
  return ACCOUNT_CODES[code]?.type ?? "unknown";
}
