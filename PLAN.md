# TempControl — Tuya sensor monitoring dashboard

## Context

`d:\Projects\TempControl` hozir **bo'sh** — loyiha noldan quriladi.

**Muammo:** Katta binoda ko'p bo'lim bor, har bo'limda Tuya'ga ulangan harorat/namlik
sensorlari ("hydrometer") o'rnatilgan. Hozir bu ma'lumotni faqat Tuya/Smart Life mobil
ilovasidan ko'rish mumkin — u bo'limlarga ajratilmagan, tarix va ogohlantirish
imkoniyati cheklangan, va har bir xodimga faqat o'z bo'limini ko'rsatib bo'lmaydi.

**Maqsad:** Tuya Cloud API'dan ma'lumot oluvchi, chiroyli va aniq bo'limlarga ajratilgan
web dashboard. Har foydalanuvchi login/parol bilan kiradi va **faqat o'ziga tegishli
bo'lim(lar)ni** ko'radi. Bitta admin panel hammasini boshqaradi.

## Tasdiqlangan qarorlar

| Savol | Javob |
|---|---|
| Stack | **Next.js (joriy barqaror: 16.2.x) + TypeScript** (App Router) |
| Tuya kalitlari | **Hozir yo'q** → avval realistik **mock** ma'lumot, keyin real Tuya |
| Funksiyalar | Dashboard + sensor kartalari, Tarix + grafiklar, Alert + chegaralar, Bo'lim/xona + Sozlamalar |
| Til | **uz / ru / en** (to'liq i18n) |
| Auth | **Bino darajasida.** Har binoning o'z login-paroli. Kirgandan keyin shu binoning **hamma** qavat va bo'limi ko'rinadi |
| Sessiya | **1 yil** — bir marta kiriladi, parol qayta so'ralmaydi. Faqat "Chiqish" tugmasi tugatadi |
| Admin | **Alohida login-parol.** Barcha binolarni boshqaradi |
| Hajm | **15+ bo'lim, 50+ sensor** |
| Ogohlantirish | **Faqat sayt ichida** — qo'ng'iroq ikonasi + o'qilmagan soni + alert tarixi. Telegram/email YO'Q |
| Deploy | VPS `158.220.123.53`, Docker + mavjud host nginx (boshqa saytlarga tegilmaydi) |
| Ierarxiya | **Bino → Qavat → Bo'lim → Xona → Sensor** |
| Tarix muddati | **90 kun**, undan eskisi avtomatik o'chiriladi |
| Birlik | **Faqat °C** |
| Qo'shimcha | **Bino umumiy ko'rinishi — faqat admin uchun.** Kiosk rejimi va PDF hisobot YO'Q |

---

## 1. Arxitektura

### Stack (versiyalar `npm view` bilan tekshirilgan, 2026-07-30)
- **Next.js 16.2.x** (App Router, **React 19.2**, **TypeScript 7**) — frontend va API bitta
  loyihada. Tuya `access_secret` faqat serverda qoladi, brauzerga hech qachon chiqmaydi.
  *(Suhbatda "Next.js 15" tanlangan edi — `latest` tegi hozir 16.2.12, xuddi shu App Router
  liniyasi; eng so'nggi barqaror versiya olinadi.)*
- **Tailwind 4.3** (CSS-first `@theme`, `tailwind.config.js` yo'q) + **shadcn/ui** (`shadcn` 4.x CLI).
- **PostgreSQL 16** + **Drizzle ORM 0.45** (+ `drizzle-kit` migratsiyalar).
- **Auth:** o'z sessiyamiz — `httpOnly` cookie + `sessions` jadvali (`jose` 6.x).
  `next-auth`ning `latest` tegi hali **4.24** (v5 beta) — tayyor kutubxonaga bog'lanmaymiz;
  o'z sessiyamiz ~150 satr va RBAC ustidan to'liq nazorat beradi.
  Parol hash: **`node:crypto` `scrypt`** — Windows'da native kompilyatsiya talab qilmaydi
  (`bcrypt`/`argon2` build muammosidan qochamiz).
- **i18n:** `next-intl` 4.x, locale **cookie orqali** (URL o'zgarmaydi — yopiq dashboard, SEO kerak emas).
- **Validatsiya:** `zod` 4.x — barcha form va API kirishlari.
- **Grafik:** `recharts` 3.x (shadcn bilan tabiiy ishlaydi). Server tomonda downsampling
  qilinganidan keyin grafikga ~500 nuqta boradi, shuning uchun og'ir kutubxona kerak emas.
- **Real-time:** SWR `refreshInterval`. Sensorlar o'zi kamdan-kam xabar beradi → SSE hozir ortiqcha.

### Ma'lumot oqimi

```
Tuya Cloud API ──┐
                 ├──> SensorProvider (interfeys) ──> Poller worker ──> PostgreSQL
Mock generator ──┘                                        │            (readings)
                                                          v
                                                   Alert evaluator
                                                          │
                                                          v
                                                   notifications jadvali
                                                          │
Server Components / Route Handlers ──> DAL (bo'limga scope) ──> SWR ──> UI
```

### Provider abstraksiyasi (kalit qaror)

Kalitlar hali yo'q, lekin UI birinchi kundan to'liq ishlashi kerak:

```ts
// src/server/providers/types.ts
export interface SensorProvider {
  listDevices(): Promise<ProviderDevice[]>
  getStatus(deviceIds: string[]): Promise<ProviderReading[]>   // BULK — kvota uchun muhim
  getHistory(deviceId: string, fromMs: number, toMs: number): Promise<ProviderReading[]>
}
```

- `MockProvider` — deterministik (seed'li) generator.
- `TuyaProvider` — imzolash + token kesh + DP normalizator.
- `PROVIDER=mock|tuya` env orqali almashtiriladi. **UI kodi umuman o'zgarmaydi.**

---

## 2. Kirish va izolyatsiya modeli

**Bino — ijarachi (tenant).** Foydalanuvchi hisoblari yo'q: kirish binoga beriladi.
Kim binoning login-parolini bilsa, o'sha binoning **hammasini** ko'radi — barcha
qavat, bo'lim, xona va sensor. Bino ichida hech qanday bo'lish yo'q.

| Sessiya turi | Nima ko'radi | Nima qila oladi |
|---|---|---|
| **Bino** (`kind: "building"`) | Faqat o'z binosi | Ko'rish, tarix, eksport |
| **Admin** (`kind: "admin"`) | Barcha binolar | Hammasi + admin panel |

**Sessiya 1 yil davom etadi** — devor ekrani yoki umumiy kompyuter har kuni parol
so'ramasligi kerak. Chiqish tugmasi — yagona tugatish yo'li.

### Izolyatsiya qoidasi (eng muhim xavfsizlik talabi)
- **Hech bir so'rov scope'siz yozilmaydi.** Barcha ma'lumot murojaatlari
  `src/server/dal/*` ichida va har funksiya birinchi argument sifatida `session`
  oladi. UI to'g'ridan-to'g'ri DB yoki provayderga murojaat qilmaydi.
- Begona bino resursi so'ralsa → **404** (403 emas: 403 resurs mavjudligini oshkor qiladi).
  Mavjud bo'lmagan resurs ham aynan shunday 404 beradi — ikkisi farqlanmaydi.
- `proxy.ts` (Next.js 16 da `middleware.ts` shunday nomlanadi) faqat *birinchi filtr*:
  cookie bor-yo'qligini ko'radi, xolos. **Haqiqiy tekshiruv har Server Component /
  Route Handler / Server Action ichida `requireSession()` orqali** takrorlanadi —
  Next.js hujjati ham proxy'ni to'liq avtorizatsiya vositasi sifatida ishlatishni taqiqlaydi.
- Sessiya har so'rovda **qayta tekshiriladi**: bino o'chirilgan yoki paroli bekor
  qilingan bo'lsa, JWT muddati tugashini kutmasdan darhol chiqariladi.
- Bino/qavat tanlovi cookie'da saqlanadi, lekin u **afzallik**, avtorizatsiya kiritmasi
  emas — har doim sessiya ruxsati bilan solishtiriladi.

### DB sxemasi (asosiy jadvallar)

```
buildings        id, slug(uniq), name, login(uniq), password_hash, is_active, created_at
admins           id, login(uniq), password_hash, is_active
sessions         id(uuid), kind('building'|'admin'), building_id, expires_at,
                 created_at, user_agent, ip
floors           id, building_id, name, level
departments      id, building_id, floor_id, name, sort_order
rooms            id, department_id, name, sort_order,
                 pos_x, pos_y, width, height          -- bino sxemasidagi joyi (ixtiyoriy)
sensors          id, external_id(uniq, Tuya device id), name, building_id, room_id,
                 provider, is_active, temp_offset, hum_offset, last_seen_at,
                 battery, is_online, created_at,
                 temp_dp_code, hum_dp_code, temp_scale, hum_scale, temp_unit  -- Tuya spec keshi
readings         id, sensor_id, ts(timestamptz), temp_c, humidity, battery
                 -- INDEX (sensor_id, ts DESC)
thresholds       id, scope('sensor'|'department'), scope_id, metric('temp'|'hum'),
                 min_value, max_value, hysteresis, sustain_minutes, severity, is_active
alerts           id, sensor_id, metric, rule_id, severity, state('open'|'ack'|'resolved'),
                 opened_at, value_at_open, acked_by, acked_at, resolved_at
notifications    id, building_id, alert_id, read_at, created_at
audit_log        id, actor_kind, actor_id, action, entity, entity_id, meta(jsonb), at
```

O'chirish **soft-delete** (`is_active=false`) — tarix va alert yozuvlari saqlanib qoladi.

### Saqlash muddati va downsampling
Tarix **90 kun**; kunlik tozalash ishi undan eskisini o'chiradi
(50 sensor × 90 kun ≈ PostgreSQL uchun bemalol, rollup jadvali shart emas).

Grafik so'rovi **hech qachon xom qatorlarni qaytarmaydi**: server tomonda vaqt bo'yicha
bucket'larga bo'lib (`avg`, `min`, `max` per bucket) ~500 nuqtaga tushiriladi. Bucket
kengligi oraliqdan avtomatik hisoblanadi (1 soat → 1 daqiqa, 7 kun → 30 daqiqa, 90 kun → 6 soat).

---

## 3. Tuya API — tekshirilgan faktlar va tuzoqlar

Bular rasmiy hujjatlar va uchta mustaqil implementatsiya (tuya-iot-python-sdk, tinytuya,
tuya-connector-nodejs) bilan solishtirib tasdiqlandi.

### 3.1 Imzo (eng xatarli qism)

```
stringToSign = HTTPMethod + "\n" + Content-SHA256 + "\n" + SignatureHeaders + "\n" + Url

Token so'rovi:   sign = HMAC-SHA256(client_id + t + nonce + stringToSign, secret).toUpperCase()
Biznes so'rovi:  sign = HMAC-SHA256(client_id + access_token + t + nonce + stringToSign, secret).toUpperCase()
```

**Xatoga olib keladigan nuqtalar:**
- Imzolangan header bo'lmasa, Url'dan oldin **bo'sh satr** qoladi: `GET\n<hash>\n\n/v1.0/...`
- `Content-SHA256` — **kichik harfli** hex; yakuniy `sign` — **katta harfli** hex. Aralashtirish → jim 1004.
- Bo'sh body = **bo'sh satrning** SHA256'i
  (`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`) — `"{}"` ning hash'i EMAS.
- Query parametrlar `stringToSign` ichida **kalit bo'yicha leksikografik** tartiblanadi va
  simda ketadigan satr bilan **bayt-ma-bayt bir xil** bo'lishi shart. Bir marta quriladi, ikki joyda ishlatiladi.
- Body bir marta serializatsiya qilinadi; hash va `fetch` **aynan bir xil baytlarni** oladi.
- `nonce`: ikkala rasmiy SDK ham `nonce = ""` ishlatadi va header yubormaydi — eng sinalgan konfiguratsiya. **Shuni tanlaymiz.**
- `t` — 13 xonali **millisekund** timestamp (satr sifatida); header va imzodagi qiymat bir xil.
  Soat noto'g'ri bo'lsa → xato 1013. Docker konteynerda vaqt to'g'ri bo'lishi shart.
- Token va refresh endpoint'lari **ikkalasi ham token-management** — `access_token`siz imzolanadi.
  Refresh'ni eski token bilan imzolash — 1004 ning eng ko'p sababi.
- `refresh_token` **bir martalik**: `/v1.0/token/{refresh_token}` yangi refresh_token qaytaradi,
  uni saqlash shart. U **path segmenti**, query emas — imzolangan Url'da ham shunday turadi.

### 3.2 Data center URL'lari
| Region | Base URL |
|---|---|
| China | `https://openapi.tuyacn.com` |
| Western America | `https://openapi.tuyaus.com` |
| Eastern America | `https://openapi-ueaz.tuyaus.com` |
| Central Europe | `https://openapi.tuyaeu.com` |
| Western Europe | `https://openapi-weaz.tuyaeu.com` |
| India | `https://openapi.tuyain.com` |

Region Smart Life ilovasidan aniqlanadi: **Me → Settings → Account and Security → Region**.
Noto'g'ri region → qurilmalar ko'rinmaydi yoki 1106.

### 3.3 DP kodlari va MASSHTAB — eng ko'p uchraydigan xato

- `wsdcg` oilasi: `va_temperature`, `va_humidity`, `battery_percentage`, `battery_state`.
- `ldcg` / `qxj` oilasi: `temp_current`, `humidity_value` — **boshqa kodlar, o'sha fizik kattalik**.
  Faqat bittasini qo'llab-quvvatlaydigan kod bozordagi sensorlarning yarmi uchun jim bo'sh ko'rsatadi.

> **Masshtab qoidasi:** `real = raw / 10^scale` — `scale` **daraja ko'rsatkichi**, bo'luvchi emas,
> va u har doim 1 emas. Haqiqiy misol: AQShdagi wsdcg qurilma `va_temperature` ni
> `{"unit":"°F","min":0,"max":120,"scale":0}` bilan, qiymat `69` deb bergan — bu tom ma'noda
> 69 °F; 10 ga bo'lish bema'ni 6.9 beradi.
> Shuning uchun **masshtab hech qachon kodga qattiq yozilmaydi** — har qurilmaning
> spetsifikatsiyasidan `scale`, `unit` va DP kodi o'qilib `sensors` jadvaliga keshlanadi.
> **Birlik °F bo'lsa server tomonda °C ga o'giriladi** (UI faqat °C ko'rsatadi).

- Spetsifikatsiya javobidagi `values` maydoni — **JSON'ga kodlangan SATR**, ichma-ich obyekt emas:
  javobni parse qilgandan keyin `JSON.parse(item.values)` **ikkinchi marta** chaqiriladi.
- Kategoriya bo'yicha filtrlash **taqiqlanadi**: Tuya ko'p harorat/namlik sensorlarini
  `wsdcg` dan `qxj` ga ko'chirgan. Barcha qurilmalar sanab chiqiladi va spetsifikatsiyasi tekshiriladi.
- Chegara sozlash DP'lari rasmiy nomlari `minitemp_set` / `minihum_set` (ko'pchilik
  o'ylaganidek `mintemp_set` emas) — baribir qurilma spetsifikatsiyasi qaytargani ishlatiladi.

### 3.4 Kvota va tarix — arxitekturaga ta'sir qiluvchi cheklovlar

- **IoT Core bepul sinov: 1 oy (6 oygacha uzaytiriladi), ~26 000 API chaqiruv/oy.**
  Bu ≈ 866 chaqiruv/kun. Shuning uchun:
  - Har sensorni alohida so'rash **mumkin emas** (50 sensor × kuniga bir necha marta → kvota kuyadi).
  - **Bulk status endpoint** ishlatiladi: bitta chaqiruvda ko'p qurilma.
  - Standart poll intervali **5 daqiqa** (≈288 chaqiruv/kun, oyiga ~8.6k — kvota ichida).
    `POLL_INTERVAL_SEC` env orqali sozlanadi; admin panelda joriy sarf ko'rsatiladi.
  - Qurilmalarni qayta aniqlash (discovery) — startda va soatiga bir marta.
- **Qurilma loglari faqat 7 kun bepul saqlanadi**, undan uzoq tarix pullik.
  Statistика API'lari oddiy sensor uchun deyarli ishlamaydi.
  → **Tarixni o'zimiz saqlashimiz majburiy** (bu loyihaning eng katta qiymatlaridan biri).
- Token ~2 soat amal qiladi, keshlanadi.

### 3.5 Boshqa jim tuzoqlar
- Onlayn holat maydoni API'dan API'ga farq qiladi: v1.x `online` (snake_case),
  `/v2.0/cloud/thing/device` ro'yxati `isOnline` (camelCase), detali esa `is_online`.
- `/v2.0/cloud/thing/{id}/state` — bu **freeze** holati (0/1), onlayn/oflayn EMAS.
  Uni aloqa indikatoriga ulash — jim mantiqiy xato.
- Timestamp birliklari aralash: `active_time`/`create_time` — 10 xonali **sekund**;
  log API'larida `start_time`/`end_time`/`event_time` — 13 xonali **millisekund**.
- Log parametr nomi ham har xil: `/v1.0/devices/{id}/logs` → `type`,
  `/v1.0/iot-03/devices/{id}/logs` → `event_types`.
- Muhim xato kodlari: **1004** imzo xato, **1010** token yaroqsiz, **1013** soat farqi,
  **1106** ruxsat yo'q (ilova akkaunti QR orqali bog'lanmagan), **28841002** IoT Core obunasi tugagan.

### 3.6 Ulanish uchun tayyorgarlik (kalitlar kelganda)
1. iot.tuya.com → **Cloud → Development → Create Cloud Project** (Smart Home).
2. API obunalari: **IoT Core**, **Authorization**, **Smart Home Basic Service**, **Device Status Notification**.
3. **Devices → Link Tuya App Account → Add App Account** → QR kodni Smart Life ilovasidan skanerlash.
   Busiz qurilmalar API'ga umuman ko'rinmaydi (1106).
4. Region'ni ilovadan aniqlash va mos base URL'ni `.env` ga yozish.

---

## 4. Bo'limlar (sahifalar) va admin panel

### Bino sessiyasi
| Route | Vazifa |
|---|---|
| `/login` | Bino login-paroli. Rate-limit bor. Xato xabari qaysi maydon noto'g'riligini oshkor qilmaydi |
| `/` | **Dashboard** — KPI tile'lar, **binoning yuqoridan ko'rinishi** (qavat bo'yicha), xonalar bo'yicha guruhlangan sensor kartalari, ochiq alert banneri |
| `/sensors` | Sensorlar ro'yxati — jadval: nom, xona, harorat, namlik, batareya, oxirgi xabar, holat. Filtr + qidiruv |
| `/sensors/[id]` | **Sensor detali** — jonli qiymat, sparkline, harorat grafigi, **alohida** namlik grafigi, chegara chiziqlari, batareya, oxirgi ko'rinish, shu sensor alertlari |
| `/history` | **Tarix/Analitika** — sana oralig'i, bir nechta sensorni solishtirish, min/o'rtacha/maks jadvali, CSV eksport |
| `/alerts` | Alert ro'yxati — filtr (holat, jiddiylik, sensor), acknowledge tugmasi |
| `/settings` | Til (uz/ru/en), mavzu (light/dark) |

Tepada **qavat almashtirgich** (segment tugmalari: "Barcha qavatlar · 1-qavat · 2-qavat …).
Bino nomi yonida turadi; **bino almashtirgich faqat admin sessiyasida** dropdown bo'ladi.

### Admin panel (`/admin/*`)
| Route | Vazifa |
|---|---|
| `/admin/overview` | **Barcha binolar bitta ekranda** — bino bo'yicha issiqlik xaritasi, chetlanish reytingi, offline sensorlar |
| `/admin/buildings` | Bino CRUD: nom, **login + parol** berish/almashtirish, faolsizlantirish |
| `/admin/structure` | **Bino konstruktori** — qavat → bo'lim → xona yaratish va sxemada joylashtirish (§ 4b) |
| `/admin/sensors` | **Tuya qurilmalarini xonaga ulash** (§ 4b), kalibrovka offset, yoqish/o'chirish |
| `/admin/thresholds` | Chegara qoidalari — bino default + sensor bo'yicha alohida |
| `/admin/alerts` | Hamma binolar alert jurnali |
| `/admin/integrations` | Tuya kalitlari, region, **"Ulanishni tekshirish"**, qurilmalarni import qilish |
| `/admin/system` | Poller holati, oxirgi sinxronizatsiya, **API kvota sarfi**, xatolar, DB hajmi |
| `/admin/audit` | Kim nima qilgani jurnali |

Har ekranda: **loading skeleton**, **bo'sh holat**, **xato holati**, **ruxsat yo'q** holati.

---

## 4b. Binoni admin quradi (konstruktor)

Bino tuzilishi kodda yozilmaydi — uni **admin yaratadi**. Bo'sh bino qo'shilgandan
keyingi yo'l ketma-ketligi:

**1-qadam — qavatlar.** `/admin/structure` da qavat qo'shiladi: nomi, tartib raqami va
**haqiqiy o'lchami** (masalan 22.4 × 15.8 m). O'lcham sxemaning tomonlar nisbatini
belgilaydi — shusiz plan binoning shakliga o'xshamaydi.

**2-qadam — bo'limlar.** Har qavatga bo'lim qo'shiladi (Laboratoriya, Ombor, …).
Bir qavatda bir nechta bo'lim bo'lishi mumkin.

**3-qadam — xonalar va sxema.** Xona qo'shilganda uch narsa beriladi:
- **turi:** `room` (sensor qo'yiladi) yoki qobiq elementi — `corridor` (yo'lak),
  `core` (zinapoya/lift), `entry` (kirish), `service` (sanuzel, texnik xona).
  Qobiq elementlari o'lchanmaydi, lekin ularsiz sxema binoga o'xshamaydi.
- **joylashuvi:** sxemada sichqoncha bilan suriladi → `geo {x, y}` (kanvasning 0–100%
  shkalasida). **Faqat admin sura oladi**; bino sessiyasi joylashuvni o'zgartira olmaydi,
  faqat ko'radi.
- **eshigi:** qaysi devorda (`top/right/bottom/left`) — devorda kesma bo'lib chiziladi.

**4-qadam — Tuya ulanishi.** `/admin/sensors`:
1. Admin Tuya kalitlarini kiritadi (Access ID / Secret / region) va **"Ulanishni tekshirish"**
   tugmasini bosadi.
2. Tizim Tuya'dagi qurilmalar ro'yxatini oladi (§ 3.4 dagi bulk endpoint bilan) va
   **hali biriktirilmagan** qurilmalarni ko'rsatadi.
3. Admin qurilmani **xonaga biriktiradi**. Biriktirilganda **sensor nomi xona nomidan
   avtomatik olinadi**.
4. Tizim qurilma spetsifikatsiyasini o'qib `temp_dp_code`, `hum_dp_code`, `scale`,
   `unit` ni keshlaydi (§ 3.3 dagi masshtab tuzog'i shu yerda hal bo'ladi).

> **Nomlar to'qnashuvi.** Bitta xonada bir nechta sensor bo'lishi mumkin (seed'da
> `Server zali` da ikkita rack sensori bor). Shuning uchun qoida: nom **xona nomidan
> boshlanadi**, xonada allaqachon sensor bo'lsa oxiriga raqam qo'shiladi —
> `Server zali`, `Server zali 2`. Admin uni istagancha o'zgartira oladi.

Xona o'chirilsa — ichidagi sensorlar **biriktirilmagan** holatga qaytadi, o'chirilmaydi
(tarix yo'qolmasligi uchun). Barcha o'zgarishlar `audit_log` ga yoziladi.

---

## 5. Dizayn tizimi (`dataviz` skill asosida — qat'iy)

> Grafik kodini yozishdan **oldin** `dataviz` skill qayta yuklanadi va palitra uning
> validatori bilan tekshiriladi (light va dark alohida).

### Buzilmaydigan qoidalar
- **Dual-axis grafik YO'Q.** Harorat va namlik hech qachon bitta plotda ikki y-o'qi bilan
  chizilmaydi → ikkita alohida, bir xil x-o'qi va bir xil brush bilan bog'langan grafik.
- Rang hech qachon yolg'iz ma'no tashimaydi → har doim **ikona + matn yorlig'i** hamroh.
- Har grafikning **jadval ko'rinishi** (table view) bo'ladi.
- Filtrlar grafik ichida emas — ular qamrab olgan hamma narsa ustida **bitta qatorda**.
- Sensor xabar bermagan oraliq **uzilgan chiziq** — interpolyatsiya qilinmaydi.
- Grid va o'qlar — yupqa, tinch hairline, **punktir emas**.
- Katta raqamlarda `tabular-nums` ishlatilmaydi (faqat jadval ustunlari va o'q belgilarida).
- Refetch paytida skeleton "chaqnashi" yo'q — eski render pasaytirilgan shaffoflikda turadi.

### Rang tokenlari

**Status (qat'iy, mavzuga qarab o'zgarmaydi):**
| rol | hex |
|---|---|
| good (norma) | `#0ca30c` |
| warning | `#fab219` |
| serious | `#ec835a` |
| critical | `#d03b3b` |

**Harorat** — *diverging* shkala (sovuq ↔ issiq): blue `#2a78d6` ↔ red `#d03b3b`,
o'rtada neytral kulrang (light `#f0efec`, dark `#383835`).
**Namlik** — diverging: quruq = orange `#eb6834` ↔ nam = blue `#2a78d6`, o'rtada o'sha neytral.

**Sensorlarni solishtirish (kategorik slotlar, tartib qat'iy, aylantirilmaydi):**
| # | light | dark |
|---|---|---|
| 1 blue | `#2a78d6` | `#3987e5` |
| 2 orange | `#eb6834` | `#d95926` |
| 3 aqua | `#1baf7a` | `#199e70` |
| 4 yellow | `#eda100` | `#c98500` |
| 5 magenta | `#e87ba4` | `#d55181` |
| 6 green | `#008300` | `#008300` |
| 7 violet | `#4a3aa7` | `#9085e9` |
| 8 red | `#e34948` | `#e66767` |

8 tadan ortiq sensor birga solishtirilmaydi → "Boshqalar" yoki small-multiples.

**Chrome va ink:**
| rol | light | dark |
|---|---|---|
| Chart surface | `#fcfcfb` | `#1a1a19` |
| Page plane | `#f9f9f7` | `#0d0d0d` |
| Primary ink | `#0b0b0b` | `#ffffff` |
| Secondary ink | `#52514e` | `#c3c2b7` |
| Muted (o'q/label) | `#898781` | `#898781` |
| Gridline | `#e1e0d9` | `#2c2c2a` |
| Baseline / axis | `#c3c2b7` | `#383835` |
| Border ring | `rgba(11,11,11,.10)` | `rgba(255,255,255,.10)` |

Shrift: `system-ui, -apple-system, "Segoe UI", sans-serif` — hamma joyda, katta raqamlarda ham.
Palitra `@theme` blokida CSS custom property sifatida e'lon qilinadi; dark qiymatlar
`prefers-color-scheme` **va** `[data-theme]` scope'ida — mavzu tugmasi ikkala yo'nalishda ham ustun.

### Sensor kartasi anatomiyasi
Nom + xona → katta harorat raqami (proporsional figuralar) → namlik ikkilamchi ink'da →
sparkline (yupqa 2px chiziq, o'qsiz) → pastki qatorda: holat chipi (ikona + matn),
batareya, "5 daqiqa oldin". Chegaradan chiqqan bo'lsa — kartaning chap qirrasida status
rangli chiziq **va** matnli chip.

---

## 6. Fayl tuzilishi (kichik, modulli fayllar — har fayl ≈ ≤350 satr)

```
src/
  proxy.ts                           # ✅ optimistik cookie filtri (Next 16: middleware → proxy)
  app/
    layout.tsx                       # ✅ root: i18n provider + mavzu skripti
    (auth)/login/page.tsx            # ✅ bino login-paroli
    (app)/layout.tsx                 # ✅ sidebar + topbar (bino + qavat almashtirgich)
    (app)/actions.ts                 # ✅ qavat/bino tanlash server action'lari
    (app)/page.tsx                   # ✅ dashboard + bino ko'rinishi
    (app)/sensors/page.tsx           # ✅ ro'yxat jadvali
    (app)/sensors/[id]/page.tsx      # ✅ sensor detali
    (app)/history|alerts|settings/   # ⬜ o'rin egallovchi
    (app)/admin/page.tsx             # ✅ requireAdmin() bilan himoyalangan (hozircha o'rin egallovchi)
    api/**/route.ts                  # ⬜ SWR uchun JSON endpoint'lar
  components/
    layout/     # ✅ Sidebar, Topbar, BuildingSwitcher, FloorSwitcher, LocaleSwitcher,
                #    ThemeToggle, StatTile, ComingSoon
    building/   # ✅ FloorPlan, RoomBox, SensorDot, MetricToggle
    sensors/    # ✅ SensorCard, StatusChip
    charts/     # ✅ Sparkline · ⬜ ChartFrame, TimeSeriesChart, Gauge, TableView
    alerts/     # ⬜ AlertBell, AlertList, AckButton
    admin/      # ⬜ BuildingForm, StructureForm, SensorForm, ThresholdForm
  server/
    auth/       # ✅ credentials.ts, password.ts, session.ts, dal.ts, actions.ts
    dal/        # ✅ sensors.ts, view-selection.ts — hammasi session oladi
    providers/  # ✅ types.ts, mock.ts, index.ts · ⬜ tuya/{sign,token,client,spec,normalize}.ts
    seed.ts     # ✅ binolar, qavatlar, bo'limlar, xonalar, sensorlar
    alerts/     # ⬜ rules.ts, evaluate.ts
  db/           # ⬜ schema.ts, index.ts, migrations/
  i18n/         # ✅ config.ts, request.ts, actions.ts
  lib/          # ✅ types, status, sensor-status, scales, format, cn
messages/       # ✅ uz.json, ru.json, en.json
worker/         # ⬜ poller.ts — alohida Node protsessi
```

---

## 7. Bosqichlar

**Bosqich 1 — Ko'rinadigan chiroyli UI (mock ustida). ✅ BAJARILDI.**
Next.js skeleton, Tailwind `@theme` palitra, layout (sidebar/topbar/theme/locale),
bino login-paroli + 1 yillik sessiya, MockProvider, Dashboard, **binoning yuqoridan
ko'rinishi**, sensor kartalari, sensor ro'yxati va detali.
Seed: 2 bino, 5 qavat, 8 bo'lim, 15 xona, 20 sensor; uch tilda matnlar joyida.
Tekshirildi: build toza, izolyatsiya testlari o'tdi, uch til ishlaydi.

**Bosqich 2 — Ma'lumot bazasi + admin konstruktori. ✅ BAJARILDI (2026-07-31).**
PostgreSQL 16 Docker'da (`127.0.0.1:5434` — 5432/5433 boshqa loyihalar band qilgan),
Drizzle sxemasi va seed, butun ma'lumot qatlami bazaga ko'chdi, `/admin/structure`,
`/admin/sensors`, `/admin/integrations` ishlaydi, poller o'lchovlarni yozadi.
Tekshirildi: build toza, izolyatsiya + buzuq ID testlari o'tdi (hammasi 404).

*(eski reja matni ma'lumot uchun)*
PostgreSQL + Drizzle migratsiyalari, seed'dagi tuzilishni DB'ga ko'chirish,
`/admin/buildings` (bino + login-parol), `/admin/structure` (§ 4b: qavat → bo'lim →
xona, sxemada sichqoncha bilan joylashtirish), `/admin/sensors` (qurilmani xonaga
biriktirish, nom xona nomidan), audit log.

> **Nega DB shu bosqichda:** admin qurgan tuzilish saqlanishi shart. DB'siz konstruktor
> serverni qayta ishga tushirganda hamma narsani yo'qotadi — shuning uchun ikkalasi bitta bosqich.

**Bosqich 3 — Grafiklar va tarix.** `ChartFrame`, `TimeSeriesChart` (chegara tasmasi,
uzilishlar, krest tooltip), `TableView` (har grafikning jadval egizagi), oraliq tanlagich,
poller worker o'qishlarni yozadi, `/history`, downsampling, CSV eksport, 90 kunlik tozalash.

**Bosqich 4 — Alertlar.** thresholds, evaluator, offline va past batareya alertlari,
qo'ng'iroq ikonasi + o'qilmagan soni, `/alerts`, acknowledge. Tashqi kanal yo'q.

**Bosqich 5 — Real Tuya. ✅ KOD YOZILDI (2026-07-31), kalitlar kutilmoqda.**
`providers/tuya/`: `sign.ts` (imzo), `client.ts` (token kesh + xato tarjimasi),
`spec.ts` (DP kodi, scale, °F→°C), `index.ts` (bulk status, log tarixi).
Imzo qoidalari `npm run verify:sign` bilan avtomatik tekshiriladi (11 ta qoida).
Kalitlar `.env.local` ga yozilib `PROVIDER=tuya` qo'yilsa — UI kodi o'zgarmaydi.
`npm run tuya:test` ulanishni va **masshtab to'g'riligini** tekshiradi.

**Bosqich 6 — Deploy.** Dockerfile + docker-compose (app + postgres + worker), `.env`,
host nginx'ga alohida server-blok.

---

## 8. Alert baholash algoritmi

```
har sensor, har metrika (temp | hum) uchun:
  qoida = sensorQoidasi ?? bo'limDefaulti
  buzilgan = qiymat < qoida.min - gisterezis  YOKI  qiymat > qoida.max + gisterezis
  agar buzilgan va shu holat qoida.sustain_minutes davomida uzluksiz davom etgan bo'lsa:
      ochiq alert yo'q bo'lsa → yangi alert (state=open)
  agar qiymat chegaraga gisterezisdan ichkariga qaytgan bo'lsa:
      ochiq alert bor bo'lsa → state=resolved
```

- **Gisterezis** (masalan 0.5 °C) chegara atrofida tebranishdan kelib chiqadigan "flapping"ni
  to'xtatadi. `sustain_minutes` bir martalik chalkash o'lchovni filtrlaydi.
- Alohida qoida turlari: **offline** (N daqiqadan beri xabar yo'q) va **past batareya** (<15%).
- Holat o'tishlari: `open → ack → resolved`. Bir sensor+metrika uchun bir vaqtda faqat
  **bitta ochiq alert** — takroriy bildirishnoma yaratilmaydi.
- Alert ochilganda **faqat shu bo'limga a'zo** foydalanuvchilar uchun `notifications` qatori
  yaratiladi → qo'ng'iroqdagi o'qilmagan soni. Boshqa bo'lim userlari uchun yaratilmaydi.

## 9. Mock generator (Bosqich 1 sifatining kaliti)

- Sutkalik sinusoida: kechasi ~19 °C, tushdan keyin ~26 °C; har sensorga o'z ofseti.
- Namlik haroratga **teskari** korrelyatsiya + o'z shovqini.
- Bir nechta sensor ataylab **offline** (uzilgan chiziqni sinash uchun).
- Bittasi ataylab **chegaradan chiqib turadi** (alert va status chiplarini sinash uchun).
- Batareya asta tushadi; bittasi past batareya holatida.
- Seed sobit → sahifa yangilanganda grafik "sakramaydi", skrinshot barqaror.

## 10. Uch tilli lug'at (asosiy atamalar)

`messages/uz.json | ru.json | en.json` namespace'langan (`common`, `nav`, `dashboard`,
`sensors`, `alerts`, `admin`, `auth`).

| en | uz | ru |
|---|---|---|
| Temperature | Harorat | Температура |
| Humidity | Namlik | Влажность |
| Sensor | Sensor | Датчик |
| Department | Bo'lim | Отдел |
| Room | Xona | Помещение |
| Threshold | Chegara | Порог |
| Alert | Ogohlantirish | Оповещение |
| Acknowledge | Tanishdim | Принять |
| Battery | Batareya | Батарея |
| Offline | Aloqa yo'q | Нет связи |
| Last seen | Oxirgi xabar | Последние данные |
| Average / Min / Max | O'rtacha / Eng past / Eng yuqori | Среднее / Мин / Макс |
| Export | Yuklab olish | Экспорт |
| Settings | Sozlamalar | Настройки |
| User / Role / Admin | Foydalanuvchi / Rol / Administrator | Пользователь / Роль / Администратор |
| Dashboard | Boshqaruv paneli | Панель |
| History | Tarix | История |
| Sign in / Password / Sign out | Kirish / Parol / Chiqish | Вход / Пароль / Выход |

**Diqqat:** Node ICU'da `uz` locale qo'llabi cheklangan bo'lishi mumkin — nisbiy vaqt
("5 daqiqa oldin") uchun o'zbekcha kichik helper (`src/lib/format.ts`), ru/en uchun
`Intl.RelativeTimeFormat`.

## 11. Deploy (VPS)

- `Dockerfile` (Next.js standalone build) + `docker-compose.yml`: `app` + `postgres` + `worker`.
- App **faqat localhost portida** tinglaydi (masalan `127.0.0.1:8092`).
- Host nginx'ga **alohida server-blok** + `proxy_pass http://127.0.0.1:8092`.
  **nginx to'xtatilmaydi va :80/:443 egallanmaydi** — o'sha serverda boshqa saytlar bor.
  Faqat `nginx -t` va `systemctl reload nginx` (restart EMAS).
- Sirlar `.env`da (gitignore): `DATABASE_URL`, `SESSION_SECRET`, `PROVIDER`,
  `TUYA_ACCESS_ID`, `TUYA_ACCESS_SECRET`, `TUYA_BASE_URL`, `TUYA_UID`, `POLL_INTERVAL_SEC`.
- Konteyner vaqti to'g'ri bo'lishi shart (Tuya imzosi timestamp'ga bog'liq, 1013).

## 12. Tekshiruv

- `npm run dev` → `/login` ochiladi, bino paroli bilan kiriladi, dashboard mock ma'lumot
  bilan to'ladi. **Diqqat:** `output: standalone` bo'lgani uchun `npm run start` ishlamaydi —
  lokal tekshiruv `npm run dev`, prod'da `node .next/standalone/server.js`.
- **Izolyatsiya testlari (majburiy, har endpoint uchun salbiy test).** A binosi sessiyasi
  bilan B binosining quyidagilariga murojaat — hammasi **404**:
  `/sensors/[begonaId]`, `/api/sensors/[begonaId]`, `/api/readings?sensorId=begona`,
  `/api/history/export?sensorId=begona`, `/api/alerts/[begonaId]`,
  acknowledge (POST), chegarani tahrirlash (POST).
  Mavjud bo'lmagan ID ham aynan shunday 404 berishi kerak — ikkisi farqlanmasin.
- Bino sessiyasi `/admin/*` va `/api/admin/*` ga kira olmaydi (sahifa ham, API ham) → 404.
- Mass-assignment sinovi: server action'ga begona `buildingId`/`floorId` yuborib ko'rish —
  rad etilishi kerak (cookie ham, form ham).

> Bosqich 1 uchun bu testlar **bajarildi va o'tdi** (2026-07-31): o'z sensori 200,
> begona sensor 404, mavjud bo'lmagan sensor 404, bino→`/admin` 404, admin→`/admin` 200.
- Login rate-limit ishlashi; xato xabari qaysi maydon noto'g'riligini oshkor qilmasligi.
- Cookie `httpOnly` + `sameSite` + prod'da `secure`.
- Palitra `dataviz` validatori bilan (light va dark alohida).
- Grafiklar brauzerda ochib **ko'z bilan** ko'riladi (label to'qnashuvi, overflow, x-o'qi kesilishi).
- Uch tilda almashtirib, tarjima qolib ketmaganini tekshirish.
- Har bosqich oxirida `npm run build`.
- Bosqich 6 da: `/admin/integrations` "Ulanishni tekshirish" real kalitlar bilan yashil
  bo'lishi va import qilingan qurilma qiymatlari **mantiqiy oraliqda** ekani
  (masalan 23.5 °C, 6.9 yoki 235 emas) — masshtab to'g'riligining asosiy tekshiruvi.
