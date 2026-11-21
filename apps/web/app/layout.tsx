import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import { ColorSchemeScript, MantineProvider } from '@mantine/core';

export const metadata = {
  title: 'Polimoney Ledger',
  description: '政治資金会計ソフト',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <ColorSchemeScript />
      </head>
      <body>
        <MantineProvider
          theme={{
            fontFamily: '"Noto Sans JP", sans-serif',
            primaryColor: 'blue',
          }}
        >
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
