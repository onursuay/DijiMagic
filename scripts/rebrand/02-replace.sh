#!/usr/bin/env bash
# Faz 1 — Ordered case-aware string replace, izlenen dosyalara (allowed ext) uygulanır.
# macOS bash 3.2 uyumlu (mapfile YOK).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

LIST="$(mktemp)"; TOUCH="$(mktemp)"
trap 'rm -f "$LIST" "$TOUCH"' EXIT

# Allowed ext + path exclusions (legal=elle, rebrand-docs=transition, .env=Faz4, lock=regen)
git ls-files -- \
    '*.ts' '*.tsx' '*.js' '*.mjs' '*.json' '*.md' '*.sql' '*.html' '*.css' '*.plist' '*.py' '*.sh' \
  | grep -vE '^scripts/rebrand/' \
  | grep -vE '^docs/rebrand/' \
  | grep -vE '^docs/superpowers/specs/2026-06-25-dijimagic-rebrand-domain-migration-design\.md$' \
  | grep -vE '^app/mesafeli-satis-sozlesmesi/page\.tsx$' \
  | grep -vE '^app/on-bilgilendirme-formu/page\.tsx$' \
  | grep -vE '^package-lock\.json$' > "$LIST"

echo "Allowed-ext izlenen dosya: $(wc -l < "$LIST" | tr -d ' ')"

# Sadece token İÇEREN dosyalar (gereksiz mtime yok)
while IFS= read -r f; do
  if grep -qiE 'yoai|yoalgoritma|yodijital' "$f" 2>/dev/null; then printf '%s\n' "$f" >> "$TOUCH"; fi
done < "$LIST"

N=$(wc -l < "$TOUCH" | tr -d ' ')
echo "İçinde token geçen (değişecek) dosya: $N"
if [ "$N" -gt 0 ]; then
  # xargs ile boşluklu yolları güvenli aktar
  tr '\n' '\0' < "$TOUCH" | xargs -0 perl -i -p scripts/rebrand/fix.pl
fi
echo "Replace tamamlandı."
