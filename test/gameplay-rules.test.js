import assert from 'node:assert/strict';
import test from 'node:test';

import { createSpawnSlots, easeAngleDegrees, horizontalDistance, isLevelGroundPose } from '../src/gameplay-rules.js';

function poseMatrix({ floorY = 0, upY = 1 } = {}) {
  const matrix = new Float32Array(16);
  matrix[0] = 1;
  matrix[5] = upY;
  matrix[10] = 1;
  matrix[13] = floorY;
  matrix[15] = 1;
  return matrix;
}

test('floor placement accepts level ground below the camera and rejects walls, tables, and malformed poses', () => {
  assert.equal(isLevelGroundPose(poseMatrix(), 1.4), true);
  assert.equal(isLevelGroundPose(poseMatrix({ floorY: 0.9 }), 1.2), false);
  assert.equal(isLevelGroundPose(poseMatrix({ upY: 0.7 }), 1.5), false);
  assert.equal(isLevelGroundPose(new Float32Array(8), 1.5), false);
  assert.equal(isLevelGroundPose(poseMatrix(), Number.NaN), false);
});

test('route stops stay inside a compact, forward-facing play area', () => {
  const stops = createSpawnSlots(6);

  assert.equal(stops.length, 6);
  assert.ok(stops.every(({ angle, distance }) => Number.isFinite(angle) && Math.abs(angle) <= 1));
  assert.ok(stops.every(({ distance }) => distance >= 1.2 && distance <= 2.7));
  assert.deepEqual(createSpawnSlots(0), []);
  assert.deepEqual(createSpawnSlots(-2), []);
});

test('ground distance ignores camera height', () => {
  assert.equal(horizontalDistance({ x: 0, y: 1.5, z: 0 }, { x: 3, y: 0, z: 4 }), 5);
  assert.equal(horizontalDistance({ x: 0, z: 0 }, { x: 0, z: 0 }), 0);
  assert.equal(horizontalDistance(null, { x: 0, z: 0 }), Number.POSITIVE_INFINITY);
});

test('compass easing takes the short turn across north', () => {
  const next = easeAngleDegrees(179, -179, 0.5);
  assert.equal(Math.abs(next), 180);
  assert.equal(easeAngleDegrees(10, 90, 1), 90);
  assert.equal(easeAngleDegrees(10, 90, 0), 10);
});
