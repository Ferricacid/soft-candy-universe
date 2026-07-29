import assert from "node:assert/strict";
import test from "node:test";

import {
  createCandyMembrane,
  heldPhysics,
  limitPointerReach,
  polygonArea,
  radialInfluence,
  reboundPhysics,
} from "../app/jelly-physics.ts";

test("builds an evenly sampled closed membrane with outward normals", () => {
  const membrane = createCandyMembrane(220, 116, 144);
  assert.equal(membrane.length, 144);
  assert.ok(polygonArea(membrane) > 80_000);

  const rightmost = membrane.reduce((best, point) => point.x > best.x ? point : best);
  assert.ok(rightmost.nx > 0.9);
  assert.ok(Math.abs(rightmost.ny) < 0.2);
});

test("centers the deformation field on the pointer rather than a ring index", () => {
  const localWidth = 116 * (38 / 27);
  const haloWidth = 116 * (70 / 27);
  const pointer = { x: -170, y: 0 };
  const near = radialInfluence({ x: -220, y: 0 }, pointer.x, pointer.y, 220, 116, localWidth, haloWidth);
  const far = radialInfluence({ x: 220, y: 0 }, pointer.x, pointer.y, 220, 116, localWidth, haloWidth);

  assert.ok(near.local > far.local * 8);
  assert.ok(near.local > near.halo);
  assert.ok(far.halo > far.local);
});

test("a centered press expands top and bottom while its broad halo contains the ends", () => {
  const localWidth = 116 * (38 / 27);
  const haloWidth = 116 * (70 / 27);
  const top = radialInfluence({ x: 0, y: -116 }, 0, 0, 220, 116, localWidth, haloWidth);
  const end = radialInfluence({ x: 220, y: 0 }, 0, 0, 220, 116, localWidth, haloWidth);

  assert.ok(top.local > 0.7);
  assert.ok(top.local > top.halo);
  assert.ok(end.halo > end.local);
});

test("keeps a distant drag attached while limiting only its maximum reach", () => {
  const nearby = limitPointerReach(200, 0, 220, 116, 1.65);
  assert.equal(nearby.x, 200);
  assert.equal(nearby.y, 0);
  assert.ok(nearby.stretch > 0);

  const distant = limitPointerReach(1000, 250, 220, 116, 1.65);
  const normalizedRadius = Math.hypot(distant.x / 220, distant.y / 116);
  assert.ok(Math.abs(normalizedRadius - 1.65) < 1e-10);
  assert.ok(distant.x > 0 && distant.y > 0);
  assert.equal(distant.stretch, 1);
});

test("makes the lowest rebound setting dramatically slower than the highest", () => {
  const slow = reboundPhysics(1);
  const fast = reboundPhysics(10);

  const settlingFrames = (physics) => {
    let pressure = 1;
    let velocity = -physics.releaseImpulse;
    let frames = 0;
    while (pressure > 0.05 && frames < 1200) {
      velocity -= pressure * physics.pressureSpring;
      velocity *= physics.pressureDamping;
      pressure += velocity;
      frames += 1;
    }
    return frames;
  };

  assert.equal(slow.pace, 0);
  assert.equal(fast.pace, 1);
  assert.ok(slow.membraneSpring < fast.membraneSpring / 100);
  assert.ok(slow.pressureSpring < fast.pressureSpring / 70);
  assert.ok(slow.releaseImpulse < fast.releaseImpulse / 8);
  assert.ok(slow.pressureDamping > fast.pressureDamping);
  assert.ok(settlingFrames(slow) > 300);
  assert.ok(settlingFrames(fast) < 60);
});

test("keeps press support stable instead of weakening it with rebound speed", () => {
  const held = heldPhysics();
  const slowRelease = reboundPhysics(1);

  assert.ok(held.membraneSpring > slowRelease.membraneSpring * 100);
  assert.ok(held.areaPressure > slowRelease.areaPressure * 70);
  assert.ok(held.pressureSpring > slowRelease.pressureSpring * 400);
  assert.equal(held.releaseImpulse, 0);
});
