# TempControl — UI/UX va dizayn hujjati

Bu hujjat `PLAN.md` ning **vizual qismi**: nima qanday ko'rinadi, qaysi komponent
nimadan tuziladi va qaysi qoidalar buzilmaydi. Kod yozishdan oldin shu hujjat asos qilib olinadi.

---

## 1. Dizayn tamoyillari

1. **Bir qarashda holat.** Foydalanuvchi ekranga 2 soniya qaraydi va "hammasi joyidami?"
   degan savolga javob oladi. Buning uchun: yuqorida KPI tile'lar, keyin ogohlantirish
   banneri, keyin bino ko'rinishi.
2. **Rang hech qachon yolg'iz ma'no tashimaydi.** Har status — rang **+ ikona + matn**.
   Dальtonizm, oq-qora chop etish va `forced-colors` rejimida ham o'qiladi.
3. **Tinch chrome, aniq ma'lumot.** Grid va o'qlar yupqa va sust; e'tibor raqam va
   chiziqda. Qalin to'yingan bloklar yo'q.
4. **Yolg'on aniqlik yo'q.** Sensor xabar bermagan oraliq **uzilgan chiziq** bo'ladi —
   to'g'ri chiziq bilan "bog'lab qo'yish" ma'lumot bor degan yolg'on taassurot beradi.
5. **Bo'sh, yuklanayotgan va xato holat — birinchi darajali dizayn.** Ular keyin
   qo'shiladigan narsa emas, komponent bilan birga chiziladi.

---

## 2. Rang tizimi

Qiymatlar tekshirilgan `dataviz` palitrasidan. Barchasi CSS custom property sifatida
`globals.css` da e'lon qilingan; komponentlar **rol nomi** bilan ishlatadi, xom hex bilan emas.

### 2.1 Sirt va matn (surface & ink)

