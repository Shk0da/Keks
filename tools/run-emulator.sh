#!/bin/bash
#
# tools/run-emulator.sh — прогон KEKS в Android-эмуляторе (Windows, headless).
#
#   ./tools/run-emulator.sh [--screenshot N]  # boot → установка → N скриншотов
#   ./tools/run-emulator.sh --stop            # остановить эмулятор
#
# SDK/эмулятор переиспользуются от соседнего проекта ../239 (tools/android-sdk),
# при его отсутствии — скачиваются в tools/android-sdk.
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SDK="$ROOT/tools/android-sdk"
[ -d "$SDK/emulator" ] || SDK="C:/Projects/239/tools/android-sdk"
AVDHOME="$SDK/../../239/tools/android-avd"
[ -d "$AVDHOME" ] || AVDHOME="C:/Projects/239/tools/android-avd"
# если 239 нет рядом — свой AVD-каталог
if [ ! -d "$AVDHOME" ]; then AVDHOME="$ROOT/tools/android-avd"; fi
EMU="$SDK/emulator/emulator.exe"
ADB="$SDK/platform-tools/adb.exe"
AVD_NAME="t239"
PKG="com.keks.game"

MODE="screenshot"
NSHOT=1
case "${1:-}" in
    --stop) MODE="stop" ;;
    --run) MODE="run" ;;
    --screenshot) MODE="screenshot"; NSHOT="${2:-1}" ;;
esac

if [ "$MODE" = "stop" ]; then
    "$ADB" -s emulator-5554 emu kill > /dev/null 2>&1 || true
    echo "OK: эмулятор остановлен (если был)"
    exit 0
fi

export ANDROID_AVD_HOME="$(cygpath -m "$AVDHOME")"
export ANDROID_SDK_ROOT="$(cygpath -m "$SDK")"

if ! "$ADB" get-state > /dev/null 2>&1 || [ -z "$("$ADB" devices | grep -w emulator-5554 || true)" ]; then
    echo "==> Запускаю эмулятор (headless)..."
    "$EMU" -avd "$AVD_NAME" -no-window -no-audio -no-boot-anim \
        -gpu swiftshader_indirect -no-snapshot > /tmp/keks_emulator.log 2>&1 &
    trap '[ "$MODE" = screenshot ] || kill %1 2>/dev/null || true' EXIT
fi

"$ADB" wait-for-device
echo "==> Жду полной загрузки..."
BOOT=""
for i in $(seq 1 150); do
    BOOT=$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)
    [ "$BOOT" = "1" ] && break
    sleep 2
done
if [ "${BOOT:-}" != "1" ]; then
    echo "ОШИБКА: эмулятор не загрузился — смотри /tmp/keks_emulator.log" >&2
    exit 1
fi
echo "==> Загрузился. Ставлю dist/keks.apk..."
"$ADB" install -r "$ROOT/dist/keks.apk"

# офлайн-проверка: сеть выключена до старта
"$ADB" shell svc wifi disable > /dev/null 2>&1 || true
"$ADB" shell svc data disable > /dev/null 2>&1 || true

"$ADB" logcat -c
"$ADB" shell am start -n "$PKG/.MainActivity" > /dev/null
sleep 8

CRASH=$("$ADB" logcat -d 2>/dev/null | grep -E "FATAL EXCEPTION|AndroidRuntime.*Process: $PKG" || true)
if [ -n "$CRASH" ]; then
    echo "ОШИБКА: приложение упало:" >&2; echo "$CRASH" >&2
    "$ADB" logcat -d > /tmp/keks_crash.log 2>&1 || true
    exit 1
fi
echo "OK: приложение запущено, крэшей нет (сеть выключена)"

if [ "$MODE" = "screenshot" ]; then
    mkdir -p "$ROOT/dist/screenshots"
    for i in $(seq 1 "$NSHOT"); do
        "$ADB" exec-out screencap -p > "$ROOT/dist/screenshots/emu-$i.png"
        echo "  скриншот $i → dist/screenshots/emu-$i.png"
        [ "$i" -lt "$NSHOT" ] && sleep "${SHOT_DELAY:-6}"
    done
    # хром-логи WebGL/JS ошибок, если включена отладка
    "$ADB" -s emulator-5554 emu kill > /dev/null 2>&1 || true
    echo "OK: скриншоты в dist/screenshots/"
else
    echo "== Лог (Ctrl+C — выход) =="
    "$ADB" logcat
fi
