import { useState } from "preact/hooks";
import YearClosureDialog from "./YearClosureDialog.tsx";

interface YearClosureStatus {
  fiscal_year: number;
  status: "open" | "closed" | "locked" | "temporary_unlock";
  closed_at?: string;
}

interface YearSelectorProps {
  organizationId: string;
  currentYear: number;
  years: number[];
  closureStatuses: YearClosureStatus[];
  onYearChange: (year: number) => void;
}

export default function YearSelector({
  organizationId,
  currentYear,
  years,
  closureStatuses,
  onYearChange,
}: YearSelectorProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const currentStatus = closureStatuses.find(
    (s) => s.fiscal_year === selectedYear,
  );
  const isClosed =
    currentStatus?.status === "closed" || currentStatus?.status === "locked";

  function handleYearChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    const year = parseInt(target.value, 10);
    setSelectedYear(year);
    onYearChange(year);
  }

  function handleClosureSuccess() {
    setShowDialog(false);
    // ページをリロードしてステータスを更新
    globalThis.location.reload();
  }

  return (
    <div class="flex items-center gap-4 mb-4">
      {/* 年度選択 */}
      <div class="flex items-center gap-2">
        <label class="font-medium">年度:</label>
        <select
          class="select select-bordered select-sm"
          value={selectedYear}
          onChange={handleYearChange}
        >
          {years.map((year) => {
            const status = closureStatuses.find((s) => s.fiscal_year === year);
            const label = status?.status === "closed" ? " (締め済)" : "";
            return (
              <option key={year} value={year}>
                {year}年度{label}
              </option>
            );
          })}
        </select>
      </div>

      {/* 締めステータス表示 */}
      {isClosed ? (
        <span class="badge badge-info">締め済み</span>
      ) : (
        <span class="badge badge-success">編集可能</span>
      )}

      {/* 年度締めボタン */}
      {!isClosed && (
        <button
          type="button"
          class="btn btn-sm btn-outline btn-warning"
          onClick={() => setShowDialog(true)}
        >
          年度締め
        </button>
      )}

      {/* 年度締めダイアログ */}
      {showDialog && (
        <YearClosureDialog
          organizationId={organizationId}
          year={selectedYear}
          onClose={() => setShowDialog(false)}
          onSuccess={handleClosureSuccess}
        />
      )}
    </div>
  );
}
