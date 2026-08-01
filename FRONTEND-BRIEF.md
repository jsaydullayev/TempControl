# TempControl — Frontend developer uchun brief

Bu hujjat frontend dasturchi uchun: **nima quriladi, qanday qoidalar bilan va
qayerdan boshlanadi**. Vizual tafsilotlar — [UI-DESIGN.md](UI-DESIGN.md),
umumiy arxitektura — [PLAN.md](PLAN.md).

---

## 1. G'oya — bir paragrafda

Katta binoda o'nlab **Tuya harorat/namlik sensori** (hydrometer) o'rnatilgan.
Hozir ularni faqat Smart Life mobil ilovasidan ko'rish mumkin: bo'limlarga
ajratilmagan, tarix yo'q, chegara ogohlantirishi yo'q, va har bir xodimga faqat
o'z bo'limini ko'rsatib bo'lmaydi. **TempControl** — shu ma'lumotni bir joyga
yig'ib, **binoni tepadan ko'rsatadigan**, bo'limlarga ajratilgan va login/parol
bilan himoyalangan web panel. Xodim kiradi va bir qarashda ko'radi: qayerda
issiq, qayerda sovuq, qaysi sensor jim qolgan.

**Loyihaning eng muhim o'lchovi — UI sifati.** Ma'lumot quvuri bor va ishlaydi;
ishning qiymati interfeysda.

---

## 2. Kim foydalanadi

**Kirish shaxsga emas, binoga beriladi.** Shaxsiy hisob yo'q: har binoning o'z
login-paroli bor, uni bilgan odam o'sha binoning hammasini ko'radi.

| Sessiya | Qanday kiradi | Nimani ko'radi |
|---|---|---|
| **Bino** | Binoning login-paroli | O'sha binoning **barcha** qavat, bo'lim, xona va sensori |
| **Admin** | Alohida admin login-paroli | Barcha binolar + admin panel |

Sessiya **1 yil** yashaydi — devor ekrani yoki umumiy kompyuter har kuni parol
so'ramaydi. Yagona tugatish yo'li — topbar'dagi **Chiqish** tugmasi.

> **Xavfsizlik qoidasi frontendga ham tegishli:** begona bino resursiga murojaat
> **404** qaytaradi, va mavjud bo'lmagan resurs ham aynan shunday 404 beradi.
> UI'da "sizda ruxsat yo'q" degan ekran **yo'q** — u resursning mavjudligini oshkor qiladi.

---

## 3. Texnologiya va konventsiyalar

| Nima | Tanlov | Izoh |
|---|---|---|
| Framework | **Next.js 16 (App Router)** | Server Components — standart |
| Til | **TypeScript** | `any` ishlatilmaydi |
| Stil | **Tailwind 4** | `tailwind.config.js` **yo'q** — hammasi `globals.css` dagi `@theme` |
| Ikonalar | **lucide-react** | Boshqa ikona to'plami qo'shilmaydi |
| Grafik | **recharts** | Sparkline va gauge — qo'lda SVG (kutubxona ortiqcha) |
| Ma'lumot olish | **SWR** | Jonli yangilanish uchun `refreshInterval` |
| i18n | **next-intl** | Locale **cookie**da, URL'da emas |
| Forma | Server Actions + **zod** | Alohida forma kutubxonasi yo'q |

### Konventsiyalar

1. **Server Component — standart.** `"use client"` faqat state, effekt yoki
   brauzer API kerak bo'lganda. Sabab bir qatorda izoh sifatida yoziladi.
2. **Har fayl ≈ 350 satrdan oshmasin.** Katta bo'lsa — bir butun qismni yonidagi
   yangi faylga ajratib chiqarish (`part`/`barrel` emas, oddiy import).
3. **Xom hex rang yozilmaydi.** Faqat token: `var(--series-1)`, `var(--status-critical)`.
4. **Matn qattiq yozilmaydi.** Hamma matn `messages/*.json` dan (`uz`, `ru`, `en` — uchtasi ham).
5. **UI hech qachon DB yoki provayderga to'g'ridan-to'g'ri murojaat qilmaydi** —
   faqat `src/server/dal/*` orqali, va u har doim `session` oladi.

