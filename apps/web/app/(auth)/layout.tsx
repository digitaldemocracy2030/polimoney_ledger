import { Center } from '@mantine/core';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Center mih="100vh" bg="gray.0">
      {children}
    </Center>
  );
}
