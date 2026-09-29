import { DuelPark } from "#system/duel-park";
import { describe, expect, it, vi } from "vitest";

describe("duel park", () => {
  it("should not stop a game nothing announced", () => {
    const park = new DuelPark();
    expect(park.hold(vi.fn())).toBe(false);
    expect(park.isWaiting).toBe(false);
    expect(park.isArmed).toBe(false);
  });

  it("should stop at the next safe point once a boundary is announced", () => {
    const park = new DuelPark();
    park.arm();
    expect(park.isArmed).toBe(true);
    expect(park.isWaiting).toBe(false);

    const resume = vi.fn();
    expect(park.hold(resume)).toBe(true);
    expect(park.isWaiting).toBe(true);
    expect(resume).not.toHaveBeenCalled(); // rien ne reprend tant que le shell n'a pas libéré
  });

  it("should keep the first continuation when a stopped game is held twice", () => {
    const park = new DuelPark();
    park.arm();
    const first = vi.fn();
    const second = vi.fn();
    park.hold(first);
    park.hold(second);

    park.release()?.();
    expect(first).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();
  });

  it("should hand the continuation back on release, once", () => {
    const park = new DuelPark();
    park.arm();
    const resume = vi.fn();
    park.hold(resume);

    const released = park.release();
    expect(released).toBe(resume);
    expect(park.isWaiting).toBe(false);
    expect(park.isArmed).toBe(false);
    expect(park.release()).toBeNull(); // relâcher deux fois ne rejoue rien
  });

  it("should ignore a release when nothing was waiting", () => {
    const park = new DuelPark();
    park.arm();
    expect(park.release()).toBeNull();
    // Un tour ordinaire du jeu continue : la frontière annoncée est consommée.
    expect(park.hold(vi.fn())).toBe(false);
  });

  it("should stop again at the boundary of the next block", () => {
    const park = new DuelPark();
    park.arm();
    park.hold(vi.fn());
    park.release();

    park.arm();
    const second = vi.fn();
    expect(park.hold(second)).toBe(true);
    expect(park.release()).toBe(second);
  });

  it("should drop everything when the wait is abandoned", () => {
    const park = new DuelPark();
    park.arm();
    const resume = vi.fn();
    park.hold(resume);

    park.abandon();
    expect(park.isWaiting).toBe(false);
    expect(park.isArmed).toBe(false);
    expect(park.release()).toBeNull();
    expect(resume).not.toHaveBeenCalled();
  });
});
