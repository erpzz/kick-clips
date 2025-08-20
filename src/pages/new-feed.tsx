// src/pages/new-feed.tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import type { NextPage } from 'next'
import Image from 'next/image'
import AuthButton from '@/components/AuthButton'
import ClipItem from '@/components/ClipItem'
import type { KickClip } from '@/types/kickTypes'
import styles from '@/styles/new-feed.module.css'
import { extractClipId } from '../../utils/kick'

/** Simple media-query hook (SSR-safe) */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 768px)')
    const onChange = (e: MediaQueryListEvent | MediaQueryList) => {
      // @ts-ignore - handle both event & object
      setIsMobile(('matches' in e ? e.matches : mq.matches) as boolean)
    }
    setIsMobile(mq.matches)
    if ('addEventListener' in mq) {
      mq.addEventListener('change', onChange as any)
      return () => mq.removeEventListener('change', onChange as any)
    } else {
      // Safari <14
      // @ts-ignore
      mq.addListener(onChange)
      return () => {
        // @ts-ignore
        mq.removeListener(onChange)
      }
    }
  }, [])
  return isMobile
}
function useNetworkInfo() {
  const [info, setInfo] = useState({ slow: false, saveData: false, type: 'unknown' as string })
  useEffect(() => {
    if (typeof navigator === 'undefined') return
    const c = (navigator as any).connection
    const saveData = !!c?.saveData
    const type = c?.effectiveType || 'unknown'
    const slow = saveData || type === 'slow-2g' || type === '2g'
    setInfo({ slow, saveData, type })

    if (!c?.addEventListener) return
    const onChange = () => {
      const t = c.effectiveType || 'unknown'
      const s = !!c.saveData || t === 'slow-2g' || t === '2g'
      setInfo({ slow: s, saveData: !!c.saveData, type: t })
    }
    c.addEventListener('change', onChange)
    return () => c.removeEventListener?.('change', onChange)
  }, [])
  return info
}
type FeedItem = KickClip

