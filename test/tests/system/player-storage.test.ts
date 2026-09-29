import {
  PLAYER_PARAM,
  PlayerStorage,
  PROFILE_PARAM,
  SCOPE_ROOT,
  scopeFromQuery,
  storageScopeFromQuery,
} from "#system/player-storage";
import { afterEach, describe, expect, it } from "vitest";

describe("PlayerStorage", () => {
  afterEach(() => {
    localStorage.clear();
  });

  describe("solo storage", () => {
    it("should keep the historical, unprefixed keys", () => {
      const storage = new PlayerStorage();

      storage.setItem("settings", "{}");

      expect(storage.prefix).toBe("");
      expect(localStorage.getItem("settings")).toBe("{}");
      expect(storage.getItem("settings")).toBe("{}");
    });

    it("should read saves written before this wrapper existed", () => {
      localStorage.setItem("data_Guest", "save");

      expect(new PlayerStorage().getItem("data_Guest")).toBe("save");
    });
  });

  describe("scoped storage", () => {
    it("should prefix every key with the versioned scope root", () => {
      const storage = new PlayerStorage("j1");

      storage.setItem("settings", "{}");

      expect(storage.prefix).toBe(`${SCOPE_ROOT}/j1/`);
      expect(localStorage.getItem(`${SCOPE_ROOT}/j1/settings`)).toBe("{}");
    });

    it("should isolate two players from each other", () => {
      const j1 = new PlayerStorage("j1");
      const j2 = new PlayerStorage("j2");

      j1.setItem("data_Guest", "player one");
      j2.setItem("data_Guest", "player two");

      expect(j1.getItem("data_Guest")).toBe("player one");
      expect(j2.getItem("data_Guest")).toBe("player two");
      expect(localStorage.getItem("data_Guest")).toBeNull();
    });

    it("should not let a player touch the solo keys", () => {
      localStorage.setItem("data_Guest", "solo save");
      const j1 = new PlayerStorage("j1");

      j1.removeItem("data_Guest");
      j1.clear();

      expect(localStorage.getItem("data_Guest")).toBe("solo save");
      expect(j1.hasItem("data_Guest")).toBe(false);
    });

    it("should only list the keys of its own scope, without the prefix", () => {
      const j1 = new PlayerStorage("j1");
      const j2 = new PlayerStorage("j2");
      localStorage.setItem("data_Guest", "solo save");

      j1.setItem("data_Guest", "one");
      j1.setItem("sessionData0_Guest", "one");
      j2.setItem("data_Guest", "two");

      expect(j1.keys().sort()).toEqual(["data_Guest", "sessionData0_Guest"]);
      expect(j2.keys()).toEqual(["data_Guest"]);
    });

    it("should clear its own scope only", () => {
      const j1 = new PlayerStorage("j1");
      const j2 = new PlayerStorage("j2");
      j1.setItem("settings", "one");
      j2.setItem("settings", "two");

      j1.clear();

      expect(j1.hasItem("settings")).toBe(false);
      expect(j2.getItem("settings")).toBe("two");
    });
  });

  describe("hasItem", () => {
    it("should distinguish an absent key from an empty one", () => {
      const storage = new PlayerStorage("j1");

      expect(storage.hasItem("settings")).toBe(false);

      storage.setItem("settings", "");

      expect(storage.hasItem("settings")).toBe(true);
    });
  });

  describe("scopeFromQuery", () => {
    it("should read the player id from the query string", () => {
      expect(scopeFromQuery(`?${PLAYER_PARAM}=j2`)).toBe("j2");
      expect(scopeFromQuery(`?foo=bar&${PLAYER_PARAM}=j1`)).toBe("j1");
    });

    it("should fall back to the solo storage without a usable id", () => {
      expect(scopeFromQuery("")).toBeUndefined();
      expect(scopeFromQuery("?player=")).toBeUndefined();
      expect(scopeFromQuery("?player=j1/../j2")).toBeUndefined();
      expect(scopeFromQuery(`?player=${"a".repeat(33)}`)).toBeUndefined();
    });
  });

  describe("storageScopeFromQuery", () => {
    it("should let solo load the same saved profile used by 2P", () => {
      expect(storageScopeFromQuery(`?${PROFILE_PARAM}=profile-42`)).toBe("profiles/profile-42");
      expect(storageScopeFromQuery(`?${PLAYER_PARAM}=j2&${PROFILE_PARAM}=profile-42`)).toBe("profiles/profile-42");
    });

    it("should keep legacy solo storage and player storage as fallbacks", () => {
      expect(storageScopeFromQuery("")).toBeUndefined();
      expect(storageScopeFromQuery(`?${PLAYER_PARAM}=j1&${PROFILE_PARAM}=invalid/profile`)).toBe("j1");
    });
  });
});
