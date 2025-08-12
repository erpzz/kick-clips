// pages/index.tsx
import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import ClipItem from '@/components/ClipItem';
import type { KickClip } from '@/types/kickTypes';
import dynamic from 'next/dynamic';
import AuthButton from '@/components/AuthButton';

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
}
const SearchBar: React.FC<SearchBarProps> = ({ value, onChange }) => (
  <div className="relative w-full max-w-md mx-auto my-4">
    <input
      type="text"
      placeholder="Search by username…"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="
        w-full bg-gray-800 text-white placeholder-gray-500
        rounded-full px-4 py-2 border border-gray-600
        focus:outline-none focus:ring-2 focus:ring-[#39ff14] transition
      "
    />
  </div>
);

const UserListItem = ({ name, isLive }: { name: string; isLive: boolean }) => (
  <li className="flex justify-between items-center">
    <span>{name}</span>
    <span className={`block w-2.5 h-2.5 rounded-full ${isLive ? 'bg-[#39ff14]' : 'bg-gray-600'}`} />
  </li>
);

export default function Home() {
  const [page, setPage]           = useState(1);
  const [feedItems, setFeedItems] = useState<KickClip[]>([]);
  const [filtered,  setFiltered]  = useState<KickClip[]>([]);
  const [activeClip, setActive]   = useState<KickClip | null>(null);
  const [query, setQuery]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [error,   setError]       = useState<string | null>(null);

  /* ---------------- Fetch from /api/feed ---------------- */
  useEffect(() => {
    const abort = new AbortController();
    async function load() {
      setLoading(true); setError(null);
      try {
        const res = await fetch(`/api/feed?page=${page}`, { signal: abort.signal });
        if (!res.ok) throw new Error(res.statusText);
        const data: KickClip[] = await res.json();
        setFeedItems(prev => (page === 1 ? data : [...prev, ...data]));
      } catch (e: any) {
        if (!abort.signal.aborted) setError(e.message);
      } finally { if (!abort.signal.aborted) setLoading(false); }
    }
    load();
    return () => abort.abort();
  }, [page]);

  /* ---------------- Client-side search ---------------- */
  useEffect(() => {
    const q = query.trim().toLowerCase();
    setFiltered(
      !q
        ? feedItems
        : feedItems.filter(c => c.channel?.username.toLowerCase().includes(q))
    );
  }, [query, feedItems]);

  /* ---------------- Sample side data ---------------- */
  const recommendedUsers = [
    { name: 'Shoovy', isLive: true },
    { name: 'Ice Poseidon', isLive: true },
    { name: 'AdinRoss', isLive: true },
    { name: 'xQC', isLive: false },
  ];

  return (
    <div className="bg-gray-900 text-white min-h-screen font-sans">

      {/* Search bar at the top */}
      
      <div className="px-6 mt-4 flex justify-end">
        <AuthButton />
      </div>
      {/* 3-column grid: 14rem | auto | 14rem */}
      <div className="px-6 py-4 grid grid-cols-[14rem_1fr_14rem] gap-6">
        {/* LEFT SIDEBAR */}
        <aside className="sticky top-24">
          <h2 className="text-2xl font-semibold mb-4">Recommended</h2>
          <ul className="space-y-3">
            {recommendedUsers.map(u => <UserListItem key={u.name} {...u} />)}
          </ul>
        </aside>

        {/* CENTER – clip grid */}
        <main>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {error && <p className="col-span-full text-red-500">{error}</p>}
            {filtered.map(item => (
              <div key={item.id} onClick={() => setActive(item)} className="cursor-pointer">
                <ClipItem item={item} />
              </div>
            ))}
            {loading && <p className="col-span-full py-10 text-center">Loading…</p>}
          </div>

          {/* load more */}
          {!loading && !error && (
            <div className="mt-6 text-center">
              <button
                onClick={() => setPage(p => p + 1)}
                className="px-6 py-2 rounded bg-[#39ff14] text-gray-900 font-semibold disabled:opacity-50"
                disabled={loading}
              >
                Load More
              </button>
            </div>
          )}
        </main>

      </div>
    </div>
  );
}
