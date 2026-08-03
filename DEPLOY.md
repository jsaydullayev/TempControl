# TempControl — deploy

Server: `158.220.123.53`. **Diqqat:** o'sha mashinada **strotech.uz** va
**parizodam.uz** ishlaydi. Host nginx to'xtatilmaydi va `:80`/`:443` egallanmaydi —
faqat yangi server-blok qo'shilib `reload` qilinadi.

---

## 1. Kodni serverga yuklash

Repozitoriy shart emas — arxiv qilib yuboriladi. `--exclude='.env*'` muhim:
lokal `.env.local` da dev bazasi va dev `SESSION_SECRET` bor, ular prodda
zarar keltiradi.

**Lokalda** (Git Bash):

```bash
cd /d/Projects/TempControl
tar --exclude=node_modules --exclude=.next --exclude=.git \
    --exclude='.env*' --exclude=Design \
    -czf /tmp/tempcontrol.tar.gz .
scp /tmp/tempcontrol.tar.gz root@158.220.123.53:/tmp/
```

**Serverda:**

```bash
ssh root@158.220.123.53
mkdir -p /opt/tempcontrol
tar -xzf /tmp/tempcontrol.tar.gz -C /opt/tempcontrol
rm /tmp/tempcontrol.tar.gz
cd /opt/tempcontrol
```

## 1a. `.env` yaratish

```bash
cat > .env <<EOF
POSTGRES_PASSWORD=$(openssl rand -base64 36 | tr -dc 'A-Za-z0-9' | head -c 40)
SESSION_SECRET=$(openssl rand -base64 48)
PROVIDER=tuya
TUYA_BASE_URL=https://openapi.tuyaeu.com
POLL_INTERVAL_SEC=180
EOF
chmod 600 .env
```

`POSTGRES_PASSWORD` dan `/ + =` belgilari ataylab olib tashlanadi — u ulanish
manziliga (`postgres://user:parol@db/...`) qo'yiladi va bu belgilar manzilni
buzadi.

Tuya kalitlarini **lokal oynadan** uzatasiz, shunda ular ekranda ham,
buyruqlar tarixida ham qolmaydi:

```bash
# LOKALDA
grep -E '^TUYA_(ACCESS_ID|ACCESS_SECRET|UID)=' .env.local \
  | ssh root@158.220.123.53 'cat >> /opt/tempcontrol/.env'
```

Tekshiring — 8 qator bo'lishi kerak, kalitlar to'ldirilgan:

```bash
grep -c . /opt/tempcontrol/.env
```