---

## 4. Loyiha tuzilishi

```
src/
  proxy.ts                         ✅ optimistik cookie filtri (Next 16 nomi)
  app/
    (auth)/login/page.tsx          ✅ bino login-paroli
    (app)/layout.tsx               ✅ sidebar + topbar
    (app)/actions.ts               ✅ qavat/bino tanlash
    (app)/page.tsx                 ✅ dashboard + bino ko'rinishi
    (app)/sensors/page.tsx         ✅ jadval
    (app)/sensors/[id]/page.tsx    ✅ detal (grafiklar hali sodda)
    (app)/history|alerts|settings  ⬜ o'rin egallovchi
    (app)/admin/page.tsx           ✅ requireAdmin() bor, mazmuni ⬜
  components/
    layout/    sidebar, topbar, building-switcher, floor-switcher,
               locale-switcher, theme-toggle, stat-tile, coming-soon  ✅
    building/  floor-plan, room-box, sensor-dot, metric-toggle        ✅
    sensors/   sensor-card, status-chip                               ✅
    charts/    sparkline ✅ · chart-frame, time-series, gauge, table-view ⬜
  server/
    auth/      credentials, password, session, dal, actions  ✅
    dal/       sensors, view-selection                       ✅
    providers/ types, mock, index                            ✅
    seed.ts    2 bino · 5 qavat · 8 bo'lim · 15 xona · 20 sensor  ✅
  i18n/        config, request, actions                      ✅
  lib/         types, status, sensor-status, scales, format, cn   ✅
messages/      uz.json, ru.json, en.json                     ✅
```

---

## 5. Ma'lumot shakllari

Frontend faqat shu tiplar bilan ishlaydi (`src/lib/types.ts`). Tuya'ning barcha
g'alatiliklari (masshtab, °F, DP kodlari) provayder qatlamida tugaydi —
bu yerga **faqat °C va epoch-ms** yetib keladi:

```ts
interface Reading {
  sensorId: string;
  ts: number;        // epoch ms
  tempC: number;     // har doim °C
  humidity: number;  // %
  battery: number;   // %
}

interface SensorState {
  sensor: Sensor;
  latest: Reading | null;   // null = hech qachon xabar bermagan
  isOnline: boolean;
  lastSeen: number | null;
  spark: Reading[];         // oxirgi 3 soat, eskisidan yangisiga
}
```

Holatni o'zingiz hisoblamang — tayyor yordamchilar bor:

```ts
import { summariseSensor } from "@/lib/sensor-status";
// → { severity, kind, labelKey, lowBattery, offline }
// kind → StatusChip'ga, labelKey → t(`status.${labelKey}`) ga

import { evaluateMetric } from "@/lib/status";
// → { severity, direction, deviation } — chegara tasmalari uchun

import { relativeTimeParts, formatTemp } from "@/lib/format";
// relativeTimeParts → { key, count } → t(`time.${key}`, { count })
```

---

## 6. Mock rejim — Tuya kalitisiz ishlash

**Hech qanday API kaliti kerak emas.** `PROVIDER` o'rnatilmagan bo'lsa
`MockProvider` ishlaydi va u:

- sutkalik harorat egri chizig'ini beradi (kechasi sovuq, tushdan keyin issiq);
- namlikni haroratga teskari harakatlantiradi;
- **1 sensorni ataylab offline** qiladi (uzilgan chiziqni tekshirish uchun);
- **2 sensorni chegaradan chiqarib** turadi (status chiplari uchun);
- **1 sensorda batareyani past** qiladi;
- **deterministik** — bir xil vaqtda bir xil qiymat, ya'ni grafik sahifa
  yangilanganda sakramaydi va skrinshot barqaror.

