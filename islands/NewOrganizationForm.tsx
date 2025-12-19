import { useState } from "preact/hooks";

interface Organization {
  id: string;
  name: string;
  type: string;
}

interface NewOrganizationFormProps {
  hubOrganizations: Organization[];
}

const ORGANIZATION_TYPES: Record<string, string> = {
  political_party: "政党",
  support_group: "後援会",
  fund_management: "資金管理団体",
  other: "その他の政治団体",
};

export default function NewOrganizationForm({
  hubOrganizations,
}: NewOrganizationFormProps) {
  const [mode, setMode] = useState<"select" | "create">("select");
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // フィルタリング
  const filteredOrganizations = hubOrganizations.filter((org) => {
    const matchesSearch = !searchQuery ||
      org.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || org.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      let name = organizationName;

      if (mode === "select") {
        if (!selectedOrgId) {
          setError("政治団体を選択してください");
          setIsSubmitting(false);
          return;
        }
        const selectedOrg = hubOrganizations.find(
          (o) => o.id === selectedOrgId,
        );
        if (!selectedOrg) {
          setError("選択された政治団体が見つかりません");
          setIsSubmitting(false);
          return;
        }
        name = selectedOrg.name;
      } else {
        if (!organizationName.trim()) {
          setError("政治団体名を入力してください");
          setIsSubmitting(false);
          return;
        }
      }

      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          hub_organization_id: mode === "select" ? selectedOrgId : undefined,
        }),
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || "政治団体台帳の作成に失敗しました");
      }

      const result = await response.json();
      // 作成した政治団体台帳ページにリダイレクト
      window.location.href = `/organizations/${result.organization_id}/ledger`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div class="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      {/* モード切替 */}
      <div class="tabs tabs-boxed mb-6">
        <button
          type="button"
          class={`tab ${mode === "select" ? "tab-active" : ""}`}
          onClick={() => setMode("select")}
        >
          登録済みの政治団体から選択
        </button>
        <button
          type="button"
          class={`tab ${mode === "create" ? "tab-active" : ""}`}
          onClick={() => setMode("create")}
        >
          新規に登録
        </button>
      </div>

      {mode === "select"
        ? (
          <>
            {/* 検索・フィルター */}
            <div class="flex flex-col md:flex-row gap-4 mb-4">
              <div class="form-control flex-1">
                <input
                  type="text"
                  placeholder="政治団体名で検索..."
                  class="input input-bordered"
                  value={searchQuery}
                  onInput={(e) =>
                    setSearchQuery((e.target as HTMLInputElement).value)}
                />
              </div>
              <div class="form-control">
                <select
                  class="select select-bordered"
                  value={typeFilter}
                  onChange={(e) =>
                    setTypeFilter((e.target as HTMLSelectElement).value)}
                >
                  <option value="all">すべての種別</option>
                  {Object.entries(ORGANIZATION_TYPES).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 政治団体一覧 */}
            <div class="max-h-96 overflow-y-auto border rounded-lg mb-6">
              {filteredOrganizations.length === 0
                ? (
                  <div class="p-8 text-center text-base-content/60">
                    該当する政治団体がありません
                  </div>
                )
                : (
                  filteredOrganizations.map((org) => (
                    <label
                      key={org.id}
                      class={`flex items-center gap-4 p-4 cursor-pointer hover:bg-base-200 border-b ${
                        selectedOrgId === org.id ? "bg-primary/10" : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="organization"
                        class="radio radio-primary"
                        checked={selectedOrgId === org.id}
                        onChange={() => setSelectedOrgId(org.id)}
                      />
                      <div class="flex-1">
                        <div class="font-medium">{org.name}</div>
                        <div class="flex gap-2 mt-1">
                          <span class="badge badge-sm badge-info">
                            {ORGANIZATION_TYPES[org.type] || org.type}
                          </span>
                        </div>
                      </div>
                    </label>
                  ))
                )}
            </div>

            {/* 見つからない場合 */}
            <div class="alert alert-warning mb-6">
              <span>
                該当する政治団体がない場合は、「新規に登録」タブから登録してください。
              </span>
            </div>
          </>
        )
        : (
          <>
            {/* 新規作成フォーム */}
            <div class="mb-6">
              <div class="form-control">
                <label class="label">
                  <span class="label-text">
                    政治団体名 <span class="text-error">*</span>
                  </span>
                </label>
                <input
                  type="text"
                  placeholder="例: 山田太郎後援会"
                  class="input input-bordered"
                  value={organizationName}
                  onInput={(e) =>
                    setOrganizationName((e.target as HTMLInputElement).value)}
                  required
                />
                <label class="label">
                  <span class="label-text-alt text-base-content/70">
                    正式名称で入力してください
                  </span>
                </label>
              </div>
            </div>

            {/* 注意事項 */}
            <div class="alert alert-info mb-6">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                class="stroke-current shrink-0 w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>
                新規作成した政治団体はまず台帳として登録されます。Hub
                への公式登録は別途申請が必要です。
              </span>
            </div>
          </>
        )}

      {/* 送信ボタン */}
      <div class="flex gap-4">
        <a href="/organizations" class="btn btn-outline">
          キャンセル
        </a>
        <button
          type="submit"
          class={`btn btn-primary flex-1 ${isSubmitting ? "loading" : ""}`}
          disabled={isSubmitting ||
            (mode === "select" && !selectedOrgId) ||
            (mode === "create" && !organizationName.trim())}
        >
          {isSubmitting ? "作成中..." : "政治団体台帳を作成"}
        </button>
      </div>
    </form>
  );
}
