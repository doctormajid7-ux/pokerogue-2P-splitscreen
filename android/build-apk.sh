#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Pagefault Games
# SPDX-License-Identifier: AGPL-3.0-only
#
# Construit l'APK debug de la coque Android (lot A2).
#
# Usage : ./android/build-apk.sh [options Gradle...]
#   ex.  ./android/build-apk.sh assembleDebug
#        ./android/build-apk.sh installDebug   (appareil branché en USB)
set -euo pipefail
cd "$(dirname "$0")"

export ANDROID_HOME="${ANDROID_HOME:-$HOME/android-sdk}"
if [ ! -d "$ANDROID_HOME" ]; then
    echo "SDK Android introuvable (ANDROID_HOME=$ANDROID_HOME)" >&2
    exit 1
fi

# Gradle exige un vrai JDK (javac) : le `java` du système peut n'être qu'un
# JRE. Sans JAVA_HOME explicite, on dérive celui de `javac`.
if [ -z "${JAVA_HOME:-}" ]; then
    if command -v javac >/dev/null 2>&1; then
        JAVA_HOME="$(dirname "$(dirname "$(readlink -f "$(command -v javac)")")")"
        export JAVA_HOME
    else
        echo "Aucun JDK trouvé (javac absent) : installez un JDK 17+ ou définissez JAVA_HOME" >&2
        exit 1
    fi
fi

# local.properties est propre à la machine (gitignoré).
if [ ! -f local.properties ]; then
    echo "sdk.dir=$ANDROID_HOME" > local.properties
fi

# La tâche prepareWww refuse de construire sans dist/ ; échouer dès ici avec la
# commande à lancer est plus clair qu'une erreur Gradle au milieu de la fusion.
if [ ! -f ../dist/index.html ]; then
    echo "dist/ absent — construisez d'abord le build web :" >&2
    echo "    pnpm install --frozen-lockfile && pnpm build:app" >&2
    exit 1
fi

./gradlew :app:assembleDebug "$@"

APK=app/build/outputs/apk/debug/app-debug.apk
if [ -f "$APK" ]; then
    NAMED_APK=apks/PokeRogue-Android-2Players.apk
    mkdir -p apks
    cp "$APK" "$NAMED_APK"
    echo
    echo "APK : $(pwd)/$NAMED_APK"
    echo "Taille : $(du -h "$NAMED_APK" | cut -f1) ($(stat -c%s "$NAMED_APK") octets)"
fi