Seed: **2 bino, 5 qavat, 8 bo'lim, 15 xona, 20 sensor** (`src/server/seed.ts`).
Ikkinchi bino ataylab bor — izolyatsiya faqat "oqib ketadigan narsa" mavjud bo'lgandagina sinaladi.

---

## 7. Vazifalar

Har vazifa mustaqil bajariladi va o'z "tayyor" mezoniga ega.

### T1 — Binoni yuqoridan ko'rsatuvchi komponent ✅ BAJARILDI
`src/components/building/*` — `floor-plan.tsx`, `room-box.tsx`, `sensor-dot.tsx`,
`metric-toggle.tsx`. Qolgan ish: admin qo'lda joylashtirishi (`pos_x/pos_y/width/height`)
va ixtiyoriy qavat rasmi ustiga qo'yish.

- Xonalar to'rtburchak sifatida, fon rangi — xonadagi o'rtacha haroratdan
  **diverging** shkala bo'yicha, **past to'yinganlikda**
  (`color-mix(in srgb, <rang> 22%, var(--surface-1))`).
- Har xonada: nomi, o'rtacha harorat **raqami**, sensorlar soni. Chetlanish bo'lsa
  **strelka + matn** (`▲ Juda issiq`) va 2px status ramka.
- Sensorlar xona ichida kichik doiralar; offline — bo'sh kontur; batareya kam — `⚡`.
- Sxema avtomatik joylashtiriladi (xona kattaligi sensorlar soniga mutanosib).
  `rooms` da `pos_x/pos_y/width/height` bo'lsa — o'shandan foydalaniladi.
- Xonaga bosish → shu xona sensorlari; nuqtaga bosish → sensor detali.
- Klaviatura bilan aylanib chiqiladi, hit-area ≥24px, tooltip qiymat + vaqt beradi.

**Tayyor mezoni:** ranglarni ko'rmay turib ham (oq-qora skrinshot) har xonaning
holati o'qiladi.

### T2 — `/sensors` ro'yxati (asosi ✅, qolgani ⬜)
Jadval tayyor. Qo'shiladi: filtr qatori (qidiruv, xona, holat), saralash, bo'sh holat.

### T3 — `/sensors/[id]` detali (asosi ✅, qolgani ⬜)
KPI tile'lar tayyor. Qo'shiladi: oraliq tanlagich (1s/24s/7k/30k/90k), to'liq
**harorat grafigi** va **alohida namlik grafigi**, alertlar ro'yxati.
**Ikki y-o'qli bitta grafik qilinmaydi** — bu qat'iy.

