// src/pages/_app.tsx
import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import type { Session } from 'next-auth';
import { SessionProvider } from 'next-auth/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

export default function MyApp({
  Component,
  pageProps,
}: AppProps<{ session: Session | null }>) {
  return (
    <SessionProvider
      session={pageProps.session}
      refetchOnWindowFocus={false}  // stop refetching on tab focus
      refetchInterval={0}           // disable background polling
    >
      <QueryClientProvider client={queryClient}>
        <Component {...pageProps} />
      </QueryClientProvider>
    </SessionProvider>
  );
}
