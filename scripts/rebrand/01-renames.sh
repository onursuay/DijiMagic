#!/usr/bin/env bash
# Faz 2 — Dosya/klasör/route yeniden adlandırma (git mv).
# Bu script scripts/rebrand/ altındadır → string-replace'ten HARİÇ (içinde yoai source adları var).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

# Basename'e case-aware isim haritası uygula (sıra: özel/uzun → jenerik)
map_name() {
  printf '%s' "$1" | perl -pe '
    s/YoAlgoritma/DijiAlgoritma/g;
    s/Yoalgoritma/Dijialgoritma/g;
    s/YOALGORITMA/DIJIALGORITMA/g;
    s/yoalgoritma/dijialgoritma/g;
    s/YoAI/DijiMagic/g;
    s/YoAi/DijiMagic/g;
    s/Yoai/DijiMagic/g;
    s/YOAI/DIJIMAGIC/g;
    s/yoai/dijimagic/g;
    s/yodijital/dijimagic/g;
  '
}

echo "=== 2.A — Klasörler (sıra önemli değil, hiçbiri iç içe değil) ==="
for pair in \
  "app/yoalgoritma:app/dijialgoritma" \
  "app/api/yoai:app/api/dijimagic" \
  "app/api/cron/yoai-outcome-snapshots:app/api/cron/dijimagic-outcome-snapshots" \
  "app/api/cron/yoalgoritma-scan:app/api/cron/dijialgoritma-scan" \
  "components/yoai:components/dijimagic" \
  "lib/yoai:lib/dijimagic" ; do
  src="${pair%%:*}"; dst="${pair##*:}"
  if [ -e "$src" ]; then echo "git mv $src -> $dst"; git mv "$src" "$dst"; else echo "ATLA (yok): $src"; fi
done

echo ""
echo "=== 2.B/2.C — Kalan TÜM dosya basename'leri (tracked, yoai/yoalgoritma içeren) ==="
# git ls-files: yalnız izlenen dosyalar (node_modules/.next/.git otomatik hariç).
# scripts/rebrand/ kendini hariç tut.
git ls-files | grep -iE '(^|/)[^/]*(yoai|yoalgoritma)[^/]*$' | grep -v '^scripts/rebrand/' | while IFS= read -r f; do
  dir="$(dirname "$f")"; base="$(basename "$f")"
  newbase="$(map_name "$base")"
  if [ "$base" != "$newbase" ]; then
    echo "git mv $f -> $dir/$newbase"
    git mv "$f" "$dir/$newbase"
  fi
done

echo ""
echo "=== Kalan isim kontrolü (0 olmalı, scripts/rebrand hariç) ==="
git ls-files | grep -iE '(yoai|yoalgoritma)' | grep -v '^scripts/rebrand/' || echo "(temiz)"
