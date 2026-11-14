# LunarSight — Lunar Landing Site Navigator

## MVP başlatma

Node.js 22.18+ veya 24/26 kullanın. Repo kökünde:

```bash
npm --prefix frontend ci
npm run build
npm start
```

Ekran ve API: http://127.0.0.1:4170. Port için `PORT` değişkeni kullanılabilir. Derlenmiş React ekranı aynı Node sunucusundan açılır; CRA dev sunucusu gerekmez.

1. Katalogdan iki konum ekleyin.
2. Bilinmeyen yüzey kotu için açık 0 m varsayımını onaylayın veya kot girin.
3. 2026-01-01–2026-01-02 UTC kapsamında karşılaştırmayı çalıştırın.
4. Metadata CSV indirin.

Web hattı yalnız açık `flat` ufuk kullanır; arazi hesabı değildir. Kapsam dışı tarihler reddedilir. Harita şematiktir. QuickMap/Moon Trek hedef katman doğrulaması tamamlanmadı. Gerçek LOLA/SPICE CLI hattı ayrı ve kaba çözünürlüklüdür.

Son MVP kontrolü: uyarısız production build, UI 4/4, HTTP 1/1, modül/kabul 83/83; Chromium iki senaryo + CSV smoke geçti. Bu sayılar örtüşen eski koşulara eklenmez.


NASA Space Apps Lunar Landing Site Navigator proje demosu. Ay konumu ve UTC zaman aralığı için Güneş/Dünya yönlerini, açık ufuk varsayımını ve görünürlük sürelerini karşılaştırır. **NASA onaylı değildir; panel gücü, radyo bağlantısı veya iniş güvenliği garantisi vermez.**

## Güncel durum

Ayrı geliştirme dalı: `feat/lunar-navigator-unified`. Beş Luna geliştirme rolünün modülleri Node HTTP + React hattında birleştirildi. Paketli veri ve açık düz ufuk kullanan sınırlı MVP çalışıyor. Yayın/commit bilgisi `docs/verification.md` içinde; gerçekleşmeyen yayın yapılmış gösterilmez.

- Konum/senaryo testleri: bağımsız 36/36.
- Gök yönleri testleri: bağımsız 40/40.
- Ufuk/gerçek LOLA/kayıtlı SPICE testleri: bağımsız 56/56; geçici venv gerektirir.
- Zaman analizi/CSV: bağımsız 8/8. Konum+gök+analiz birleşik koşu 84/84; bunlar yukarıdakilerle örtüşür, yeniden sayılmaz.
- Orkestratör modül hattı kabulü: 2/2; 25 örnek 24 saat, hizasız son yarım saat, mixed kalite ve kaynaklı CSV.
- HTTP adapter ve UI kabul testleri geliştirme sırasında; son sonuçlar doğrulama kaydına eklenir.
- QuickMap/Moon Trek HTML ve başlangıç arayüzleri açıldı. Hedefte bilimsel katman incelemesi henüz tamamlanmadı; dört kaynak şartı kapandı denmez.

## Mimari

```text
Kaynaklı Site + UTC Scenario
        |                  |
  Gerçek gök vektörleri   Açık flat veya doğrulanmış terrain
        |                  |
        +-- görünürlük ----+
                 |
        zaman ağırlıklı analiz
                 |
       HTTP adapter / React / CSV
```

`src/features/data/`: katalog, koordinat ve senaryo doğrulaması.

`src/features/ephemeris/`: verilen IAU_MOON vektörlerinden yerel gök yönleri; sessiz sentetik yedek yok.

`src/features/visibility/`: ufuk, yaklaşık Güneş diski görünür alanı ve Dünya merkezi görünürlüğü; ayrı gerçek LOLA/ME_DE421 kayıtlı iş akışı.

`src/features/analysis/`: zaman pencereleri ve 2–4 senaryo karşılaştırması.

`frontend/`: mevcut React/TypeScript ekranı. `backend/` eski FastAPI yolu bilimsel doğruluk kaynağı sayılmaz; yeni tek-hat adapter entegrasyonu sürüyor. Eski uygulamanın Astropy/Horizons/harita özellikleri doğrulanmadan vaat edilmez.

## Veri ve sınırlar

