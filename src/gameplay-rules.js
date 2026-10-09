const DEFAULT_ROUTE_RANGE = Object.freeze({ min: 1.2, max: 2.7, halfAngle: 0.9 });

/** A hit is suitable for the route only when its surface is close to level ground below the phone. */
export function isLevelGroundPose(matrix, cameraY, { maxTiltDegrees = 18, minDropMeters = 0.45 } = {}) {
  if (!matrix || matrix.length !== 16 || !Number.isFinite(cameraY)) return false;

  const values = Array.from(matrix, Number);
  if (values.some((value) => !Number.isFinite(value))) return false;

  const upAlignment = values[5];
  const floorY = values[13];
  const minimumAlignment = Math.cos((maxTiltDegrees * Math.PI) / 180);
  return upAlignment >= minimumAlignment && cameraY - floorY >= minDropMeters;
}

/** Return short, forward-facing stops for a single clear patch of ground. */
export function createSpawnSlots(count, range = DEFAULT_ROUTE_RANGE) {
  const slotCount = Math.max(0, Math.min(12, Math.trunc(Number(count) || 0)));
  if (!slotCount) return [];

  const minDistance = Math.max(0.6, Number(range.min) || DEFAULT_ROUTE_RANGE.min);
  const maxDistance = Math.max(minDistance, Number(range.max) || DEFAULT_ROUTE_RANGE.max);
  const halfAngle = Math.max(0.15, Math.min(1.25, Number(range.halfAngle) || DEFAULT_ROUTE_RANGE.halfAngle));

  return Array.from({ length: slotCount }, (_, index) => {
    const progress = slotCount === 1 ? 0.5 : index / (slotCount - 1);
    const side = slotCount === 1 ? 0 : progress * 2 - 1;
    const distance = minDistance + (maxDistance - minDistance) * progress;
    return {
      angle: side * halfAngle + (index % 2 === 0 ? -0.08 : 0.08),
      distance,
    };
  });
}

/** Measure a route stop along the ground plane, excluding the phone's height above it. */
export function horizontalDistance(from, to) {
  if (!from || !to) return Number.POSITIVE_INFINITY;
  const deltaX = Number(to.x) - Number(from.x);
  const deltaZ = Number(to.z) - Number(from.z);
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaZ)) return Number.POSITIVE_INFINITY;
  return Math.hypot(deltaX, deltaZ);
}

export function getQuestionTimeLimitSeconds(difficulty) {
  return ({ Easy: 30, Medium: 20, Hard: 16, Expert: 12 })[difficulty] || 20;
}

/** Move a compass needle partway toward a heading using the shortest turn across north. */
export function easeAngleDegrees(current, target, amount = 0.35) {
  const delta = ((target - current + 540) % 360) - 180;
  const eased = current + delta * Math.max(0, Math.min(1, amount));
  return ((eased + 180) % 360 + 360) % 360 - 180;
}