### T4 — Grafik komponentlari
`ChartFrame` (sarlavha + legenda + "Jadval" tugmasi), `TimeSeriesChart`
(chegara tasmasi, uzilishlar, krest tooltip), `TableView` (har grafikning
jadval egizagi), `Gauge` (qo'lda SVG yoy).

### T5 — `/history`
Bitta filtr qatori (sana oralig'i + maks 8 sensor) → ikki grafik →
min/o'rtacha/maks jadvali → CSV yuklab olish.

### T6 — `/alerts` + qo'ng'iroq ikonasi
Topbar'da o'qilmagan soni bilan qo'ng'iroq. Jadval + "Tanishdim" tugmasi.

### T7 — `/settings`
Til va mavzu. **Profil va parol almashtirish yo'q** — hisob binoga tegishli,
parolni admin `/admin/buildings` da almashtiradi.

### T8 — Admin panel ⭐ keyingi katta ish
**Bino tuzilishini admin quradi** — kodda hech narsa qattiq yozilmaydi:

- `/admin/buildings` — bino + login-parol berish/almashtirish.
- `/admin/structure` — **konstruktor**: qavat (nomi + haqiqiy o'lchami, masalan
  22.4 × 15.8 m) → bo'lim → xona. Xona sxemada sichqoncha bilan suriladi va
  cho'ziladi (`geo {x,y,w,h}`), turi tanlanadi (`room` yoki qobiq:
  `corridor/core/entry/service`), eshigi qaysi devorda ekani belgilanadi.
- `/admin/sensors` — **Tuya ulanishi**: kalitlar → "Ulanishni tekshirish" →
  biriktirilmagan qurilmalar ro'yxati → qurilmani **xonaga biriktirish**.
  Biriktirilganda **sensor nomi xona nomidan olinadi**; xonada allaqachon sensor
  bo'lsa oxiriga raqam qo'shiladi (`Server zali`, `Server zali 2`), admin o'zgartira oladi.
- `/admin/overview` (barcha binolar), `thresholds`, `system`, `audit`.

**Muhim bog'liqlik:** bu ish **ma'lumot bazasi bilan birga** qilinadi — DB'siz
konstruktor serverni qayta ishga tushirganda hamma narsani yo'qotadi.

### T9 — Mobil qatlam
Sidebar → pastki tab-bar. Jadvallar **o'z konteynerida** gorizontal skroll qiladi
(sahifa gorizontal skroll qilmaydi).

---

## 8. Buzilmaydigan 10 qoida

1. **Ikki y-o'qli grafik yo'q** — harorat va namlik alohida grafiklarda.
2. Rang yolg'iz ma'no tashimaydi — **ikona + matn** har doim hamroh.
3. Har grafikning **jadval ko'rinishi** bor.
4. Filtrlar grafik ichida emas — ustida bitta qatorda.
5. Ma'lumot yo'q oraliq — **uzilgan chiziq**, interpolyatsiya yo'q.
6. Grid va o'q — yupqa uzluksiz hairline, **punktir emas**.
7. Har nuqtaga raqam yozilmaydi; legenda 2+ qatorda doim bor.
8. Katta yakka raqamda `tabular-nums` **yo'q** (faqat jadval va o'q belgilarida).
9. Refetch'da skeleton chaqnamaydi — eski render susayadi.
10. Kategorik rang **obyektga** biriktiriladi, reytingga emas (filtrda rang o'zgarmaydi).

To'liq ro'yxat: [UI-DESIGN.md](UI-DESIGN.md) § 11.

---

## 9. Ishni boshlash

```bash
npm install
npm run dev        # http://localhost:3000
```

Demo hisoblar (login sahifasida ham ko'rsatilgan):

| Login | Parol | Ko'radi |
|---|---|---|
| `markaziy` | `markaziy2026` | Markaziy bino — 3 qavat, 5 bo'lim, 13 sensor |
| `korpus` | `korpus2026` | Ishlab chiqarish korpusi — 2 qavat, 3 bo'lim, 7 sensor |
| `admin` | `admin2026` | Ikkala bino + admin panel (**bino almashtirgich** shu yerda ko'rinadi) |

**Izolyatsiyani sinash:** `markaziy` bilan kiring va URL'ga `/sensors/s-16`
(korpus sensori) ni qo'ying — **404** kelishi shart.

---

## 10. PR tekshiruv ro'yxati

- [ ] `npm run build` xatosiz o'tdi
- [ ] Yangi matnlar **uchala** tilga qo'shildi (`uz`, `ru`, `en`)
- [ ] Xom hex rang yo'q — faqat tokenlar
- [ ] Light **va** dark mavzuda ko'rildi
- [ ] Mobil kenglikda ko'rildi; sahifa gorizontal skroll qilmaydi
- [ ] Yuklanish / bo'sh / xato holatlari bor
- [ ] Klaviatura bilan aylanib chiqiladi, fokus halqasi ko'rinadi
- [ ] Grafik qo'shilgan bo'lsa — jadval egizagi ham bor
- [ ] Fayl 350 satrdan oshmadi
- [ ] `markaziy` hisobi bilan kirib, `/sensors/s-16` (korpus sensori) ochib ko'rildi → **404**
- [ ] Mijozdan keladigan **har qanday ID** (`?room=`, `?sensor=`, `?floor=`) DAL'da
      sessiyaga tekshirildi — ro'yxatni filtrlash yetarli emas, **nomni ekranga
      chiqarish ham oqish** (bir marta shunday xato bo'lgan)