Eski `.env.example` dagi qiymatlar (ma'lumot uchun):

```
POSTGRES_PASSWORD=<uzun tasodifiy satr>
SESSION_SECRET=<uzun tasodifiy satr, kamida 32 belgi>
PROVIDER=tuya
TUYA_ACCESS_ID=<Tuya Cloud loyihasidan>
TUYA_ACCESS_SECRET=<Tuya Cloud loyihasidan>
TUYA_BASE_URL=https://openapi.tuyaeu.com
TUYA_UID=<Link App Account dagi UID>
POLL_INTERVAL_SEC=180
```

`PROVIDER=mock` qoldirilsa ilova soxta ma'lumot ko'rsatadi va buni hech qayerda
ogohlantirmaydi — haqiqiy datchiklar kutilayotgan joyda bu eng chalg'ituvchi holat.

`SESSION_SECRET` almashtirilsa **barcha sessiyalar bekor bo'ladi** — hamma
binolar qaytadan kirishi kerak bo'ladi. Bir marta yaratib, saqlab qo'ying:

```bash
openssl rand -base64 48
```

## 1b. Portni tekshirish

Serverda boshqa stacklar ham ishlaydi. Ilova **8092** ni oladi. Ko'tarishdan
oldin haqiqatan bo'shligini tasdiqlang — pastdagi ro'yxat 2026-08-01 holati,
va `docker ps` faqat Docker konteynerlarini ko'rsatadi, host jarayonlarini emas:

```bash
ss -ltnp | grep 8092        # bo'sh bo'lsa hech narsa chiqmaydi
docker ps --format '{{.Names}}\t{{.Ports}}'
```

| Port | Egasi |
|---|---|
| 8080 | market-system-api |
| 8081 | market-system-client |
| 8091 | r-app |
| 8095 | buildix-web (http) |
| 8455 | buildix-web (https) |
| **8092** | **TempControl** |

Band bo'lsa `docker-compose.prod.yml` dagi `127.0.0.1:8092:3000` **va**
`deploy/nginx-tempcontrol.conf` dagi ikkita `proxy_pass` ni birga o'zgartiring —
faqat bittasini o'zgartirish 502 beradi.

Konteyner nomlari (`tempcontrol-db/app/worker`) va tarmoq (Docker keyingi bo'sh
`172.22.x` ni oladi) mavjud stacklar bilan to'qnashmaydi.

## 2. Ko'tarish

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec app npx drizzle-kit push
read -rsp 'Admin paroli: ' ADMIN_PASSWORD; echo
docker compose -f docker-compose.prod.yml exec \
  -e ADMIN_LOGIN=admin -e ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  app npx tsx scripts/create-admin.ts
unset ADMIN_PASSWORD
```

`read -rs` ishlatiladi — parol ekranda ko'rinmaydi va `~/.bash_history` ga
tushmaydi. Buyruq satriga to'g'ridan-to'g'ri yozilsa, u faylda abadiy qolardi.

Tizimda **bitta admin** bo'ladi. Qolgan hamma kirish binolarga tegishli:
har biriga alohida login/parol `/admin/buildings` dan beriladi.

Bu **faqat admin hisobini** yaratadi. Qolgan hamma narsani — bino, qavat,
bo'lim, xona, datchik — panelning o'zidan quriladi.

> `scripts/seed.ts` ni **prodda ishlatmang**: u 2 ta demo bino va 20 ta soxta
> datchik qo'shadi. U faqat lokal ishlab chiqish uchun.

Parol unutilsa xuddi shu buyruq uni qayta o'rnatadi.

Tekshirish:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8092/login   # 200
docker compose -f docker-compose.prod.yml logs -f worker               # poller sikllari
```

## 2b. Birinchi siklda ishchi xato beradi — bu normal

`up -d` uchala konteynerni birga ko'taradi, jadvallar esa `drizzle-kit push`
bilan **keyinroq** yaratiladi. Shu sababli ishchining birinchi sikli
`cycle failed: ... select ... from "sensors"` deb tugaydi.

Bu o'zi tuzaladi — 5 daqiqadan keyingi sikl normal ishlaydi. Darhol tasdiqlash:

```bash
docker compose -f docker-compose.prod.yml restart worker
docker compose -f docker-compose.prod.yml logs --tail=5 worker
```

Kutilgan: `provider tuya` va `sensors=0 written=0 skipped=0`, xatosiz.

## 3. nginx

```bash
cp deploy/nginx-tempcontrol.conf /etc/nginx/sites-available/tempcontrol
# server_name ni haqiqiy domenga almashtiring
ln -s /etc/nginx/sites-available/tempcontrol /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx        # restart EMAS
```

HTTPS:

```bash
certbot --nginx -d tempcontrol.example.uz
```

Certbot faqat shu domenga tegadi, boshqa saytlar sertifikatiga daxl qilmaydi.

## 3b. `.env` o'zgargach — ishchini QAYTA ishga tushiring

Poller `.env` ni **ishga tushganda** o'qiydi. `PROVIDER` yoki Tuya kalitlari
o'zgarsa, eski jarayon eski sozlama bilan ishlashda davom etadi va bazaga
noto'g'ri manbadan yozib turadi — jimgina.

```bash
docker compose -f docker-compose.prod.yml up -d worker   # qayta yaratadi
docker compose -f docker-compose.prod.yml logs --tail=5 worker
```

Log qatorida `provider tuya` yozuvi turganini tekshiring. Lokalda esa
`npm run worker` ni to'xtatib qayta ishga tushiring.

## 4. Yangilash

```bash
cd /opt/tempcontrol && git pull
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec app npx drizzle-kit push
```

## 5. Zaxira

```bash
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U tempcontrol tempcontrol | gzip > backup-$(date +%F).sql.gz
```

O'lchovlar 90 kun saqlanadi va avtomatik tozalanadi, shuning uchun baza
cheksiz o'smaydi.

---

## Xavfsizlik eslatmalari

- **Baza tashqariga ochilmagan.** `docker-compose.prod.yml` da `db` uchun
  `ports` yo'q — unga faqat boshqa konteynerlar kira oladi.
- **Ilova localhost'da** (`127.0.0.1:8092`). Tashqi dunyoga faqat nginx orqali chiqadi.
- **`X-Forwarded-Proto`** nginx tomonidan uzatiladi — u bo'lmasa sessiya cookie'si
  prod'da `Secure` bayrog'ini olmaydi.
- **Konteyner vaqti** `Asia/Tashkent` ga o'rnatilgan. Tuya imzosi millisekundli
  timestamp'ga bog'liq; soat noto'g'ri bo'lsa xato **1013** keladi va sababi
  hech qayerda yozilmaydi.
- Ilova **root'dan emas**, `nextjs` foydalanuvchisidan ishlaydi.
