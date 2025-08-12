// src/pages/index.tsx
import type { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: '/new-feed',
    // temporary in dev, permanent in prod (safe default)
    permanent: true,
  },
});

export default function Index() {
  return null;
}
