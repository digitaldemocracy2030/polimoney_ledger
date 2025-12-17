import { useEffect, useState } from "preact/hooks";

// ポリシーバージョン（更新時にインクリメント）
const CURRENT_POLICY_VERSION = "2025-01-01";
const STORAGE_KEY = "policy_acknowledged_version";

export default function PolicyBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // ローカルストレージから確認済みバージョンを取得
    const acknowledgedVersion = localStorage.getItem(STORAGE_KEY);

    // 現在のバージョンと比較して表示するか決定
    if (acknowledgedVersion !== CURRENT_POLICY_VERSION) {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    // 確認済みとして保存
    localStorage.setItem(STORAGE_KEY, CURRENT_POLICY_VERSION);
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div class="bg-info text-info-content px-4 py-3">
      <div class="flex items-center justify-between max-w-4xl mx-auto">
        <div class="flex items-center gap-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-5 h-5 flex-shrink-0"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
            />
          </svg>
          <p class="text-sm">
            プライバシーポリシーが更新されました。
            <a
              href="/privacy"
              class="underline font-medium hover:opacity-80 ml-1"
            >
              詳細を確認
            </a>
          </p>
        </div>
        <button
          onClick={handleDismiss}
          class="btn btn-ghost btn-sm btn-circle"
          aria-label="閉じる"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-5 h-5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M6 18 18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