| Rol | O'zgaruvchi | Light | Dark |
|---|---|---|---|
| Sahifa foni | `--plane` | `#f9f9f7` | `#0d0d0d` |
| Karta/grafik sirti | `--surface-1` | `#fcfcfb` | `#1a1a19` |
| Ikkilamchi sirt | `--surface-2` | `#f2f1ed` | `#242422` |
| Asosiy matn | `--ink-primary` | `#0b0b0b` | `#ffffff` |
| Ikkilamchi matn | `--ink-secondary` | `#52514e` | `#c3c2b7` |
| Sust matn (o'q, label) | `--ink-muted` | `#898781` | `#898781` |
| Grid chizig'i | `--grid` | `#e1e0d9` | `#2c2c2a` |
| O'q / asos chizig'i | `--axis` | `#c3c2b7` | `#383835` |
| Chegara (hairline) | `--hairline` | `rgb(11 11 11 / .10)` | `rgb(255 255 255 / .10)` |

### 2.2 Status ranglari (qat'iy — mavzuga qarab o'zgarmaydi)

| Rol | O'zgaruvchi | Hex | Qachon |
|---|---|---|---|
| good | `--status-good` | `#0ca30c` | Normada |
| warning | `--status-warning` | `#fab219` | Chegaradan biroz chiqqan / batareya kam |
| serious | `--status-serious` | `#ec835a` | Sezilarli chetlanish / aloqa yo'q |
| critical | `--status-critical` | `#d03b3b` | Kuchli chetlanish |

Har doim ikona bilan: `CheckCircle2 / AlertTriangle / CircleAlert / OctagonAlert / CircleSlash / BatteryLow`.

### 2.3 O'lchov shkalalari

**Harorat — diverging (sovuq ↔ issiq).** O'rtasi neytral, ya'ni "normal" hech qanday
rang bilan qichqirmaydi:

```
sovuq  #2a78d6  ──►  neytral  #f0efec (dark: #383835)  ──►  issiq  #d03b3b
 ≤14°C                     18–26°C                             ≥30°C
```

**Namlik — diverging (quruq ↔ nam):**

```
quruq  #eb6834  ──►  neytral  ──►  nam  #2a78d6
 ≤25%              30–60%           ≥70%
```

**Sensorlarni solishtirish — kategorik slotlar** (tartib qat'iy, aylantirilmaydi):

| # | rol | Light | Dark |
|---|---|---|---|
| 1 | `--series-1` blue | `#2a78d6` | `#3987e5` |
| 2 | `--series-2` orange | `#eb6834` | `#d95926` |
| 3 | `--series-3` aqua | `#1baf7a` | `#199e70` |
| 4 | `--series-4` yellow | `#eda100` | `#c98500` |
| 5 | `--series-5` magenta | `#e87ba4` | `#d55181` |
| 6 | `--series-6` green | `#008300` | `#008300` |
| 7 | `--series-7` violet | `#4a3aa7` | `#9085e9` |
| 8 | `--series-8` red | `#e34948` | `#e66767` |

Qoidalar: rang **obyektga** biriktiriladi, uning reytingiga emas (filtr o'zgarganda
qolganlar rangini almashtirmaydi). 8 tadan ortiq qator bo'lsa — "Boshqalar" yoki
small-multiples. Status ranglari hech qachon oddiy qator rangi sifatida ishlatilmaydi.

---

## 3. Tipografika, masofa, forma

- **Shrift:** `system-ui, -apple-system, "Segoe UI", sans-serif` — hamma joyda, jumladan
  katta raqamlarda. Dekorativ yoki serif shrift yo'q.
- **Shkala:** 12 / 13 / 14 / 16 / 20 / 24 / 36 / 48 px.
  - 36–48 — sensor kartasidagi harorat va bino ko'rinishidagi asosiy raqam.
  - 24 — sahifa sarlavhasi. 14 — asosiy matn. 12 — yordamchi matn va o'q belgilari.
- **Raqamlar:** katta yakka raqamlar — **proporsional** figuralar. `tabular-nums`
  faqat jadval ustunlari va o'q belgilarida (`.tnum` klassi).
- **Masofa shkalasi:** 4 / 8 / 12 / 16 / 24 / 32 / 48.
- **Radius:** karta va panel — 12px (`--radius-card`), chip va tugma — 8px, nuqta — to'liq.
- **Soya:** deyarli yo'q. Ajratish uchun 1px hairline chegara ishlatiladi; hover'da juda
  yengil `shadow-sm`. Balandlik illyuziyasi yaratilmaydi.

---

## 4. Ilova karkasi (app shell)

```
┌──────────┬──────────────────────────────────────────────────────────┐
│          │  🏢 Bino   [Barcha qavatlar│1│2│3]        [Til▾] [◐] [⇥] │  ← Topbar
│  Temp    ├──────────────────────────────────────────────────────────┤
│  Control │                                                          │
│          │                                                          │
│ ▪ Panel  │                    Sahifa mazmuni                        │
│ ▫ Sensor │                                                          │
│ ▫ Tarix  │                                                          │
│ ▫ Alert  │                                                          │
│ ▫ Sozlam │                                                          │
│ ▫ Admin  │                                                          │
└──────────┴──────────────────────────────────────────────────────────┘
   240px                        qolgan kenglik
```

- **Sidebar** (240px, ≥1024px da ko'rinadi): faol element `--surface-2` fonda,
  `--ink-primary` matnda, 500 og'irlikda. Qolganlar `--ink-secondary`.
- **Topbar:** chapda **bino nomi** (bino sessiyasida oddiy matn — dropdown emas; admin
  sessiyasida almashtiriladigan dropdown), yonida binafsha "ADMIN" chipi (faqat admin uchun),
  keyin **qavat almashtirgich** — segment tugmalari: `Barcha qavatlar │ 1-qavat │ 2-qavat …`.
  O'ngda til, mavzu, chiqish.
- **Nega dropdown emas:** qavatlar soni kam, hammasini ko'rsatish ikki bosish o'rniga bitta;
  va "Barcha qavatlar" — standart holat — menyu ichida yashirinmaydi.
- **Mobil (<1024px):** sidebar pastdagi 5 ikonali tab-bar'ga aylanadi.

---

## 5. Bino ko'rinishi (yuqoridan) — markaziy ekran

Bu ekran **binoni tepadan** ko'rsatadi: har bo'lim va xona o'z joyida, ranglari joriy
haroratga qarab bo'yalgan. Maqsad — ro'yxatni o'qimasdan, bir qarashda "qayerda issiq,
qayerda sovuq, qayerda aloqa yo'q" ni ko'rish.

### 5.1 Ko'rinish

Qavat almashtirgich **topbar'da** turadi (§ 4), ko'rinish va ko'rsatkich
almashtirgichlari esa sahifa sarlavhasi yonida — bitta filtr qatorida.

```
1-qavat   22.4 × 15.8 m
┌────────────────────────────────────────────────────────────────────────┐
│ ┌────────────┬──────────┬──────────┬─────────────────────────────────┐ │
│ │ Qabulxona  │ Yig'ilish│ Tahlil   │ Reagent xonasi                  │ │
│ │            │ zali     │ xonasi   │      23.8°                      │ │
│ │   23.1°    │  22.7°   │  22.4°   │      ●                          │ │
│ │   ●        │  ●       │  ● ●     ├─────────────────────────────────┤ │
│ │            │          │          │ Sovutgich bo'limi   6.5° ▼      │ │
│ │            │          │          │      ●                          │ │
│ └─────╥──────┴────╥─────┴────╥─────┴──────────╥──────────────────────┘ │
│ ┌───────────────────── Yo'lak ──────────────────────────────────────┐  │
│ └───────────────────────────────────────────────────────────────────┘  │
│ ┌──────────┬────────┬──────────────┬───────────────────────────────┐   │
│ │ Zinapoya │Sanuzel │ Texnik xona  │ Kirish                        │   │
│ └──────────┴────────┴──────────────┴───────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
  Legenda: ≤14°▨  18–26°▨  ≥30°▨   ▲ juda issiq  ▼ juda sovuq  ▨ aloqa yo'q

  ╥ = eshik (devordagi kesma)      ● = sensor      ▨ = shtrixlangan (o'lchovsiz)
```

### 5.2 Qoidalar

- **Chizma sirtlari** alohida tokenlarda: `--paper` (qavat qutisi foni), `--wall`
  (devor chizig'i, 1.5px), `--slab` (qobiq xonalari), `--zone` (yo'lak va sensorli
  xona foni). Bular dashboard kartalari tokenidan farq qiladi, chunki plan — chizma,
  karta emas.
- **Xona to'rtburchagi** qavat qutisida `geo {x, y, w, h}` bo'yicha mutlaq joylashadi;
  quti qavatning **haqiqiy tomonlar nisbatini** saqlaydi, shuning uchun chizma
  binoning shakliga o'xshaydi va karta gridi kabi qayta oqmaydi.
- **Fon rangi** xonadagi sensorlarning **o'rtacha** qiymatidan diverging shkala bo'yicha,
  lekin **past to'yinganlikda** (eng chekkada ham 40% dan oshmaydi, `--zone` ga
  aralashtiriladi) — katta bloklar to'yingan bo'lsa ekran qichqiradi.
- **O'lchovsiz xona shtrixlanadi** (`repeating-linear-gradient` 45°), quyma rang bilan
  emas. Shtrix — rangdan mustaqil kanal: oq-qora chop etishda ham, `forced-colors`
  rejimida ham "bu yerda ma'lumot yo'q" degani ko'rinadi.
- **Eshik** — devordagi kesma: xona chetiga `--paper` rangida qisqa bo'lak qo'yiladi.
- **Rang yolg'iz emas:** har xonada **raqam** (22.4°) yoziladi, chetlanish bo'lsa
  **strelka + matn** (`▲ Juda issiq`) qo'shiladi. Rangni ko'rmagan odam ham hammasini o'qiydi.
- **Sensor nuqtalari** (`●`) — xona ichida kichik doiralar; har biri bitta sensor.
  Chegaradan chiqqani status rangida va 2px sirt halqasi bilan; aloqasi yo'g'i bo'sh
  konturli (`⊘`); batareyasi kami yonida `⚡`.
- **Chetlanish bo'lgan xona** chetiga 2px status rangli ramka oladi — bu rangdan
  mustaqil ikkinchi signal.
- **Bosish:** xonaga bosilsa `/sensors?room=<id>` — shu xona sensorlari ro'yxati;
  nuqtaga bosilsa to'g'ridan-to'g'ri sensor detali. Ikkalasi bir-birining ichiga
  joylashtirilmaydi (havola ichida havola bo'lmasin) — xona havolasi qatlam sifatida
  ostida, nuqtalar ustida turadi.
- **Hover/fokus:** nuqta ustida tooltip — sensor nomi, harorat, namlik, **batareya,
  oxirgi xabar** va holat. Hit-area nuqtadan katta (≥24px). Klaviatura bilan ham
  aylanib chiqiladi (`Tab`), fokus halqasi ko'rinadi.
- **Ruxsat:** sessiya faqat **o'z binosini** ko'radi. Begona bino umuman chizilmaydi —
  bo'sh joy ham qolmaydi, sxema faqat ruxsat etilganidan yig'iladi.
  Bino ichida hech qanday bo'lish yo'q: barcha qavat, bo'lim va xona ochiq.
  Admin `/admin/overview` da barcha binolarni ko'radi.
- **Qavat filtri:** topbar'dagi qavat almashtirgich sxemani ham filtrlaydi.
  "Barcha qavatlar" — har qavat alohida sarlavha ostida ketma-ket chiziladi.

### 5.3 Sxema qayerdan olinadi

**Sxemani admin quradi** — kodda hech narsa qattiq yozilmaydi. `/admin/structure` da:

1. **Qavat** yaratiladi: nomi, tartibi va **haqiqiy o'lchami** (masalan 22.4 × 15.8 m).
   O'lcham plan qutisining tomonlar nisbatini beradi.
2. **Bo'lim** qavatga qo'shiladi (bir qavatda bir nechta bo'lishi mumkin).
3. **Xona** qo'shiladi va sxemada sichqoncha bilan joylashtiriladi. Har xonada:
   - **turi** — `room` (sensorli) yoki qobiq: `corridor`, `core` (zinapoya),
     `entry` (kirish), `service` (sanuzel, texnik xona);
   - **geometriyasi** — `geo {x, y, w, h}`, qavat qutisining 0–100% shkalasida;
   - **eshigi** — qaysi devorda (devorda kesma bo'lib chiziladi).

> **Qobiq elementlari nima uchun kerak.** Ular o'lchanmaydi va hech qanday sensor
> tutmaydi, lekin ularsiz chizma binoga o'xshamaydi: aynan yo'lak xonalarning
> qarama-qarshi tomonda ekanini ko'rsatadi. Shuning uchun ular ham sxemaning
> to'la huquqli qismi.

**Ixtiyoriy (keyingi bosqich):** admin qavat rasmini (PNG/SVG) yuklaydi va xonalarni
shu rasm ustiga qo'yadi. Rasm — faqat fon; barcha ma'lumot baribir ustki qatlamda.

### 5.4 Qayerda ishlatiladi
- **Dashboard** (`/`) — o'z binosi bo'yicha. `Sxema ↔ Kartalar` almashtirgichi bilan
  (ikkalasi ustma-ust turmaydi, joy behuda ketmaydi).
- **`/admin/overview`** — barcha binolar, bino bo'yicha reyting bilan yonma-yon.

---

## 6. Komponentlar

### 6.1 Sensor kartasi

```
┌──────────────────────────────────────┐
┃ Tahlil stoli                 ✓ Normada│   ┃ = chap qirradagi 3px status chizig'i
┃ Tahlil xonasi                        │       (normada — shaffof)
┃                                      │
┃   22.4 °C      💧 44%                │   ← 36px raqam, proporsional figuralar
┃                                      │
┃   ╱‾╲__╱‾‾╲___                       │   ← sparkline: 2px, o'qsiz, uzilishlar ko'rinadi
┃                                      │
┃   🔋 87%              5 daqiqa oldin  │   ← 12px, --ink-muted
└──────────────────────────────────────┘
```
Grid: `sm:2 · xl:3 · 2xl:4` ustun, 12px oraliq. Butun karta — sensor detaliga havola.

### 6.2 Status chipi
`ikona + matn`, fon = status rangining 14% aralashmasi. Hech qachon faqat rangli nuqta emas.

### 6.3 KPI tile
Yorliq (12px, sust) → qiymat (30px) → izoh (12px). Bitta raqam — bu tile, grafik emas.
Chetlanish bo'lsa qiymat status rangida.

### 6.4 Grafiklar

- **Harorat va namlik — ALOHIDA ikki grafik.** Bitta plotda ikki y-o'qi **qat'iyan yo'q**:
  ikki shkalaning tekislanishi ixtiyoriy bo'lgani uchun mavjud bo'lmagan bog'liqlik
  "ko'rsatib qo'yadi". Ular bir xil x-o'qi va bitta umumiy brush bilan bog'lanadi.
- **Chegara tasmasi:** normal diapazon juda sust neytral tasma bilan belgilanadi,
  chegara chizig'i esa yupqa uzluksiz chiziq + chetda matnli yorliq (`26°C maks`).
- **Uzilish:** ma'lumot yo'q oraliqda chiziq **uziladi**.
- **Tooltip:** krestsimon nishon + qiymat + vaqt. Lekin tooltip yagona yo'l emas —
  har grafikning **jadval ko'rinishi** bor (`Jadval` tugmasi).
- **Legenda:** 2 va undan ortiq qator bo'lsa doim bor; 4 tagacha bo'lsa chiziq oxiriga
  to'g'ridan-to'g'ri yorliq ham qo'yiladi. Har nuqtaga raqam yozilmaydi.
- **Filtrlar** grafik ichida emas — ular qamragan hamma narsa ustida bitta qatorda.

### 6.5 Jadval
Sarlavha 12px sust, katakchalar 14px. Raqamli ustunlar `.tnum` va o'ngga tekislangan.
Qator hover'da `--surface-2`. Saralash — sarlavhaga bosish orqali.

---

## 7. Ekranlar

### 7.1 `/login`
Ikki ustunli: chapda harorat gradienti va nom (mobil'da yashiriladi), o'ngda forma.
Kiritiladigan narsa — **binoning** login va paroli (shaxsiy hisob emas).
Til almashtirgich formadan tepada. Xato — bitta neytral xabar: "Login yoki parol noto'g'ri"
(qaysi biri xato ekani **oshkor qilinmaydi**).
Forma ostida kichik izoh: *bir marta kiriladi, parol qayta so'ralmaydi* — foydalanuvchi
sessiya nega saqlanib qolganini tushunsin.

### 7.2 `/` Dashboard
```
Boshqaruv paneli
┌────────┬────────┬────────┬────────┐   4 ta KPI tile
│ O'rt.  │ Min/Max│ E'tibor│ Aloqa  │
└────────┴────────┴────────┴────────┘
┌───────────────────────────────────┐   Banner (faqat muammo bo'lsa)
│ ⚠ 2 ta sensor chegaradan chiqqan  │
└───────────────────────────────────┘
┌───────────────────────────────────┐   Bino ko'rinishi (yuqoridan)
│           [xona sxemasi]          │
└───────────────────────────────────┘
Xona nomi
┌──────┐┌──────┐┌──────┐              Sensor kartalari (xona bo'yicha guruhlangan)
└──────┘└──────┘└──────┘
```

### 7.3 `/sensors`
Filtr qatori (qidiruv, xona, holat) → jadval:
`Nomi · Xona · Harorat · Namlik · Batareya · Oxirgi xabar · Holat`.

### 7.4 `/sensors/[id]`
Sarlavha (nom, xona, holat chipi) → 3 ta KPI (harorat, namlik, batareya) →
oraliq tanlagich (1s / 24s / 7k / 30k / 90k) → **harorat grafigi** → **namlik grafigi** →
shu sensor alertlari ro'yxati.

### 7.5 `/history`
Bitta filtr qatori (sana oralig'i + sensor tanlash, maks 8 ta) → harorat grafigi →
namlik grafigi → min/o'rtacha/maks jadvali → CSV yuklab olish.

### 7.6 `/alerts`
Filtr (holat, jiddiylik, sensor) → jadval: `Sensor · Sabab · Qiymat · Boshlangan ·
Davomiylik · Holat · [Tanishdim]`.

### 7.7 `/settings`
Til va mavzu. **Profil yoki parol almashtirish yo'q** — hisob shaxsiy emas, binoga tegishli;
parolni faqat admin `/admin/buildings` da almashtiradi.

### 7.8 `/admin/*`
Chap menyuda ichki bo'limlar. Har jadval ustida "Qo'shish" tugmasi. O'chirish —
tasdiqlash oynasi bilan va faqat **soft-delete** (faolsizlantirish).

---

## 8. Holatlar

| Holat | Ko'rinish |
|---|---|
| **Yuklanmoqda** | Skeleton — kartaning aniq shaklini takrorlaydi. Qayta yuklashda (refetch) skeleton **chaqnamaydi**: eski render 60% shaffoflikda turadi, sakrash yo'q |
| **Bo'sh** | Ikona + sarlavha + bir jumla izoh + (agar mumkin bo'lsa) harakat tugmasi. Punktir chegarali panel |
| **Xato** | Qizil emas, neytral panel + "Qayta urinish" tugmasi. Texnik xato matni foydalanuvchiga chiqarilmaydi |
| **Ruxsat yo'q** | Alohida ekran yo'q — begona bino resursi **404** qaytaradi. Mavjud bo'lmagan resurs ham aynan shunday 404 beradi, ikkisi farqlanmaydi |
| **Aloqa yo'q sensor** | Karta susayadi (opacity .75), sparkline `--ink-muted` rangda, chip "Aloqa yo'q" |

---

## 9. Moslashuvchanlik (responsive)

| Kenglik | Xulq |
|---|---|
| ≥1536px | Kartalar 4 ustun, bino ko'rinishi to'liq kenglikda |
| ≥1280px | Kartalar 3 ustun |
| ≥1024px | Sidebar ko'rinadi, kartalar 2 ustun |
| <1024px | Sidebar → pastki tab-bar; topbar ixchamlashadi |
| <640px | Kartalar 1 ustun; jadvallar gorizontal skroll qiladigan **o'z konteyneri** ichida (sahifa gorizontal skroll qilmaydi); bino ko'rinishi pinch-zoom bilan |

---

## 10. Harakat va foydalanish qulayligi

- **Bor:** hover'da yengil soya (120ms), jonli nuqtaning sekin pulsatsiyasi (2s),
  skeleton→kontent yumshoq o'tishi (150ms).
- **Yo'q:** raqamlarning "aylanib" chiqishi, sahifa o'tishlarida parallax, kirish animatsiyalari.
- `prefers-reduced-motion` hurmat qilinadi — barcha animatsiya o'chadi (allaqachon `globals.css` da).
- Fokus halqasi hamma interaktiv elementda ko'rinadi va olib tashlanmaydi.
- Har rasm/grafikda `aria-label`; sparkline `role="img"`.
- Kontrast: asosiy matn ≥4.5:1, katta matn va ikonalar ≥3:1. Light mavzuda
  `warning` va `serious` sirt bilan 3:1 dan past — shuning uchun ular **doim** matnli
  yorliq bilan yuradi.

---

## 11. Nima qilinmaydi (anti-pattern ro'yxati)

- ❌ Ikki y-o'qli grafik (harorat + namlik bitta plotda)
- ❌ Har nuqtaga raqam yozish
- ❌ Punktir grid yoki punktir o'q chizig'i
- ❌ Kategoriyalarga qiymat-ramp (bar uzunligini rang bilan takrorlash)
- ❌ Kamalak (rainbow) shkala
- ❌ Diverging shkala o'rtasida rang (o'rtasi neytral kulrang bo'lishi shart)
- ❌ Status rangini oddiy qator rangi sifatida ishlatish
- ❌ Faqat tooltip orqali o'qiladigan qiymat
- ❌ Refetch paytida skeleton chaqnashi
- ❌ Bitta ustunli bar chart yoki 2 bo'lakli pie — bu KPI tile bo'lishi kerak
- ❌ Katta yakka raqamda `tabular-nums`
