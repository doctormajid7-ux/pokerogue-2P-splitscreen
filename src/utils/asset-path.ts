/*
 * SPDX-FileCopyrightText: 2026 Pagefault Games
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * Joins an asset root, an optional folder and a file name into a relative path.
 *
 * The reason this exists as a function: a root-folder asset must not come out
 * as `images//logo.png`. Browsers and dev servers normalise that away, but not
 * every host does — Android's `AssetManager` refuses a path containing `//`,
 * and the sprite then silently falls back to Phaser's "missing texture" square.
 *
 * @param root - Asset directory, e.g. `images`
 * @param folder - Sub-directory, or `""` for an asset sitting at the root
 * @param filename - File name, extension included
 * @returns A path with no empty segment, e.g. `images/logo.png`
 */
export function assetPath(root: string, folder: string, filename: string): string {
  const directory = folder.replace(/\/+$/, "");
  return directory ? `${root}/${directory}/${filename}` : `${root}/${filename}`;
}
