const DECAY_PER_MIN   = 0.001;  // tune later
const TIER_BOOST_NEW  = 0.5;

export function calcTrendingScore(
  viewCount: number,
  createdAtISO: string,
  tier: 'new' | 'affiliate' | 'partner' | null = null
) {
  const ageMin   = (Date.now() - Date.parse(createdAtISO)) / 60000;
  const tierBump = tier === 'new' ? TIER_BOOST_NEW : 0;
  return Math.log10(viewCount + 1) - DECAY_PER_MIN * ageMin + tierBump;
}
