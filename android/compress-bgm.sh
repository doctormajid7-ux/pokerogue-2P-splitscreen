#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Pagefault Games
# SPDX-License-Identifier: AGPL-3.0-only
#
# Replace BGM source MP3s above 32 kbit/s with 32 kbit/s copies.
# All replacements are encoded and checked before any source file is changed.
set -euo pipefail

BGM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../assets/audio/bgm" && pwd)"
FFMPEG_BIN="${FFMPEG:-ffmpeg}"
FFPROBE_BIN="${FFPROBE:-ffprobe}"

if ! command -v "$FFMPEG_BIN" >/dev/null 2>&1; then
    echo "ffmpeg est nécessaire (définissez FFMPEG si son exécutable n'est pas dans le PATH)." >&2
    exit 1
fi
if ! command -v "$FFPROBE_BIN" >/dev/null 2>&1; then
    echo "ffprobe est nécessaire (définissez FFPROBE si son exécutable n'est pas dans le PATH)." >&2
    exit 1
fi

ENCODERS="$("$FFMPEG_BIN" -hide_banner -encoders 2>&1)"
if [[ "$ENCODERS" != *libmp3lame* ]]; then
    echo "L'encodeur libmp3lame est nécessaire." >&2
    exit 1
fi

mapfile -d '' -t TRACKS < <(find "$BGM_DIR" -type f -iname '*.mp3' -print0 | sort -z)
if ((${#TRACKS[@]} == 0)); then
    echo "Aucun fichier MP3 trouvé dans $BGM_DIR" >&2
    exit 1
fi

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/pokerogue-bgm-32k.XXXXXX")"
trap 'rm -rf -- "$WORK_DIR"' EXIT
declare -a REPLACEMENTS=()
ENCODED=0
KEPT=0

for index in "${!TRACKS[@]}"; do
    source="${TRACKS[$index]}"
    bitrate="$("$FFPROBE_BIN" -v error -select_streams a:0 \
        -show_entries stream=bit_rate -of default=noprint_wrappers=1:nokey=1 "$source" 2>/dev/null || true)"

    if [[ "$bitrate" =~ ^[0-9]+$ ]] && ((bitrate <= 32000)); then
        REPLACEMENTS[$index]=""
        KEPT=$((KEPT + 1))
        continue
    fi

    relative_path="${source#"$BGM_DIR"/}"
    output="$WORK_DIR/$relative_path"
    mkdir -p -- "$(dirname "$output")"
    printf '[%d/%d] %s\n' "$((index + 1))" "${#TRACKS[@]}" "$relative_path"
    "$FFMPEG_BIN" -nostdin -hide_banner -loglevel error -y \
        -i "$source" -map 0:a:0 -map_metadata 0 \
        -codec:a libmp3lame -b:a 32k "$output"

    codec="$("$FFPROBE_BIN" -v error -select_streams a:0 \
        -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 "$output")"
    output_bitrate="$("$FFPROBE_BIN" -v error -select_streams a:0 \
        -show_entries stream=bit_rate -of default=noprint_wrappers=1:nokey=1 "$output")"
    if [[ ! -s "$output" || "$codec" != mp3 || "$output_bitrate" != 32000 ]]; then
        echo "Vérification échouée pour $relative_path (codec=$codec, débit=$output_bitrate)." >&2
        exit 1
    fi

    REPLACEMENTS[$index]="$output"
    ENCODED=$((ENCODED + 1))
done

# Les fichiers sources ne sont remplacés que lorsque tous les encodages sont prêts.
for index in "${!TRACKS[@]}"; do
    output="${REPLACEMENTS[$index]}"
    if [[ -z "$output" ]]; then
        continue
    fi
    source="${TRACKS[$index]}"
    staged="${source}.32k.tmp.$$"
    cp -- "$output" "$staged"
    chmod --reference="$source" "$staged"
    mv -f -- "$staged" "$source"
done

printf '\n%d piste(s) remplacée(s), %d déjà à 32 kbit/s ou moins.\n' "$ENCODED" "$KEPT"
du -sh "$BGM_DIR"
