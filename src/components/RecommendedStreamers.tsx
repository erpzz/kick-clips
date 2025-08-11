// components/RecommendedStreamers.tsx
import React, { useMemo } from 'react'
import type { KickClip } from '@/types/kickTypes'
import { getRecommendedStreamers } from '@/lib/streamerUtils'

interface Props {
  clips: KickClip[]
  days?: number
  maxItems?: number
}

export function RecommendedStreamers({
  clips,
  days = 3,
  maxItems = 5,
}: Props) {
  const recs = useMemo(
    () => getRecommendedStreamers(clips, days, maxItems),
    [clips, days, maxItems]
  )

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-lg font-medium mb-2">Recommended Streamers</h3>
      {recs.length ? (
        <ul className="space-y-1">
          {recs.map(u => (
            <li key={u}>
              <a
                href={`https://kick.com/${u}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {u}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">No activity in the last {days} days.</p>
      )}
    </div>
  )
}
