/** Dashboard status bar + pipeline panel numbers from repository.stats() */
export function buildPipelineStats(repoStats, { conversations = 0, viewings = 0 } = {}) {
  const active = repoStats.breakdown
    .filter((r) => r.status === 'active')
    .reduce((sum, r) => sum + r.count, 0);
  const expired = repoStats.breakdown
    .filter((r) => r.status === 'expired')
    .reduce((sum, r) => sum + r.count, 0);

  return {
    listingsMonitored: repoStats.total,
    activeListings: active,
    expiredListings: expired,
    withPhone: repoStats.withPhone,
    withEmail: repoStats.withEmail,
    matches: repoStats.withPhone,
    brokersTexted: conversations,
    viewingsScheduled: viewings,
    breakdown: repoStats.breakdown,
  };
}
