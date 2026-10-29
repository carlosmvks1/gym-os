const COMPOUND_PATTERNS = new Set([
  "horizontal_push",
  "horizontal_pull",
  "vertical_pull",
  "squat",
  "hinge",
]);

export function recommendedRestSeconds(meta) {
  if (!meta) return 90;
  return COMPOUND_PATTERNS.has(meta.pattern) ? 120 : 90;
}

export function remainingRestSeconds({
  loggedAt,
  recommendedSeconds,
  nowMs = Date.now(),
}) {
  if (!loggedAt || !Number.isFinite(recommendedSeconds) || recommendedSeconds <= 0) {
    return 0;
  }

  const loggedMs = Date.parse(loggedAt);
  if (!Number.isFinite(loggedMs)) return 0;

  const elapsed = Math.max(0, Math.floor((nowMs - loggedMs) / 1000));
  return Math.max(0, recommendedSeconds - elapsed);
}

export function formatRest(seconds) {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}
