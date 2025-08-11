// components/ClipItem.tsx
import React, { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { format } from 'date-fns'
import type { KickClip } from '@/types/kickTypes'
import styles from '@/styles/new-feed.module.css'
import { extractClipId } from '../../utils/kick' // utils is outside src


const ReactPlayer = dynamic(() => import('react-player/lazy'), { ssr: false })

type Props = { item: KickClip }

export default function ClipItem({ item }: Props) {
  const avatarSrc = item.channel?.profile_picture || '/default-profile.png';
  const niceDate = format(new Date(item.created_at), 'MMM d yyyy')
  const [playing, setPlaying] = useState(false)
  const [thumbVisible, setThumbVisible] = useState(false)
  const mediaRef = useRef<HTMLDivElement>(null)
  const looksLikeFile = (u?: string | null) =>
  !!u && /\.(m3u8|mp4|webm)(\?|$)/i.test(u);
const clipId = extractClipId(
  (item as any).clip_id,
  (item as any).permalink,
  item.video_url,
  item.thumbnail_url,
  typeof item.id === 'string' ? item.id : undefined
);
const safePermalink =
  typeof (item as any).permalink === 'string' &&
  /(\/clips\/clip_[A-Za-z0-9]+)/.test((item as any).permalink)
    ? (item as any).permalink as string
    : null;


  // Build thumbnail URL (fallback to video if needed)
  const thumbUrl = item.thumbnail_url;
  const kickLink =
  safePermalink ||
  (item.channel?.username && clipId
    ? `https://kick.com/${item.channel.username.toLowerCase()}/clips/${clipId}`
    : null);
// NOTE: do NOT fall back to item.clip_url if looksLikeFile(item.clip_url)
  // Lazy-in when near viewport so lists scroll smoothly
  useEffect(() => {
    if (!mediaRef.current || thumbVisible) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setThumbVisible(true)
          io.disconnect()
        }
      },
      { rootMargin: '200px' }
    )
    io.observe(mediaRef.current)
    return () => io.disconnect()
  }, [thumbVisible])

  return (

    <>
      {/* MEDIA (16:9) — geometry/styling comes from .kcClipMedia in your CSS */}
      
      <div
        ref={mediaRef}
        className={styles.kcClipMedia}
        onClick={() => setPlaying(true)}
        role="button"
        aria-label="Play clip"
      >
        {!playing && thumbVisible && (
          <>
            <Image
              src={thumbUrl}
              alt={item.title || 'Clip thumbnail'}
              fill
              sizes="(max-width: 768px) 100vw, 800px"
            />
            <div className={styles.kcClipOverlay} aria-hidden />
            <span className={styles.kcClipTime}>
              {(item.view_count ?? 0).toLocaleString()} views
            </span>
          </>
        )}
        
        {!playing && !thumbVisible && (
          <div className={styles.kcSkel} style={{ position: 'absolute', inset: 0 }} />
        )}

        {playing && (
          <ReactPlayer
            url={item.video_url}
            playing
            controls
            width="100%"
            height="100%"
            style={{ position: 'absolute', top: 0, left: 0 }}
            config={{ file: { attributes: { playsInline: true } } }}
          />
        )}
      </div>

      {/* BODY */}
      <div className={styles.kcClipBody}>
        <h3 className={`${styles.kcClipTitle} ${styles.uClamp2}`} title={item.title || 'Untitled clip'}>
          {item.title || 'Untitled clip'}
        </h3>

        <div className={styles.kcClipMeta}>
           <Image
    src={avatarSrc}
    alt={`${item.channel?.username || 'Channel'} avatar`}
    width={36}
    height={36}
    className="rounded-full"
    style={{ objectFit: 'cover', flex: '0 0 auto' }}
    loading="lazy"
  />
          <span className={styles.uClamp1}>{item.channel?.username ?? 'Unknown'}</span>
          <span className={styles.kcDot} aria-hidden />
          <time dateTime={item.created_at}>{niceDate}</time>
          {item.is_mature ? <span className={styles.uBadge}>18+</span> : null}
        </div>
      </div>
    </>
  )
}
