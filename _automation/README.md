# DijiMagic — SİSTEM SAĞLIĞI (otomatik izleme)

Bu projedeki **tüm otomasyon parçalarının** çalışıp çalışmadığını her gün **09:00**'da
kontrol edip **onursuay@hotmail.com**'a tek bir özet e-postası gönderir. Maili açmadan,
sadece konu satırına bakıp durumu anlarsın:

- `🟢 DijiMagic Sağlık — her şey yolunda`
- `🟡 DijiMagic Sağlık — N uyarı`
- `🔴 DijiMagic Sağlık — N sorun var`

## İzlenen parçalar

| # | Parça | Kontrol |
|---|-------|---------|
| 1 | Canlı uygulama (prod) | `dijimagic.com/api/health` → 200 + `{"ok":true}` |
| 2 | Ana sayfa | `dijimagic.com` → 200 |
| 3 | Supabase DB (omddq) | REST endpoint anon-key ile erişilebilir mi |
| 4 | Vercel deploy + 9 cron | Son production deploy `READY` mi + `vercel.json` cron sayısı |
| 5 | Yerel Beyin job (`com.dijimagic.brain.collect`) | launchd'de yüklü mü, son çıkış kodu, log tazeliği |
| 6 | Beyin verisi | `_learnings/_data/latest.json` kaç gün eski |
| 7 | GitHub yedek — ana repo | HEAD origin ile senkron / push'lu mu |
| 8 | GitHub yedek — Beyin repo (`dijimagic-brain`) | senkron mu |
| 9 | Kritik API anahtarları | `.env.local`'da 8 kritik anahtar mevcut & boş değil |
| 10 | Sağlık job'ının kendisi | bugün çalıştı (self-report) |

Her parça: **✓** çalışıyor · **⚠️** dikkat · **🔴** bozuk + tek satır açıklama.

## Çalışan parçalar (bu makinede)

- **Script (runtime):** `~/.dijimagic-saglik-automation/saglik_kontrol.py`
- **SMTP kimliği (GİZLİ, yerelde):** `~/.dijimagic-saglik-automation/smtp_config.json` — **asla commit edilmez**
- **launchd:** `~/Library/LaunchAgents/com.dijimagic.saglik.plist` (her gün 09:00; bilgisayar
  kapalıysa açılışta bir kez telafi eder)
- **Loglar:** `~/.dijimagic-saglik-automation/saglik.log` (+ `saglik.out.log` / `saglik.err.log`)

Bu klasördeki (`_automation/`) kopyalar **yedektir** — yeni bilgisayarda hızlı kurulum içindir.

## Yeni bilgisayarda kurulum

```bash
# 1) Runtime klasörü + script
mkdir -p ~/.dijimagic-saglik-automation
cp _automation/saglik_kontrol.py ~/.dijimagic-saglik-automation/

# 2) SMTP kimliği (Gmail uygulama şifresi ile) — ÖRNEKTEN üret, GİZLİ kalır
cp _automation/smtp_config.example.json ~/.dijimagic-saglik-automation/smtp_config.json
chmod 600 ~/.dijimagic-saglik-automation/smtp_config.json
# -> sender + app_password (Google Hesap → Güvenlik → Uygulama Şifreleri) doldur

# 3) Test (mail ATMAZ)
python3 ~/.dijimagic-saglik-automation/saglik_kontrol.py --dry-run

# 4) Gerçek mail testi
python3 ~/.dijimagic-saglik-automation/saglik_kontrol.py

# 5) launchd kur (her gün 09:00)
cp _automation/com.dijimagic.saglik.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.dijimagic.saglik.plist
launchctl list | grep com.dijimagic.saglik   # yüklü mü?
```

> **Not:** Script `.env.local`'ı yalnızca YEREL olarak okur (Supabase URL, Vercel token).
> Bu değerler **maile veya buluta yazılmaz**. Repo'ya (`dijimagic-brain`) yalnızca sır-olmayan
> durum özeti (`_learnings/_data/saglik_latest.json` — emoji + zaman) push edilir; bulut
> sessizlik koruması bunun tazeliğine bakıp "bilgisayar günlerce kapalı mı" anlar.

## Manuel çalıştırma

```bash
python3 ~/.dijimagic-saglik-automation/saglik_kontrol.py            # kontrol + mail
python3 ~/.dijimagic-saglik-automation/saglik_kontrol.py --dry-run  # mail YOK, ekrana özet + HTML önizleme
```

## Güvenlik

- `smtp_config.json` ve `.env.local` **asla** GitHub'a/buluta gitmez (`.gitignore`).
- Para harcayabilen/hassas token'lar **yerelde** kalır.
- Push öncesi sır taraması yapılır; eşleşme varsa push iptal.
