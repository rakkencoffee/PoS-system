# Dokumentasi — Rakken Coffee POS

Dokumentasi teknis untuk developer. Semua file penting ada di sub-folder berikut.

## Struktur

```
docs/
├── architecture/       # Arsitektur sistem & design system
├── guides/             # Panduan setup & konfigurasi
├── api/                # Dokumentasi API (Postman collection)
├── sprint/             # Perencanaan & audit sprint
└── reference/          # Referensi tambahan
```

## Product

| Dokumen | Deskripsi |
|---------|-----------|
| [PRD.md](PRD.md) | Product Requirements Document: masalah, tujuan, persona, scope fitur, user flow, keputusan arsitektur printer, dan roadmap. |

## Architecture

| Dokumen | Deskripsi |
|---------|-----------|
| [SYSTEM-DESIGN.md](architecture/SYSTEM-DESIGN.md) | Arsitektur keseluruhan sistem: Olsera, Midtrans, Prisma, Pusher, Redis, Sentry. Termasuk data flow, sequence diagram, dan deployment architecture. |
| [DESIGN-SYSTEM.md](architecture/DESIGN-SYSTEM.md) | Design system UI: color tokens, typography, spacing, komponen, dan pattern yang dipakai di kiosk/KDS/admin. |

## Guides

| Dokumen | Deskripsi |
|---------|-----------|
| [SETUP-DEVICE.md](guides/SETUP-DEVICE.md) | Panduan lengkap setup perangkat: tablet kiosk, KDS display, printer thermal, dan konfigurasi jaringan lokal. |
| [PRINT-BRIDGE.md](guides/PRINT-BRIDGE.md) | Dokumentasi Print Bridge daemon: cara kerja Cloud Print Queue, instalasi, konfigurasi printer, dan troubleshooting. |

## API

| Dokumen | Deskripsi |
|---------|-----------|
| [rakken-pos-api.postman_collection.json](api/rakken-pos-api.postman_collection.json) | Postman collection lengkap seluruh API (9 folder, 40+ request). Import ke Postman, set `baseUrl` & `apiKey`, langsung test. |

## Sprint

| Dokumen | Deskripsi |
|---------|-----------|
| [PLAN.md](sprint/PLAN.md) | Dokumen perencanaan fitur dan milestone per sprint. |
| [SPRINT_AUDIT.md](sprint/SPRINT_AUDIT.md) | Audit dan evaluasi tiap sprint: apa yang selesai, blockers, dan catatan teknis. |

## Reference

| Dokumen | Deskripsi |
|---------|-----------|
| [APP_ROUTES.md](reference/APP_ROUTES.md) | Daftar semua routes aplikasi: kiosk, KDS, admin, API. Termasuk deskripsi dan parameter. |
| [BRIEF-EDC.md](reference/BRIEF-EDC.md) | Riset teknis integrasi mesin EDC BRI Verifone X990 untuk pembayaran kartu debit/kredit. |
| [CLAUDE.md](reference/CLAUDE.md) | Guidelines untuk LLM coding assistant: aturan perilaku, simplicity-first, surgical changes. |
