import {
  DEFAULT_MATCH_RULES,
  isMatchRules,
  MATCH_RULES_VERSION,
  matchSchedule,
  normalizeMatchRules,
} from "#system/match-rules";
import { describe, expect, it } from "vitest";

describe("match rules", () => {
  describe("isMatchRules", () => {
    it("should accept the default configuration", () => {
      expect(isMatchRules(DEFAULT_MATCH_RULES)).toBe(true);
    });

    it("should accept both modes and both level caps", () => {
      for (const mode of ["side-by-side", "blocks"] as const) {
        for (const levelCap of ["auto", "none"] as const) {
          expect(isMatchRules({ ...DEFAULT_MATCH_RULES, mode, levelCap })).toBe(true);
        }
      }
    });

    it("should reject an unknown version", () => {
      expect(isMatchRules({ ...DEFAULT_MATCH_RULES, version: MATCH_RULES_VERSION + 1 })).toBe(false);
      const withoutVersion: Record<string, unknown> = { ...DEFAULT_MATCH_RULES };
      delete withoutVersion.version;
      expect(isMatchRules(withoutVersion)).toBe(false);
    });

    it("should reject an out-of-range or non-integer number", () => {
      for (const blockSize of [1, 100, 9.5, Number.NaN, "10"]) {
        expect(isMatchRules({ ...DEFAULT_MATCH_RULES, blockSize })).toBe(false);
      }
      for (const blocks of [0, 21, Number.POSITIVE_INFINITY]) {
        expect(isMatchRules({ ...DEFAULT_MATCH_RULES, blocks })).toBe(false);
      }
      for (const bankRenforts of [-1, 4, 1.5]) {
        expect(isMatchRules({ ...DEFAULT_MATCH_RULES, bankRenforts })).toBe(false);
      }
    });

    it("should reject an unknown mode or level cap", () => {
      expect(isMatchRules({ ...DEFAULT_MATCH_RULES, mode: "arena" })).toBe(false);
      expect(isMatchRules({ ...DEFAULT_MATCH_RULES, levelCap: "fixed" })).toBe(false);
    });

    it("should reject a non-boolean duelOnDemand", () => {
      expect(isMatchRules({ ...DEFAULT_MATCH_RULES, duelOnDemand: "yes" })).toBe(false);
    });

    it("should reject anything that is not a rules object", () => {
      for (const payload of [null, undefined, "blocks", 42, ["blocks"]]) {
        expect(isMatchRules(payload)).toBe(false);
      }
    });
  });

  describe("matchSchedule", () => {
    it("should read the reference example as 27 AI battles and 3 duels", () => {
      const rules = normalizeMatchRules({ mode: "blocks", blockSize: 10, blocks: 3 });
      expect(matchSchedule(rules)).toEqual({
        pvePerBlock: 9,
        blocks: 3,
        pveBattles: 27,
        duels: 3,
        totalBattles: 30,
      });
    });

    it("should add one duel per extra round and keep the AI battles untouched", () => {
      const rules = normalizeMatchRules({ mode: "blocks", blockSize: 10, blocks: 3 });
      const schedule = matchSchedule(rules, 2);
      expect(schedule.duels).toBe(5);
      expect(schedule.pveBattles).toBe(27);
      expect(schedule.totalBattles).toBe(32);
    });

    it("should ignore an unusable extra round count", () => {
      const rules = normalizeMatchRules({ mode: "blocks", blockSize: 10, blocks: 3 });
      for (const extra of [Number.NaN, -3, 1.5, Number.POSITIVE_INFINITY]) {
        expect(matchSchedule(rules, extra).duels).toBe(3);
      }
    });

    it("should handle the smallest block", () => {
      const rules = normalizeMatchRules({ mode: "blocks", blockSize: 2, blocks: 1 });
      expect(matchSchedule(rules)).toEqual({
        pvePerBlock: 1,
        blocks: 1,
        pveBattles: 1,
        duels: 1,
        totalBattles: 2,
      });
    });

    it("should schedule nothing without a match", () => {
      expect(matchSchedule(DEFAULT_MATCH_RULES)).toEqual({
        pvePerBlock: 0,
        blocks: 0,
        pveBattles: 0,
        duels: 0,
        totalBattles: 0,
      });
    });
  });

  describe("normalizeMatchRules", () => {
    it("should fall back to the default configuration for junk", () => {
      for (const payload of [null, undefined, "blocks", 42, [], {}]) {
        expect(normalizeMatchRules(payload)).toEqual(DEFAULT_MATCH_RULES);
      }
    });

    it("should keep a valid configuration as is", () => {
      const rules = normalizeMatchRules({ ...DEFAULT_MATCH_RULES, mode: "blocks" });
      expect(rules).toEqual({ ...DEFAULT_MATCH_RULES, mode: "blocks" });
    });

    it("should bring numbers back inside their range", () => {
      const rules = normalizeMatchRules({ blockSize: 1000, blocks: -4, bankRenforts: 99 });
      expect(rules.blockSize).toBe(99);
      expect(rules.blocks).toBe(1);
      expect(rules.bankRenforts).toBe(3);
    });

    it("should keep the fallback for fields it cannot use", () => {
      const fallback = normalizeMatchRules({ mode: "blocks", blockSize: 20, blocks: 5, levelCap: "none" });
      const rules = normalizeMatchRules({ mode: "arena", blockSize: "20", levelCap: "fixed" }, fallback);
      expect(rules.mode).toBe("blocks");
      expect(rules.blockSize).toBe(20);
      expect(rules.levelCap).toBe("none");
      expect(rules.blocks).toBe(5);
    });

    it("should migrate the pre-blocks threshold to a block of threshold + 1 battles", () => {
      expect(normalizeMatchRules({ threshold: 5, updatedAt: 1 })).toEqual({
        ...DEFAULT_MATCH_RULES,
        mode: "blocks",
        blockSize: 6,
      });
    });

    it("should clamp a migrated threshold and ignore it once a block size exists", () => {
      expect(normalizeMatchRules({ threshold: 1 }).blockSize).toBe(2);
      expect(normalizeMatchRules({ threshold: 500 }).blockSize).toBe(99);
      const both = normalizeMatchRules({ threshold: 5, blockSize: 12 });
      expect(both.mode).toBe(DEFAULT_MATCH_RULES.mode);
      expect(both.blockSize).toBe(12);
    });

    it("should always produce a value isMatchRules accepts", () => {
      const payloads = [
        null,
        {},
        { blockSize: 0 },
        { blocks: 999, mode: "blocks" },
        { threshold: 5 },
        { threshold: Number.NaN },
        { blockSize: Number.POSITIVE_INFINITY, bankRenforts: -2, duelOnDemand: null },
        { ...DEFAULT_MATCH_RULES, version: 99 },
      ];
      for (const payload of payloads) {
        const rules = normalizeMatchRules(payload);
        expect(isMatchRules(rules)).toBe(true);
        expect(normalizeMatchRules(rules)).toEqual(rules);
      }
    });
  });
});
