import { isDuelFighter as isEngineFighter } from "#system/duel-engine";
import { describe, expect, it } from "vitest";
// La coque 2P est du JavaScript autonome, chargé tel quel par la page coque :
// les tests l'importent directement, pour qu'il n'existe qu'une implémentation.
import { createTwoPlayerI18n, TWO_PLAYER_LANGUAGES } from "../../../android/shell/2p-i18n.js";
import { isSafeSpriteAtlasPath, isDuelFighter as isSessionFighter } from "../../../android/shell/duel-session.js";

const SHELL_LANGUAGE_KEY = "local2p/v1/shell/language/v1";
const SOLO_LANGUAGE_SCOPE_KEY = "local2p/v1/shell/solo-language-scope/v1";
const PROFILE_ROOT = "local2p/v1/profiles/";

interface ShellI18n {
  language: string;
  selection: string;
  t: (key: string, args?: Record<string, unknown>) => string;
  setLanguage: (next: string) => string;
}

// La signature réelle attend des `Storage`/`Navigator`/`Document` complets : les
// tests passent des vestes, sans dépendre du DOM ni du Web Storage du runtime.
const createI18n = createTwoPlayerI18n as unknown as (storage: unknown, nav: unknown, doc: unknown) => ShellI18n;

function makeStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  };
  return { storage, store };
}

function makeI18n(initial: Record<string, string> = {}, languages: string[] = ["en"]): ShellI18n {
  const { storage } = makeStorage(initial);
  return createI18n(
    storage,
    { languages, language: languages[0] },
    {
      documentElement: { lang: "" },
      querySelectorAll: () => [],
    },
  );
}

describe("two-player shell i18n", () => {
  it("follows the saved shared shell language", () => {
    const i18n = makeI18n({ [SHELL_LANGUAGE_KEY]: "de" });
    expect(i18n.selection).toBe("de");
    expect(i18n.language).toBe("de");
    expect(i18n.t("quit")).toBe("Beenden");
  });

  it("prefers the explicit shell language over the active solo profile language", () => {
    const i18n = makeI18n({
      [SHELL_LANGUAGE_KEY]: "de",
      [SOLO_LANGUAGE_SCOPE_KEY]: "profile:p1",
      [`${PROFILE_ROOT}p1/prLang`]: "ja",
    });
    expect(i18n.selection).toBe("de");
    expect(i18n.language).toBe("de");
  });

  it("follows the scoped solo profile language in automatic mode", () => {
    const i18n = makeI18n({
      [SHELL_LANGUAGE_KEY]: "auto",
      [SOLO_LANGUAGE_SCOPE_KEY]: "profile:p1",
      [`${PROFILE_ROOT}p1/prLang`]: "ja",
    });
    expect(i18n.selection).toBe("auto");
    expect(i18n.language).toBe("ja");
  });

  it("falls back to the unscoped solo language, then the phone language, then English", () => {
    expect(makeI18n({ prLang: "pt-BR" }).language).toBe("pt-BR");
    expect(makeI18n({}, ["fr-CA"]).language).toBe("fr");
    expect(makeI18n({}, ["zh-TW"]).language).toBe("zh-Hant");
    expect(makeI18n({}, ["xx-YY"]).language).toBe("en");
  });

  it("persists an explicit choice and forgets it for automatic mode", () => {
    const { storage, store } = makeStorage();
    const i18n = createI18n(
      storage,
      { languages: ["en"], language: "en" },
      {
        documentElement: { lang: "" },
        querySelectorAll: () => [],
      },
    );
    i18n.setLanguage("fr");
    expect(store.get(SHELL_LANGUAGE_KEY)).toBe("fr");
    expect(i18n.language).toBe("fr");
    i18n.setLanguage("auto");
    expect(store.has(SHELL_LANGUAGE_KEY)).toBe(false);
  });

  it("renders placeholders and leaves missing arguments visible", () => {
    const i18n = makeI18n();
    expect(i18n.t("dashboardBattleCount", { done: 1, total: 3 })).toBe("1/3 battles");
    expect(i18n.t("waitBoundary", {})).toBe("Boundary reached · waiting for {{player}}");
  });

  it("translates the duel-round dashboard label in every language", () => {
    for (const { code } of TWO_PLAYER_LANGUAGES) {
      const i18n = makeI18n({ [SHELL_LANGUAGE_KEY]: code });
      expect(i18n.t("dashboardDuelRound"), code).not.toBe("dashboardDuelRound");
      expect(i18n.t("dashboardPoints", { count: 1 }), code).not.toContain("{{");
    }
  });
});

/** Combattant minimal jouable par le moteur comme par la session. */
function fighterFixture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    side: "j1",
    species: 25,
    name: "Pika",
    level: 30,
    types: [13],
    stats: [100, 60, 50, 70, 60, 90],
    maxHp: 100,
    hp: 100,
    shiny: false,
    variant: 0,
    moves: [
      {
        moveId: 85,
        name: "Tonnerre",
        type: 13,
        category: 1,
        power: 90,
        accuracy: 100,
        priority: 0,
        pp: 15,
        ppMax: 15,
        effectiveness: 1,
      },
    ],
    ...overrides,
  };
}

describe("result-screen appearance validation", () => {
  it("accepts only sprite atlas paths that stay inside the images folder", () => {
    expect(isSafeSpriteAtlasPath("0001")).toBe(true);
    expect(isSafeSpriteAtlasPath("female/25")).toBe(true);
    expect(isSafeSpriteAtlasPath("variant/exp/shiny/0001_2")).toBe(true);
    expect(isSafeSpriteAtlasPath("trainer/trainer_m_back")).toBe(true);
    expect(isSafeSpriteAtlasPath("../private/image")).toBe(false);
    expect(isSafeSpriteAtlasPath("a b")).toBe(false);
    expect(isSafeSpriteAtlasPath("")).toBe(false);
    expect(isSafeSpriteAtlasPath("x".repeat(201))).toBe(false);
    expect(isSafeSpriteAtlasPath(42)).toBe(false);
    expect(isSafeSpriteAtlasPath(undefined)).toBe(false);
  });

  it("stays in step between the duel engine and the duel session", () => {
    const cases: [Record<string, unknown>, boolean][] = [
      [{}, true],
      [{ resultSpriteAtlasPath: "0001" }, true],
      [{ resultSpriteAtlasPath: "female/25" }, true],
      [{ resultSpriteAtlasPath: "variant/1006_2" }, true],
      [{ resultSpriteAtlasPath: "exp/0001" }, true],
      [{ resultSpriteAtlasPath: "variant/exp/shiny/0001_2" }, true],
      [{ trainerSkin: "m" }, true],
      [{ trainerSkin: "f" }, true],
      [{ resultSpriteAtlasPath: "0001", trainerSkin: "f" }, true],
      [{ resultSpriteAtlasPath: "../private/image" }, false],
      [{ resultSpriteAtlasPath: "a b" }, false],
      [{ resultSpriteAtlasPath: "" }, false],
      [{ resultSpriteAtlasPath: "x".repeat(201) }, false],
      [{ trainerSkin: "x" }, false],
    ];
    for (const [overrides, expected] of cases) {
      const fighter = fighterFixture(overrides);
      expect(isEngineFighter(fighter, "j1"), JSON.stringify(overrides)).toBe(expected);
      expect(isSessionFighter(fighter, "j1"), JSON.stringify(overrides)).toBe(expected);
    }
  });
});
