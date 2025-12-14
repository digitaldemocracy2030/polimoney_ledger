import { type PageProps } from "$fresh/server.ts";

export default function App({ Component }: PageProps) {
  return (
    <html lang="ja" data-theme="polimoney">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Polimoney Ledger</title>
        <link rel="stylesheet" href="/styles.css" />
        <script type="module" src="https://unpkg.com/cally"></script>
      </head>
      <body class="min-h-screen bg-base-200">
        <Component />
      </body>
    </html>
  );
}