const NewFeedPage: NextPage = () => {
  const isMobile = useIsMobile()

  // data
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const pageRef = useRef(1)               // current page (ref to avoid StrictMode double-run)
  const endRef = useRef<HTMLDivElement | null>(null)
type MostClipped = {
  streamer: string
  clips_last_7d: number
  slug?: string
  profile_picture?: string
}
type TopClipRow = {
  id: string
  clip_url?: string
  title: string | null
  channel_username: string | null
  web_url: string | null
  view_count: number | null
  likes_count: number | null
  created_at: string | null
}

const [mostClipped, setMostClipped] = useState<MostClipped[] | null>(null)
const [topClips, setTopClips] = useState<TopClipRow[] | null>(null)

useEffect(() => {
  ;(async () => {
    try {
      const [a, b] = await Promise.all([
        fetch('/api/cards/most-clipped-streamers').then(r => r.json()),
        fetch('/api/cards/top-clips').then(r => r.json()),
      ])
      setMostClipped(a)
      setTopClips(b)
    } catch (e) {
      setMostClipped([])
      setTopClips([])
    }
  })()
}, [])

  // dev StrictMode guard (prevents double initial fetch)
  const didInit = useRef(false)
  // in-flight guard so IO can’t spam requests
  const inFlight = useRef(false)
  
  /** Fetch a specific page (uses guards; updates state) */
  const loadPage = async (page: number) => {
    if (inFlight.current || loading || !hasMore) return
    inFlight.current = true
    setLoading(true); setError(null)
    try {
      const r = await fetch(`/api/feed?page=${page}`)
      if (!r.ok) throw new Error(await r.text())
      const data = (await r.json()) as FeedItem[]
      setItems(prev => prev.concat(data))
      // if server returned fewer than a typical page, assume end
      if (data.length === 0) setHasMore(false)
      pageRef.current = page
    } catch (e: any) {
      setError(e?.message || 'Failed to load feed')
    } finally {
      setLoading(false)
      inFlight.current = false
    }
  }

  // initial load (guarded for StrictMode)
  useEffect(() => {
    if (didInit.current) return
    didInit.current = true
    loadPage(1)
  }, [])

  // stable IO that calls the latest loadMore
  const loadMoreRef = useRef(() => loadPage(pageRef.current + 1))
  useEffect(() => { loadMoreRef.current = () => loadPage(pageRef.current + 1) })

  useEffect(() => {
    if (!endRef.current) return
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMoreRef.current()
    }, { rootMargin: '1200px 0px' })
    io.observe(endRef.current)
    return () => io.disconnect()
  }, [])

  return (
    <div className={styles.kc}>
      <Head>
          <link rel="preconnect" href="https://*.supabase.co" crossOrigin="" />
          <link rel="preconnect" href="https://clips.kick.com" crossOrigin="" />
          <link rel="preconnect" href="https://files.kick.com" crossOrigin="" />
        <title>KickClips — New Feed</title>
        <meta name="color-scheme" content="dark" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* perf: preconnect to media hosts */}
        <link rel="preconnect" href="https://clips.kick.com" />
      </Head>

      {/* Header */}
      <header className={styles.kcHeader} role="banner">
        <div className={styles.kcHeaderInner}>
          <div className={styles.kcLogo}>
            <Image
              src="/KickClips Logo Transparent.png"
              alt="KickClips"
              width={200}
              height={40}
              className={styles.kcLogoImg}
              priority
            />
          </div>
          <div className={styles.kcCtrls}>
            <AuthButton />
            <button className={styles.kcGhostBtn} aria-label="Toggle theme">☼</button>
          </div>
        </div>
      </header>

      {/* Layout grid */}
      <main className={styles.kcShell} role="main">
        {/* LEFT SIDEBAR */}
        <aside className={`${styles.kcSidebar} ${styles.kcLeftRail}`}>
        <section className={styles.kcCard} aria-labelledby="top-clippers">
  <h2 id="top-clippers" className={styles.kcSectionTitle}>Most Clipped Streamers (7d)</h2>
  <ul className={styles.kcList}>
  {mostClipped?.map((u, i) => {
    const href = `https://kick.com/${u.slug ?? u.streamer}`
    return (
      <li key={u.streamer} className={styles.kcListRow}>
        <div className={styles.kcListLeft}>
          {/* avatar */}
          {u.profile_picture ? (
            <img
              src={u.profile_picture}
              alt={`${u.streamer} avatar`}
              height={22}
              width={22}
              style={{ borderRadius: '999px', objectFit: 'cover', marginRight: 8 }}
              loading="lazy"
            />
          ) : (
            <span
              aria-hidden
              style={{
                width: 28, height: 28, borderRadius: '999px',
                background: 'rgba(255,255,255,0.08)', marginRight: 8, display: 'inline-block'
              }}
            />
          )}

          {/* clickable name -> Kick channel */}
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.uClamp1}
            style={{ textDecoration: 'none' }}
            title={`Open ${u.streamer} on Kick`}
          >
            {u.streamer}
          </a>
        </div>

        <span className={styles.uBadge}>#{i + 1}</span>
      </li>
    )
  })}
</ul>
</section>
</aside>
        {/* FEED */}
        <section aria-label="Clip feed" className={styles.kcFeed}>
          {error && <div role="status" className={styles.kcState}>Failed to load: {error}</div>}
          {!error && items.length === 0 && !loading && (
            <div role="status" className={styles.kcState}>Attempting Internal Feed Refresh, Try again in 30 seconds.</div>
          )}

          {items.map((c) => (
            <div key={c.id} className={styles.kcClip}>
              {/* ClipItem renders media + body using your CSS hooks */}
              <ClipItem item={c} />
            </div>
          ))}

          <div ref={endRef} aria-hidden="true" />

          {loading && (
            <div className={`${styles.kcClip} ${styles.kcIsLoading}`} aria-hidden="true">
              <div className={`${styles.kcClipMedia} ${styles.kcSkel}`} />
              <div className={styles.kcClipBody} style={{ gap: 10 }}>
                <div className={styles.kcSkel} style={{ height: 18, width: '70%' }} />
                <div className={styles.kcSkel} style={{ height: 12, width: '45%' }} />
              </div>
            </div>
          )}

          {!loading && !hasMore && (
            <div className={styles.kcState}>Please refresh to get more content. Happy Scrolling! 😊</div>
          )}
        </section>

        {/* RIGHT SIDEBAR */}
        <aside className={`${styles.kcSidebar} ${styles.kcRightRail}`}>
        <section className={styles.kcCard} aria-labelledby="most-watched">
  <h2 id="most-watched" className={styles.kcSectionTitle}>Most Watched (7d)</h2>
  <ul className={styles.kcList}>
  <li className={styles.kcListRow}>
    This section is under construction.
  </li>
</ul>
</section>
</aside>
      </main>
    </div>
  )
}

export default NewFeedPage
