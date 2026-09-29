/*
 * SPDX-FileCopyrightText: 2026 Pagefault Games
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createTwoPlayerI18n } from "./2p-i18n.js";
import { listExistingProfiles } from "./player-profile.js";

const shellI18n = createTwoPlayerI18n();
const { t } = shellI18n;
shellI18n.applyStatic();

const profileList = document.getElementById("profile-list");
const noProfiles = document.getElementById("no-profiles");

function openGame(profileId) {
  localStorage.setItem("local2p/v1/shell/solo-language-scope/v1", profileId ? `profile:${profileId}` : "solo");
  const query = new URLSearchParams({ androidSolo: "1" });
  if (profileId) {
    query.set("profile", profileId);
  }
  window.location.replace("../index.html?" + query.toString());
}

for (const profile of listExistingProfiles(localStorage)) {
  const button = document.createElement("button");
  button.className = "profile-button";
  button.type = "button";
  button.setAttribute("aria-label", t("soloPlayWithProfile", { name: profile.displayName }));

  const avatar = document.createElement("span");
  avatar.className = "avatar";
  avatar.textContent = profile.avatar;

  const copy = document.createElement("span");
  copy.className = "profile-copy";
  const name = document.createElement("span");
  name.textContent = profile.displayName;
  const detail = document.createElement("small");
  detail.textContent = t("soloProfileProgress");
  copy.append(name, detail);

  button.append(avatar, copy);
  button.addEventListener("click", () => openGame(profile.id));
  profileList.append(button);
}

noProfiles.hidden = profileList.childElementCount > 0;
document.getElementById("solo-save").addEventListener("click", () => openGame());
