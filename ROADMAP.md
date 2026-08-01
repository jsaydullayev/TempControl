# TempControl — qolgan ishlar

Holat: **~97% tayyor** (2026-07-31). Relizga tayyor. Bu hujjat faqat **qolgan ishlarni** sanaydi.
Umumiy arxitektura — [PLAN.md](PLAN.md), vizual qoidalar — [UI-DESIGN.md](UI-DESIGN.md).

O'lcham: **S** ≈ yarim sessiya · **M** ≈ bir sessiya · **L** ≈ ikki sessiya.

---

## A. Alertlar ✅ BAJARILDI (2026-07-31)

| # | Ish | Holat |
|---|---|:--:|
| A1 | `thresholds` va `alerts` jadvallari | ✅ |
| A2 | Baholash dvigateli: gisterezis, "N daqiqa davomida", offline, past batareya | ✅ |
| A3 | Pollerga ulandi — har siklda baholanadi | ✅ |
| A4 | `/alerts` sahifasi: filtr, jadval, "Tanishdim" | ✅ |
| A5 | Qo'ng'iroq haqiqiy alertlarni ko'rsatadi, o'qilmagan soni bilan | ✅ |
| A6 | `/admin/thresholds`: bino default + sensor bo'yicha alohida | ✅ |

Tekshirildi: 20 sensordan 6 ta alert ochildi (2 ta kritik harorat, 1 ta ogohlantirish
harorat, 1 ta namlik, 1 ta offline, 1 ta past batareya), qo'ng'iroqda 6 raqami chiqdi.

## B. Sahifalar ✅ BAJARILDI

| # | Ish | Holat |
|---|---|:--:|
| B1 | `/history`: oraliq, 8 tagacha sensorni solishtirish, min/o'rtacha/maks jadvali | ✅ |
| B2 | ~~CSV eksport~~ — kerak emas deb bekor qilindi | — |
| B3 | `/settings`: til, mavzu, sessiya | ✅ |

Endi bitta ham o'rin egallovchi sahifa qolmadi.

---

## C. Admin paneli ✅ BAJARILDI

| # | Ish | Holat |
|---|---|:--:|
| C1 | `/admin/buildings`: bino yaratish, login + parol, faolsizlantirish | ✅ |
| C2 | Nomni joyida tahrirlash (qavat/bo'lim/xona) | ✅ |
| C3 | Sensor nomi va kalibrovka ofseti | ✅ |
| C4 | `/admin/overview`: barcha binolar, jiddiylik bo'yicha tartiblangan | ✅ |
| C5 | `/admin/audit`: jurnalni ko'rish | ✅ |

Admin panelida endi 8 ta bo'lim bor, hammasi bino sessiyasiga **404**.

---

## D. Tuya ✅ ULANDI (2026-07-31)

| # | Ish | Holat |
|---|---|:--:|
| D1 | Kalitlar, `PROVIDER=tuya`, ulanish sinovi | ✅ |
| D2 | Spetsifikatsiyani `sensors` jadvaliga keshlash | ⬜ (hozir xotirada keshlanadi) |
| D3 | `/admin/sensors` da qurilmalarni ulash | ✅ |
| D4 | `/admin/system`: poller holati va API kvota sarfi | M |

Real qurilma tasdiqlandi: `TH06温湿度` (kategoriya `wsdcg`),
`va_temperature` scale=1 (÷10), `va_humidity` scale=0 (÷1) — masshtab har DP uchun
har xil, aynan shu tuzoq. O'lchov `30.4 °C / 31 %` — mantiqiy oraliqda.

> **Diqqat:** birinchi ishga tushirishda qiymatlar mantiqiy oraliqda ekanini
> tekshirish shart (23.5 °C, 6.9 yoki 235 emas) — masshtab xatosi Tuya'da eng
> ko'p uchraydigan muammo.

---

## E. Mobil va sifat · 5%

| # | Ish | O'lcham |
|---|---|:--:|
| E1 | **Mobil navigatsiya** — pastki tab-bar (Panel · Sensorlar · Tarix · Alertlar) | ✅ |
| E2 | Yuklanish skeletonlari — har sahifa o'z shaklini takrorlaydi | ✅ |
| E3 | Jonli yangilanish (SWR), refetch'da skeleton chaqnamasligi | M |

---

## F. Deploy · 10%

Hozir faqat **baza** konteyneri bor. Ilovaning o'zi hali paketlanmagan.

| # | Ish | Holat |
|---|---|:--:|
| F1 | Ilova uchun `Dockerfile` (multi-stage, root'siz, standalone) | ✅ |
| F2 | `docker-compose.prod.yml`: app + db + worker | ✅ |
| F3 | `deploy/nginx-tempcontrol.conf` + [DEPLOY.md](DEPLOY.md) | ✅ |
| F4 | Birinchi deploy va serverda tekshirish | M |

> Serverda **strotech.uz** va **parizodam.uz** turibdi. nginx to'xtatilmaydi va
> :80/:443 egallanmaydi — faqat yangi server-blok qo'shilib `nginx reload` qilinadi.
> Ilova localhost portida (masalan `127.0.0.1:8092`) tinglaydi.

---

## Tavsiya etilgan tartib

1. ~~A (Alertlar)~~ ✅ · ~~B (Sahifalar)~~ ✅ · ~~C (Admin)~~ ✅ · ~~E1/E2~~ ✅ · ~~F1–F3~~ ✅
2. **D (Tuya)** — kalitlar kelishi bilan; boshqa ishlarga to'sqinlik qilmaydi.
4. **C (Admin qolgani)** — bino CRUD va nom tahrirlash.
5. **F (Deploy)** + **E3 (jonli yangilanish)** — oxirida.

**Qolgani:** ~5 M o'lchamli va ~7 S o'lchamli ish. Taxminan **4–5 ishchi sessiya**.
