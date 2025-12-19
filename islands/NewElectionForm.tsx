import { useState } from "preact/hooks";

interface Election {
  id: string;
  name: string;
  type: string;
  election_date: string;
}

interface Politician {
  id: string;
  name: string;
  name_kana: string | null;
}

interface NewElectionFormProps {
  hubElections: Election[];
}

const ELECTION_TYPES: Record<string, string> = {
  HR: "衆議院議員選挙",
  HC: "参議院議員選挙",
  PG: "都道府県知事選挙",
  PA: "都道府県議会選挙",
  GM: "市区町村長選挙",
  CM: "市区町村議会選挙",
};

// 年ごとにグループ化
function groupByYear(elections: Election[]): Record<string, Election[]> {
  return elections.reduce((acc, election) => {
    const year = new Date(election.election_date).getFullYear().toString();
    if (!acc[year]) {
      acc[year] = [];
    }
    acc[year].push(election);
    return acc;
  }, {} as Record<string, Election[]>);
}

export default function NewElectionForm({
  hubElections,
}: NewElectionFormProps) {
  const [selectedElectionId, setSelectedElectionId] = useState<string | null>(
    null,
  );
  const [politicianId, setPoliticianId] = useState("");
  const [verifiedPolitician, setVerifiedPolitician] = useState<Politician | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [politicianError, setPoliticianError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const groupedByYear = groupByYear(hubElections);
  const years = Object.keys(groupedByYear).sort(
    (a, b) => Number(b) - Number(a),
  );

  // フィルタリング
  const filteredElections = hubElections.filter((election) => {
    const matchesSearch = searchQuery === "" ||
      election.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || election.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const filteredGroupedByYear = groupByYear(filteredElections);

  // 政治家IDを検証
  const handleVerifyPolitician = async () => {
    if (!politicianId.trim()) {
      setPoliticianError("政治家IDを入力してください");
      return;
    }

    setIsVerifying(true);
    setPoliticianError(null);
    setVerifiedPolitician(null);

    try {
      const response = await fetch(`/api/politicians/${politicianId.trim()}`);

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || "政治家の検証に失敗しました");
      }

      const { data } = await response.json();
      setVerifiedPolitician(data);
    } catch (err) {
      setPoliticianError(
        err instanceof Error ? err.message : "政治家IDが見つかりません"
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();

    if (!selectedElectionId) {
      setError("選挙を選択してください");
      return;
    }

    if (!verifiedPolitician) {
      setError("政治家IDを検証してください");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const selectedElection = hubElections.find(
        (e) => e.id === selectedElectionId,
      );

      const response = await fetch("/api/elections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hub_election_id: selectedElectionId,
          election_name: selectedElection?.name,
          election_date: selectedElection?.election_date,
          hub_politician_id: verifiedPolitician.id,
          politician_name: verifiedPolitician.name,
        }),
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || "選挙台帳の作成に失敗しました");
      }

      const result = await response.json();
      // 作成した選挙台帳ページにリダイレクト
      window.location.href = `/elections/${result.election_id}/ledger`;
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

      {/* Step 1: 選挙を選択 */}
      <div class="mb-6">
        <h3 class="font-bold text-lg mb-4">1. 選挙を選択</h3>

        {/* 検索・フィルター */}
        <div class="flex flex-col md:flex-row gap-4 mb-4">
          <div class="form-control flex-1">
            <label class="label">
              <span class="label-text">🔍 検索</span>
            </label>
            <input
              type="text"
              placeholder="選挙名で検索..."
              class="input input-bordered"
              value={searchQuery}
              onInput={(e) =>
                setSearchQuery((e.target as HTMLInputElement).value)}
            />
          </div>
          <div class="form-control">
            <label class="label">
              <span class="label-text">種別</span>
            </label>
            <select
              class="select select-bordered"
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter((e.target as HTMLSelectElement).value)}
            >
              <option value="all">すべて</option>
              {Object.entries(ELECTION_TYPES).map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 選挙一覧 */}
        <div class="max-h-96 overflow-y-auto border rounded-lg">
          {filteredElections.length === 0
            ? (
              <div class="p-8 text-center text-base-content/70">
                該当する選挙が見つかりません
              </div>
            )
            : (
              Object.keys(filteredGroupedByYear)
                .sort((a, b) => Number(b) - Number(a))
                .map((year) => (
                  <div key={year}>
                    <div class="sticky top-0 bg-base-200 px-4 py-2 font-bold border-b">
                      📅 {year}年
                    </div>
                    {filteredGroupedByYear[year].map((election) => (
                      <label
                        key={election.id}
                        class={`flex items-center gap-4 p-4 cursor-pointer hover:bg-base-200 border-b ${
                          selectedElectionId === election.id
                            ? "bg-primary/10"
                            : ""
                        }`}
                      >
                        <input
                          type="radio"
                          name="election"
                          class="radio radio-primary"
                          checked={selectedElectionId === election.id}
                          onChange={() => setSelectedElectionId(election.id)}
                        />
                        <div class="flex-1">
                          <div class="font-medium">{election.name}</div>
                          <div class="flex gap-2 mt-1">
                            <span class="badge badge-sm badge-info">
                              {ELECTION_TYPES[election.type] || election.type}
                            </span>
                            <span class="text-xs text-base-content/70">
                              {new Date(
                                election.election_date,
                              ).toLocaleDateString("ja-JP")}
                            </span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                ))
            )}
        </div>

        {/* 選挙が見つからない場合 */}
        <div class="alert alert-warning mt-4">
          <span>
            該当する選挙がない場合は、
            <a href="/elections/request" class="link link-primary">
              登録をリクエスト
            </a>
            してください。
          </span>
        </div>
      </div>

      {/* Step 2: 政治家IDを入力 */}
      <div class="mb-6">
        <h3 class="font-bold text-lg mb-4">2. 政治家を選択</h3>
        <div class="form-control">
          <label class="label">
            <span class="label-text">
              政治家ID <span class="text-error">*</span>
            </span>
          </label>
          <div class="flex gap-2">
            <input
              type="text"
              placeholder="例: 00000000-0000-0000-0000-000000000000"
              class={`input input-bordered flex-1 ${
                politicianError ? "input-error" : ""
              }`}
              value={politicianId}
              onInput={(e) => {
                setPoliticianId((e.target as HTMLInputElement).value);
                setVerifiedPolitician(null);
                setPoliticianError(null);
              }}
            />
            <button
              type="button"
              class={`btn ${verifiedPolitician ? "btn-success" : "btn-primary"}`}
              onClick={handleVerifyPolitician}
              disabled={isVerifying || !politicianId.trim()}
            >
              {isVerifying && (
                <span class="loading loading-spinner loading-sm" />
              )}
              {verifiedPolitician ? "✓ 検証済み" : "検証"}
            </button>
          </div>
          {politicianError && (
            <label class="label">
              <span class="label-text-alt text-error">{politicianError}</span>
            </label>
          )}
          <label class="label">
            <span class="label-text-alt text-base-content/70">
              Hubに登録されている政治家のIDを入力し、検証ボタンをクリックしてください
            </span>
          </label>
        </div>

        {/* 検証済みの政治家情報を表示 */}
        {verifiedPolitician && (
          <div class="alert alert-success mt-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="stroke-current shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p class="font-bold">{verifiedPolitician.name}</p>
              {verifiedPolitician.name_kana && (
                <p class="text-sm">{verifiedPolitician.name_kana}</p>
              )}
            </div>
          </div>
        )}

        {/* 政治家が登録されていない場合の案内 */}
        <div class="alert alert-info mt-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            class="stroke-current shrink-0 w-6 h-6"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>
            政治家がHubに登録されていない場合は、先にHubで登録を行ってください。
          </span>
        </div>
      </div>

      {/* 送信ボタン */}
      <div class="flex gap-4">
        <a href="/elections" class="btn btn-outline">
          キャンセル
        </a>
        <button
          type="submit"
          class={`btn btn-primary flex-1 ${isSubmitting ? "loading" : ""}`}
          disabled={isSubmitting || !selectedElectionId || !verifiedPolitician}
        >
          {isSubmitting ? "作成中..." : "選挙台帳を作成"}
        </button>
      </div>
    </form>
  );
}