- Paketli gerçek gök vektörleri: 2026-01-01T00:00:00Z–2026-01-02T00:00:00Z, saatlik 25 örnek, IAU_MOON. İnterpolasyon kapsamı genişletmez.
- Mevcut LOLA: yaklaşık 7.58 km/piksel küresel LDEM_4; hassas kutup iniş planlaması için yetersiz. Küçük tepe ve kaya tehlikelerini göstermez.
- IAU_MOON ve MOON_ME_DE421 aynı çerçeve değildir. Kayıtlı gerçek arazi yolu ortak yön/yükseklik referansını denetler; farklı hattın çıktıları körlemesine birleştirilmez.
- Düz ufuk gerçek arazi değildir. Açık seçim ve kalite uyarısıyla kullanılır.
- Güneş görünürlük oranı watt değildir. Dünya merkezinin görünmesi bağlantı bütçesi değildir. Yer bilinmesi güvenli iniş alanı anlamına gelmez.
- Son kısa zaman aralığı gerçek süresiyle ağırlıklandırılır. Bitişe hizalı son örnek sıfır süre taşır. Eksik veri sıfır kabul edilmez.
- Bilinmeyen kot katalogda `null`; gök modelinin sıfır kot varsayımı varsa kullanıcıya ayrıca bildirilmelidir.

## Doğrulanmış modül testleri

Node v26.13.0 ile:

```bash
node --test src/features/data/tests/*.test.mjs tests/integration/data-contract.test.mjs
node --experimental-strip-types --test tests/integration/ephemeris-contract.test.mjs src/features/ephemeris/tests/*.test.ts
```

Gerçek terrain testleri küçük fixture'lara ek olarak ham raster/kernel ister. Bu oturumda mevcut `origin/feat/horizon-visibility` Git nesnelerinden alındı; yeni internet indirmesi yapılmadı. Büyük ham dosyalar otomatik yayına alınmaz. İndirme/köken ayrıntıları `docs/lola.md`, `data/lola-manifest.json`, `data/kernels/manifest.json` içinde.

```bash
python -m venv /tmp/opencode/lunar-registration-venv
/tmp/opencode/lunar-registration-venv/bin/python -m pip install -r scripts/requirements-registration.txt
PATH="/tmp/opencode/lunar-registration-venv/bin:$PATH" TMPDIR=/tmp/opencode node --test tests/horizon.test.mjs tests/visibility.test.mjs tests/terrain.test.mjs tests/lola.test.mjs tests/registration.test.mjs tests/real-workflow.test.mjs tests/integration.test.mjs tests/independent-audit.test.mjs
```

HTTP/React başlatma komutları adapter teslimi doğrulandıktan sonra eklenecek; eski kurulum yolunu çalışan yeni entegrasyon gibi sunmuyoruz.

## Kaynaklar ve kanıtlar

- `docs/project-instructions/`: kullanıcı MD şartlarının kopyaları.
- `docs/architecture.md`: birimler, sözleşmeler ve model sınırları.
- `docs/acceptance.md`: kabul kapıları.
- `docs/verification.md`: gerçek komutlar, sonuçlar ve eksikler.
- `docs/sources/usage-status.md`: dört kaynağın ayrı erişim/entegrasyon durumu.
- `docs/sources/horizons-access/`: yeni gerçek API erişim sorguları, ham yanıtlar ve hash.
- `docs/sources/method-review.md`: okunan resmi yöntem belgeleri; makalenin tamamı okunmuş iddiası yok.
- `docs/sources/portal-inspection.md`: görsel katman doğrulamasının durumu.
- `docs/team/`: rol/API/test teslim kayıtları; tarihsel kaynak-dal commitleri bu oturumun commitleri değildir.

## Basitçe anlayalım

Gökyüzü takvimi el fenerinin yönünü söyler; ufuk profili önündeki duvarı anlatır. İkisini aynı cetvelle karşılaştırır, görünür kalan süreyi toplarız. Sentetik örnek: 1 saat yarım disk, 30 dakika tam disk toplam 1 saat eşdeğer disk görünürlüğü verir; panel enerjisi yine bilinmez. Mini soru: Dünya görünürken anten gücü bilinmiyorsa bağlantı yeterliliği neden doğrulanmış sayılmaz?
