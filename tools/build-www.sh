#!/bin/bash
#
# tools/build-www.sh — site/ → android/assets/www/ офлайн-бандл + контроль автономности.
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/site"
DST="$ROOT/android/assets/www"

rm -rf "$DST"
mkdir -p "$DST"
cp -R "$SRC"/. "$DST"/

# служебные превью не попадают в бандл
rm -f "$DST"/_icon_preview.png

echo "==> бандл собран: $(find "$DST" -type f | wc -l) файлов, $(du -sh "$DST" | cut -f1)"

# контроль автономности: ни одного внешнего URL (http/https) в коде и стилях,
# кроме нейтральных упоминаний в комментариях
BAD=$(grep -REn '(src|href)\s*=\s*["'"'"']https?://' "$DST" || true)
if [ -n "$BAD" ]; then
    echo "!! В бандле есть внешние ссылки:"; echo "$BAD"; exit 1
fi
BAD2=$(grep -REn 'https?://(?!schemas)' "$DST" --include='*.js' -P || true)
if [ -n "$BAD2" ]; then
    echo "!! В JS есть внешние URL:"; echo "$BAD2"; exit 1
fi
echo "==> автономность проверена: внешних ссылок нет"
