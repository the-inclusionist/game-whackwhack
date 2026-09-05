// SPDX-License-Identifier: AGPL-3.0-or-later
// The camera. Keyboard only, bounded on both axes, and the bounds are what the tests are for.

import { describe, expect, it } from 'vitest';
import {
  NUDGE_PITCH, NUDGE_YAW, PITCH_DEFAULT, PITCH_SHALLOWEST, PITCH_STEEPEST, YAW_LIMIT,
  clampPitch, clampYaw, createCamera,
} from '../app/js/render/camera.ts';
import { CAMERA } from '../app/js/render/zdog-stage.ts';

describe('[Interface] it starts at the framing spike 0 measured', () => {
  it('opens square-on at the measured pitch', () => {
    const camera = createCamera();
    expect(camera.snapshot()).toEqual({ pitch: PITCH_DEFAULT, yaw: 0 });
  });

  it('agrees with the stage, so the first frame does not jump', () => {
    // Two copies of the same number in two files is how a camera ends up moving on frame one.
    expect(PITCH_DEFAULT).toBe(CAMERA.pitch);
  });
});

describe('[Boundary] the pitch cannot reach the angle that kills picking', () => {
  it('never goes shallower than the limit, however many nudges', () => {
    // ⚠️ At pitch 0 every tile projects to a LINE, `picking` rejects degenerate quads by design,
    // and the mat stops answering clicks with no error and nothing on screen to explain it. This
    // is the clamp that makes that state unreachable.
    const camera = createCamera();
    for (let i = 0; i < 200; i++) camera.nudge('up');
    expect(camera.snapshot().pitch).toBe(PITCH_SHALLOWEST);
    expect(camera.snapshot().pitch).toBeLessThan(0);
  });

  it('never goes steeper than straight down', () => {
    const camera = createCamera();
    for (let i = 0; i < 200; i++) camera.nudge('down');
    expect(camera.snapshot().pitch).toBe(PITCH_STEEPEST);
  });

  it('clamps whatever it is handed', () => {
    expect(clampPitch(0)).toBe(PITCH_SHALLOWEST);
    expect(clampPitch(5)).toBe(PITCH_SHALLOWEST);
    expect(clampPitch(-10)).toBe(PITCH_STEEPEST);
    expect(clampPitch(-1)).toBe(-1);
  });

  it('refuses a bad starting state instead of trusting it', () => {
    expect(createCamera({ pitch: 0, yaw: 0 }).snapshot().pitch).toBe(PITCH_SHALLOWEST);
    expect(createCamera({ pitch: -99, yaw: 0 }).snapshot().pitch).toBe(PITCH_STEEPEST);
  });
});

describe('[Boundary] the mat LEANS, it does not orbit', () => {
  // ⚠️ The divergence from the chess game, and the reason is the grid mirror: a player walks this
  // mat with the arrow keys in GRID space, so a quarter turn would leave "right" still meaning the
  // next column while the eye sees it move downwards.
  it('stops at the lean limit going left', () => {
    const camera = createCamera();
    for (let i = 0; i < 50; i++) camera.nudge('left');
    expect(camera.snapshot().yaw).toBeCloseTo(YAW_LIMIT, 10);
  });

  it('stops at the lean limit going right', () => {
    const camera = createCamera();
    for (let i = 0; i < 50; i++) camera.nudge('right');
    expect(camera.snapshot().yaw).toBeCloseTo(-YAW_LIMIT, 10);
  });

  it('never leans more than halfway to the angle where a row reads as a column', () => {
    // ⚠️ The first version of this said "well inside an eighth of a turn" and asserted exactly
    // that — while YAW_LIMIT IS an eighth. The claim was wrong, not the number, so here is the
    // threshold it should have been measured against.
    //
    // 45° is where a column and a row become equally plausible readings of the same edge; that is
    // the angle a lean must not approach. Half of it, 22.5°, is unmistakably the same mat seen
    // from slightly aside, and it is what three nudges reach.
    const AMBIGUOUS = Math.PI / 4;
    expect(YAW_LIMIT).toBeLessThanOrEqual(AMBIGUOUS / 2);
    expect(YAW_LIMIT).toBeGreaterThan(0);
  });

  it('does not wrap, because wrapping is orbiting', () => {
    expect(clampYaw(Math.PI)).toBe(YAW_LIMIT);
    expect(clampYaw(-Math.PI)).toBe(-YAW_LIMIT);
  });
});

describe('[Right] a nudge is a predictable size', () => {
  it('divides a quarter turn exactly, so a player can square the mat up', () => {
    expect((Math.PI / 2) / NUDGE_YAW).toBeCloseTo(12, 10);
  });

  it('reaches the lean limit in exactly three', () => {
    const camera = createCamera();
    camera.nudge('left');
    camera.nudge('left');
    expect(camera.snapshot().yaw).toBeCloseTo(NUDGE_YAW * 2, 10);
    camera.nudge('left');
    expect(camera.snapshot().yaw).toBeCloseTo(YAW_LIMIT, 10);
  });

  it('moves the pitch by one step', () => {
    const camera = createCamera();
    camera.nudge('up');
    expect(camera.snapshot().pitch).toBeCloseTo(PITCH_DEFAULT + NUDGE_PITCH, 10);
  });
});

describe('[Right] the directions name what the MAT does, not the camera', () => {
  it('leans opposite ways for left and right', () => {
    const left = createCamera();
    const right = createCamera();
    left.nudge('left');
    right.nudge('right');
    expect(left.snapshot().yaw).toBeCloseTo(-right.snapshot().yaw, 10);
    expect(left.snapshot().yaw).toBeGreaterThan(0);
  });

  it('tips opposite ways for up and down', () => {
    const up = createCamera();
    const down = createCamera();
    up.nudge('up');
    down.nudge('down');
    expect(up.snapshot().pitch).toBeGreaterThan(down.snapshot().pitch);
  });

  it('comes back to where it started', () => {
    // Two nudges that cancel must leave no residue: a control a player cannot undo exactly is one
    // they stop trusting.
    const camera = createCamera();
    camera.nudge('left');
    camera.nudge('right');
    expect(camera.snapshot().yaw).toBeCloseTo(0, 10);
    camera.nudge('up');
    camera.nudge('down');
    expect(camera.snapshot().pitch).toBeCloseTo(PITCH_DEFAULT, 10);
  });
});

describe('[Simple] reset puts the mat back square-on', () => {
  it('undoes any amount of leaning', () => {
    const camera = createCamera();
    for (let i = 0; i < 10; i++) { camera.nudge('left'); camera.nudge('up'); }
    expect(camera.reset()).toEqual({ pitch: PITCH_DEFAULT, yaw: 0 });
  });
});

describe('[Interface] there is no drag, and that is the point', () => {
  it('exposes no drag method at all', () => {
    // ⚠️ Not an omission. The pointer in this game is the HAMMER: the chess game's answer — hold a
    // second before a press becomes a rotation — would punish a child for pausing to look around
    // while their wave expires. Keyboard-only satisfies WCAG 2.5.7 outright rather than by
    // compensating for a gesture that should not exist here.
    expect('drag' in createCamera()).toBe(false);
  });

  it('offers every movement through the keyboard path', () => {
    const camera = createCamera();
    for (const direction of ['left', 'right', 'up', 'down'] as const) {
      expect(() => camera.nudge(direction)).not.toThrow();
    }
  });
});
