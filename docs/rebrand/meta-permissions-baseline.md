# Meta İzin Baseline — Rebrand ÖNCESİ snapshot

> **Snapshot:** 2026-06-25 (DijiMagic rebrand + domain geçişi başlamadan önce)
> **Amaç:** Domain/app ayarları değişiminin onaylı izinleri kaybettirmediğini migrasyon
> SONRASI aynı snapshot ile birebir karşılaştırarak kanıtlamak.

## /me
- id: `122129757393089821`
- name: Onur Şuay

## /me/permissions — GRANTED (12), DECLINED (0)
```
ads_management
ads_read
business_management
instagram_basic
instagram_content_publish
leads_retrieval
pages_manage_ads
pages_manage_posts
pages_read_engagement
pages_show_list
public_profile
whatsapp_business_management
```

## Kritik not
İzinler **system user token + App**'e bağlıdır, domaine DEĞİL. App Domains / OAuth redirect /
webhook / privacy URL değişimi bu izinleri revoke etmez. Yine de:
- Migrasyon sonrası `GET /me/permissions` tekrar alınıp bu liste ile **birebir** karşılaştırılacak.
- Meta dashboard değişiklikleri "ekle-doğrula → yeni domainde uçtan uca test → sonra eski URL'i kaldır"
  sırasıyla yapılacak (izinler hiç boşta kalmaz).
