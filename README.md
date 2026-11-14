# LunarSight — Lunar Landing Site Navigator

Ay yüzeyindeki aday konumları, belirli bir UTC zaman aralığında **Güneş ve Dünya'nın geometrik görünürlüğü** açısından karşılaştıran NASA Space Apps proje demosu.

Temel soru: **“Bu konumda, bu tarihlerde Güneş ne kadar süre görünür? Dünya ne kadar süre görünür? İkisi ne zaman birlikte görünür ve görünürlük kesintileri ne kadar sürer?”**

Amaç tek bir “en iyi iniş noktası” ilan etmek değil; konum, tarih ve model varsayımları değiştiğinde sonuçların nasıl değiştiğini kaynaklarıyla göstermek. Hesaplanan değerler, daha ayrıntılı görev tasarımına girdi olabilir; görev yeterliliğinin kanıtı değildir.

> **NASA onaylı değildir.** Güneş görünürlüğü elektrik üretimi, Dünya görünürlüğü radyo bağlantısı, katalogdaki bir konum da güvenli iniş alanı anlamına gelmez.

## İçindekiler

- [Çalışan MVP ve kapsamı](#çalışan-mvp-ve-kapsamı)
- [Neyi ölçüyoruz?](#neyi-ölçüyoruz)
- [Nasıl hesaplıyoruz?](#nasıl-hesaplıyoruz)
- [Veriler ve hesaplama araçları](#veriler-ve-hesaplama-araçları)
- [Teknoloji ve mimari](#teknoloji-ve-mimari)
- [Kurulum ve kullanım](#kurulum-ve-kullanım)
- [Sonuçları nasıl yorumlamalı?](#sonuçları-nasıl-yorumlamalı)
- [Doğrulama ve testler](#doğrulama-ve-testler)
- [Sınırlar ve sonraki hedefler](#sınırlar-ve-sonraki-hedefler)
- [Teknik belgeler](#teknik-belgeler)

## Sınırlı polar snapshot CLI

Web hattından bağımsız kabul çalışması: onaylı **LDEM_80S_80M V2.1**, 3×3 hücre, 80 m örnekleme aralığı; 2026-11-14 **00:00, 00:05, 00:10 UTC**. Mevcut `runPolarAnalysis` motoru kullanılır; yeni ışın motoru yok. Merkez: −89.9° enlem, 0° boylam, `MOON_ME_DE421`.

```bash
python -m venv .venv
.venv/bin/python -m pip install --only-binary=:all: -r scripts/requirements-polar.txt
npm run test:polar-snapshots
npm run polar:snapshots -- --output output/polar-snapshots.json
```

Bu CLI, `data/raw/polar/LDEM_80S_80M.jp2` ve `LDEM_80S_80M.lbl` dosyalarının onaylı indirmesini; mevcut DE421 kernel dosyalarını gerektirir. Genel `prepare:science` komutu polar rasterı indirmez. Raster Git'e eklenmez; hash/boyut kaydı [polar indirme kanıtında](docs/sources/polar-download-verification.md).

Çıktı `polar-illumination-snapshot/v1`: üç ayrı andaki 9 Güneş diski görünürlük kesri, kaynak/çerçeve kayıtları. **Aralık desteği, aydınlanma süresi, PSR veya kalıcı gölge çıkarılmaz.** Ufuk yalnız 20 km menzil, 80 m ışın adımı, 5° azimut aralığı kullanır; yakınsama veya tam ufuk iddiası yok. Bu menzil dışındaki engeller hesaba katılmaz. 80 m grid aralığı, bağımsız doğruluk garantisi değildir. HTTP/UI entegrasyonu bu aşamanın kapsamı dışında.

## Çalışan MVP ve kapsamı

Web hattı iki açık modeli destekler: **`flat` için paketli IAU_MOON vektörleri**, **`terrain` için LOLA DEM + kayıtlı DE421/SPICE hesabı**. İki hat aynı görünürlük/analiz/CSV modüllerine bağlanır; koordinat çerçeveleri karıştırılmaz.

| Özellik | Mevcut durum |
| --- | --- |
| Kaynak bilgili konum kataloğu ve özel koordinat | Kullanılabilir |
| Güneş/Dünya yerel yükselim ve azimut hesabı | Paketli veri kapsamında kullanılabilir |
| İki–dört senaryo karşılaştırması | Kullanılabilir; otomatik sıralama yok |
| Zaman ağırlıklı görünürlük oranları ve pencereleri | Kullanılabilir |
| Kaynak/model/uyarı içeren CSV | Karşılaştırma için kullanılabilir |
| Web ufuk modeli | Açık `flat` veya hash doğrulanmış LOLA `terrain`; model sonuçta belirtilir |
| Gerçek LOLA arazi ve kayıtlı SPICE iş akışı | HTTP terrain hesabı aynı `runRegisteredAnalysis` hattını çağırır; CLI korunur |
| Harita | Şematik konum bağlamı; bilimsel yükseklik ölçümü değil |
| QuickMap/Moon Trek hedef katman doğrulaması | Tamamlanmadı |
| Güç, batarya, radyo link bütçesi, iniş tehlike analizi | Hesaplanmıyor |

Paketli gök verisi **2026-01-01T00:00:00Z–2026-01-02T00:00:00Z** aralığında, saatlik **25 örnek** içerir. Kapsam dışına tahmin yapılmaz. Bu bir günlük demo, tüm Ay gündüz/gece döngüsünü temsil etmez.

## Neyi ölçüyoruz?

Buradaki “ölçüm”, yüzeydeki sensörden alınan canlı telemetri değil; kaynaklı konum verileri ve gök vektörlerinden üretilen **geometrik hesaplama** demektir.

### Girdiler

| Girdi | Birim / anlam |
| --- | --- |
| Enlem, boylam | Derece; boylam doğuya pozitif |
| Yüzey kotu | Metre; küresel 1737.4 km Ay referans yarıçapına göre |
| Gözlemci yüksekliği | Yüzey üstünde metre; örneğin gözlem noktası/anten yüksekliği |
| Başlangıç ve bitiş | UTC; ISO 8601, `Z` son eki |
| Zaman adımı | Saniye; hesap ve pencere çözünürlüğünü belirler |
| Ufuk modeli | `flat`: her azimutta 0°; `terrain`: LOLA'dan hesaplanan ufuk |

Katalogda bilinmeyen kot `null` kalır. Flat hesabı için sayı girilmesi veya **0 m varsayımının açıkça onaylanması** gerekir. Bu onay gerçek kotun ölçüldüğü anlamına gelmez. Terrain yüzey kotunu DEM'den türetir; gözlemci yüksekliği ayrıca uygulanır.

Terrain isteği `coordinateFrame: "MOON_ME_DE421"` beyanını zorunlu tutar. Bu, katalog koordinatlarının dönüştürüldüğü veya çerçevesinin bağımsız doğrulandığı iddiası değildir; girilen sayılar bu çerçevede yorumlanır. Katalog çerçeve belirsizliği uyarıda kalır.

### Çıktılar

| Çıktı | Kod alanı | Ne anlatır? |
| --- | --- | --- |
| Güneş yükselimi ve azimutu | `sunAltDeg`, `sunAzDeg` | Güneş merkezinin yerel gökteki yönü |
| Dünya yükselimi ve azimutu | `earthAltDeg`, `earthAzDeg` | Dünya merkezinin yerel gökteki yönü |
| Anlık Güneş diski görünür oranı | `sunVisibleFraction` | Yaklaşık görünür disk alanı; 0–1 |
| En az bir kısmıyla Güneş görünür süre oranı | `sunAnyFraction` | Güneş diskinin herhangi bir kısmının göründüğü zaman payı |
| Eşdeğer tam disk görünürlük oranı | `sunEquivalentFraction` | Disk görünür alanının zaman ağırlıklı ortalaması |
| Dünya görünür süre oranı | `earthVisibleFraction` | Dünya merkezinin ufkun üzerinde kaldığı zaman payı |
| Birlikte görünür süre oranı | `bothFraction` | Güneşin bir kısmı ve Dünya merkezinin aynı anda göründüğü zaman payı |
| En uzun Güneş görünmeme süresi | `longestDarkSeconds` | Modelde Güneş diskinin hiç görünmediği en uzun ardışık süre |
| En uzun Dünya görünmeme süresi | `longestEarthGapSeconds` | Dünya merkezinin görünmediği en uzun ardışık süre |
| Görünürlük pencereleri | `windows.sun`, `windows.earth`, `windows.both` | Başlangıç, bitiş ve süre içeren zaman aralıkları |

Oranlar 0–1 aralığındadır; yüzde için 100 ile çarpılır. Süreler analiz ve CSV katmanında saniyedir. “Karanlık” burada yalnız Güneş geometrisini anlatır; yüzey sıcaklığı veya başka ışık kaynakları hesaplanmaz.

## Nasıl hesaplıyoruz?

### 1. Senaryo ve veri doğrulaması

Koordinatlar, sonlu sayılar, zaman sırası, UTC biçimi ve veri kapsamı denetlenir. Geçersiz tarih veya eksik veri sessizce sıfırla doldurulmaz. Gerçek gök verisi yokken sentetik sonuç yedek olarak sunulmaz.

Tam kutuplarda yerel kuzey/azimut tanımı belirsiz olduğundan mevcut gök yönü hesabı tam ±90° enlemi reddeder.

### 2. Gök vektörlerini senaryo zamanlarına örnekleme

Web, diskteki `src/features/ephemeris/fixtures/real-moon-vectors.json` dosyasını okur. Dosya Ay merkezli, Ay'a sabit **`IAU_MOON`** çerçevesinde Güneş ve Dünya konum vektörleri taşır; vektör birimi kilometredir.

Kaynak zamanları arasındaki vektörler **doğrusal interpolasyon** ile elde edilir. Daha küçük zaman adımı daha çok sonuç noktası üretir; kaynak verinin saatlik çözünürlüğünü veya doğruluğunu kendiliğinden artırmaz. Veri aralığı dışına ekstrapolasyon yapılmaz.

### 3. Ay merkezinden yerel gözlemciye dönüşüm

Ay, **1737.4 km yarıçaplı küre** olarak modellenir. Yüzey kotu ve gözlemci yüksekliği bu yarıçapa eklenir:

```text
r_observer = 1737.4 km + (surfaceElevationM + observerHeightM) / 1000
observer = r_observer × (cos(lat)cos(lon), cos(lat)sin(lon), sin(lat))
direction = targetMoonFixedKm − observer
```

Yön vektörü yerel kuzey, doğu ve yukarı eksenlerine izdüşürülür:

```text
altitude = atan2(up, sqrt(north² + east²))
azimuth  = atan2(east, north), [0°, 360°) aralığına alınır
```

Yükselim 0° yerel teğet düzlemdir; pozitif değer gökte yukarı yönü gösterir. Azimut kuzeyden saat yönünde ölçülür: kuzey 0°, doğu 90°, güney 180°, batı 270°.

Hesap geometriktir. Işık zamanı, aberasyon ve atmosferik kırılma düzeltmesi uygulanmaz. Ay yönelimi ve zaman dönüşümleri kaynak veri üretim hattının sorumluluğundadır.

### 4. Ufukla karşılaştırma

Ufuk profili, her azimut için engelleyici yükselim açısını verir: `horizon(azimuth)`.

- **Web `flat`:** her yönde 0°. Dağ, krater duvarı, yerel tepe ve arazi kaynaklı gölge temsil edilmez.
- **Ayrı terrain CLI:** LOLA rasterından örneklenen araziyle görüş yönlerinde ufuk oluşturulur. Veri çözünürlüğü ve koordinat çerçevesi ayrıca denetlenir.

`IAU_MOON` ile `MOON_ME_DE421` aynı çerçeve değildir. Paketli web vektörleri terrain hesabına takılmaz; terrain kendi DE421 kayıtlı vektörlerini üretir. Konum, gözlemci yüksekliği ve çerçeve eşleşmesi hesap sözleşmesinin parçasıdır.

### 5. Güneş diskinin görünür kısmı

Güneş nokta değil, açısal yarıçapı olan disk olarak ele alınır. Açısal yarıçap, **695700 km Güneş yarıçapı** ve gözlemci–Güneş uzaklığından hesaplanır.

Ufkun disk boyunca yerel olarak düz olduğu yaklaşımıyla:

```text
x = clamp((sunAltitude − horizonAtSunAzimuth) / sunAngularRadius, −1, 1)
f = (acos(−x) + x × sqrt(1 − x²)) / π
```

`f=0` disk görünmüyor; `f=0.5` yaklaşık yarısı; `f=1` tamamı görünür. Bu, yaklaşık **geometrik disk alanı oranıdır**. Panel eğimi, verim, ışınım, sıcaklık ve elektrik sistemi içermez; watt veya enerji değildir. Karmaşık arazi siluetinin disk boyunca ayrıntılı örtülmesi de bu yaklaşımın dışındadır.

### 6. Dünya ve birlikte görünürlük

Dünya için disk alanı yerine **merkez görünürlüğü** kullanılır:

```text
earthVisible = earthAltitude > horizonAtEarthAzimuth + marginDeg
bothAvailable = sunVisibleFraction > 0 AND earthVisible
```

Web varsayılanında `marginDeg=0`. Ufka eşit olan Dünya merkezi görünür sayılmaz. `bothAvailable` adı görev kaynaklarının yeterli olduğunu değil, yalnız bu iki geometrik koşulun birlikte sağlandığını anlatır.

### 7. Zaman ağırlıklı analiz

Her örneğin değeri sonraki örneğe kadar sabit tutulur: **`[t_i, t_(i+1))`**. Son kısa aralık gerçek süresiyle ağırlıklandırılır. Bitişe tam denk gelen son örneğin ek süre katkısı yoktur.

```text
T = end − start
sunEquivalentFraction = Σ(f_i × Δt_i) / T
earthVisibleFraction = Σ(earthVisible_i × Δt_i) / T
bothFraction = Σ(bothAvailable_i × Δt_i) / T
```

Örnek: 1 saat yarım disk, 30 dakika tam disk görünürse toplam **1 saat eşdeğer tam disk görünürlüğü** elde edilir. Toplam 1.5 saat için `sunEquivalentFraction = 2/3`; Güneş her aralıkta kısmen göründüğü için `sunAnyFraction = 1` olur. Bunlardan elektrik enerjisi çıkarılamaz.

Ardışık görünür aralıklar pencereye birleştirilir; görünmeme dizilerinin en uzunu hesaplanır. Pencere sınırları örnek zamanlarıdır, kesin doğuş/batış anları değildir. Bir saatlik adım, saniye hassasiyetli olay zamanı iddiasını desteklemez.

## Veriler ve hesaplama araçları

| Kaynak / araç | Projedeki rolü | Web hesabında durumu |
| --- | --- | --- |
| NASA/JPL NAIF SPICE | Ephemeris kernel verileri, gövde konumları, Ay çerçeveleri ve zaman dönüşümleri | Önceden üretilmiş vektörler kullanılır; her istekte SPICE çalışmaz |
| DE440s, PCK00011, NAIF0012 | Paketli `IAU_MOON` veri kümesinin bildirdiği ephemeris, yönelim ve zaman kaynakları | JSON vektörlerinin kaynak zinciri |
| JPL Horizons | Kaydedilmiş karşılaştırma/referans sorguları | Canlı web hesap motoru değil |
| LRO / LOLA LDEM_4 | Küresel Ay topografyası; yaklaşık **7.58 km/piksel** | CLI ve web terrain hattında; web flat sonucunda kullanılmaz |
| DE421 ve Ay frame/orientation kernel dosyaları | Ayrı `MOON_ME_DE421` kayıtlı arazi/gök iş akışı | Web veri kümesiyle aynı hat değil |
| Python, SpiceyPy, NumPy | Kernel okuma, vektör üretimi, dönüşüm ve bağımsız karşılaştırma araçları | Normal web başlatmasında gerekli değil |
| LROC QuickMap / NASA Moon Trek | Görsel inceleme ve kaynak bağlamı | Hedef bilimsel katman doğrulaması eksik; hesap girdisi diye sunulmaz |
| NASA/NSSDC, NASA görev ve USGS kayıtları | Konum kataloğu kaynakları | Kaynak kimlikleri katalog ve sonuç metadata'sına taşınır |

Kaynak erişimi, hesapta entegrasyon ve doğruluk doğrulaması farklı şeylerdir. Bir portalın açılması, o portalın yükseklik katmanının hesapta kullanıldığı anlamına gelmez. `real` etiketi kaynaklı veri türünü belirtir; bağımsız doğruluk sertifikası değildir. Gerçek gök verisi ile sentetik düz ufuk birleştiğinde kalite `mixed` olabilir.

Büyük ham raster ve ikili kernel dosyaları Git teslimine dahil değildir. Web MVP paketli JSON ile çalışır; gerçek arazi CLI/testleri ayrıca ham dosyaları ister. Köken ve dosya ayrıntıları `data/lola-manifest.json`, `data/kernels/manifest.json` ve `docs/lola.md` içinde.

Resmi kaynaklar:

- [NAIF generic kernels](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/)
- [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/)
- [LRO / LOLA arşivi](https://pds-geosciences.wustl.edu/missions/lro/lola.htm)
- [LROC QuickMap](https://quickmap.lroc.im-ldi.com/)
- [NASA Moon Trek](https://trek.nasa.gov/moon/)

## Teknoloji ve mimari

| Katman | Kullanılan teknoloji | Sorumluluk |
| --- | --- | --- |
| Arayüz | React 19, TypeScript, CSS; `react-scripts` 5 build | Konum/senaryo girdileri, sonuç gösterimi, CSV indirme |
| HTTP ve statik sunucu | Node.js `node:http`, ES modules | JSON API ve derlenmiş React dosyalarını aynı portta sunma |
| Gök geometrisi | TypeScript, Node type stripping, vektör matematiği | Yerel yönler, interpolasyon, Güneş açısal yarıçapı |
| Ufuk ve görünürlük | JavaScript `.mjs` modülleri | Ufuk profili, disk oranı, Dünya merkezi testi |
| Analiz ve dışa aktarım | JavaScript `.mjs` | Süre ağırlıkları, kesintiler, pencereler, metadata CSV |
| Bilimsel yardımcı araçlar | Python, SpiceyPy, NumPy | Çevrimdışı veri üretimi ve ayrı kayıtlı arazi hattı |
| Test | Node test runner; Jest/React Testing Library; Playwright/Chromium | Modül, HTTP, UI sözleşmesi ve tarayıcı smoke kontrolleri |

`frontend/package.json` içinde Leaflet, Recharts ve Axios gibi bağımlılıklar da bulunur. Bir paketin kurulu olması, mevcut MVP'nin bilimsel hesabında kullanıldığını göstermez.

```text
Kaynaklı konum + UTC senaryo
             |
       veri doğrulaması
             |
  paketli IAU_MOON vektörleri
             |
  interpolasyon + yerel gök yönü
             |
  açık flat ufuk ile karşılaştırma
             |
  Güneş diski / Dünya merkezi görünürlüğü
             |
  süre ağırlıklı analiz ve pencereler
             |
     Node HTTP / React / CSV

Terrain alternatif dalı (HTTP ve CLI):
LOLA + runRegisteredAnalysis + kayıtlı DE421 gök yönü
             |
ME_DE421_LOCAL_NORTH_EAST arazi ufku
             |
aynı görünürlük / analiz / HTTP / React / CSV
```

### Dizinler ve API

- `src/features/data/`: katalog, kaynak kimlikleri ve giriş doğrulaması.
- `src/features/ephemeris/`: gök vektörleri, yerel koordinat hesabı ve veri üretim/doğrulama araçları.
- `src/features/visibility/`: ufuk, LOLA okuma, çerçeve kaydı ve görünürlük.
- `src/features/analysis/`: metrikler, zaman pencereleri, karşılaştırma ve CSV.
- `server/app.mjs`: çalışan HTTP adapter ve production statik sunucu.
- `frontend/`: React ekranı ve UI sözleşme testleri.
- `scripts/`: ayrı gerçek arazi/kayıtlı analiz komutları.
- `tests/`: modüller arası sözleşme, arazi ve kabul testleri.
- `backend/`: önceki FastAPI hattı; yukarıdaki çalışan MVP'nin hesap motoru değil.

| Endpoint | İşlev |
| --- | --- |
| `GET /api/catalog` | Konumlar ve kaynaklar |
| `GET /api/portals` | Kaynakların erişim/entegrasyon durumları |
| `POST /api/analyze` | 1–4 senaryo için hesap; 2–4 senaryoda karşılaştırma CSV'si |

Web API `horizonModel: "flat"` ve `"terrain"` kabul eder; dışarıdan terrain belgesi yüklemesi reddedilir. Terrain mevcut `runRegisteredAnalysis` ile üretilir. Her sonuç hesaplanan değerlerin yanında model, çerçeve ve uyarı taşır. CSV ayrıca kaynak kimlikleri ve zaman çözünürlüğünü içerir.

## Temporal Shadow Intelligence

Yeni izole modül: `src/features/analysis/illumination.mjs`. Açık zaman aralıklarından hücre bazlı aydınlanma/penumbra/umbra süreleri, görev döngüsü, kesintisiz süreler, geçişler, mevsimsel varyans, kapsama belirsizliği ve **Shadow Dynamics Fingerprint** üretir. Eksik örnekler karanlık sayılmaz. Kısa dönem gölgesi kalıcı PSR ilan edilmez.

Deneysel `illumination-spatial.mjs`: sınır geometrisi hareketi ve 4-komşu tam aydınlık bileşenleri; fiziksel sınır takibi veya araç rotası değildir. Agent3 sürümlü 2D harita sözleşmesi henüz bulunmadığından gerçek raster entegrasyonu doğrulanmış sayılmaz. Mevcut `analyzeVisibility()` API'si değişmez.

Sözleşme, normalizasyon, eksik veri politikası, hiyerarşik çalışma planı, benchmark ve açık doğrulama kapıları: [Agent5 handoff](docs/team/07-temporal-illumination-handoff.md).

```bash
node --test src/features/analysis/tests/*.test.mjs
node scripts/benchmark-illumination.mjs
```

## Kurulum ve kullanım

### Bilimsel verileri hazırlama

Temiz klonda LOLA rasterı ve DE421 ikili kernel dosyaları Git içinde bulunmaz. Resmi manifest URL'lerinden indirme, boyut/SHA-256 kontrolü, yerel Python ortamı kurulumu ve gerçek veri testlerini tek komutla çalıştırın:

```bash
npm run prepare:science
```

Eşdeğeri: `node scripts/prepare-data.mjs --setup-python --test`. Python, venv/pip ve HTTPS erişimi gerekir. Altı veri dosyasının toplamı yaklaşık 22.74 MB; geçerli yerel dosyalar yeniden indirilmez. Boyut/hash eşleşmeyen indirme kullanılmaz. Python bağımlılıkları repo içindeki Git dışı `.venv` ortamına kurulur.

İndirme yapmadan yalnız veri doğrulamak için:

```bash
npm run verify:science-data
```

Ayrıntılar: [`docs/data-preparation.md`](docs/data-preparation.md). Temiz snapshot üzerinde gerçek resmi indirme, yeni Python ortamı ve 61 bilimsel test geçti; üç ikili dosya başlangıçta yoktu.

### Terrain web sunucusu

Hazırlama komutu `.venv` oluşturduktan sonra:

```bash
NAVIGATOR_PYTHON="$PWD/.venv/bin/python" npm start
```

UI'da her senaryo için terrain seçin ve koordinat yorumunu onaylayın. Örnek kabul aralığı: `2026-11-14T00:00`–`2026-11-14T00:10` UTC. Kernel zaman kapsamı sunucuda doğrulanır; kapsam dışında flat fallback yoktur. API terrain için en az 60 saniye adım, en çok 2048 örnek ve 31 gün ister. Aynı anda başka terrain işi varsa `503 TERRAIN_BUSY` döner. Sonuç ve CSV; DEM SHA-256, dört kernel hash'i, model, çerçeve, kadans ve uyarıları taşır.

Önce frontend bağımlılıklarını kurup üretim derlemesini oluşturun; aşağıdaki komutlar iki model için de geçerlidir. Son `npm start` yerine üstteki Python seçimini kullanın.

### Web MVP

Node.js **22.18+ veya güncel 24/26** ve npm kullanın. `navigator-unified` repo kökünde:

```bash
npm --prefix frontend ci
npm run build
npm start
```

Adres: **http://127.0.0.1:4170**. Derlenmiş React ekranı ile API aynı Node sunucusundan açılır. Flat için Python/SPICE/raster gerekmez. Terrain için önce `npm run prepare:science`, ardından aşağıdaki Python seçimi gerekir.

Başka port gerekiyorsa:

```bash
PORT=4172 npm start
```

1. Katalogdan iki konum ekleyin veya özel koordinat tanımlayın.
2. Flat veya terrain seçin. Flat için yüzey kotunu girin ya da bilinmeyen kot için 0 m varsayımını onaylayın. Terrain için ME_DE421 koordinat yorumunu açıkça onaylayın; yüzey kotu DEM’den gelir.
3. 2026-01-01–2026-01-02 UTC veri kapsamı içinde tarihleri ve zaman adımını seçin.
4. Karşılaştırmayı çalıştırın; sonuçları model/kalite uyarılarıyla birlikte okuyun.
5. Metadata CSV'yi indirin.

Düz ufuk varsayımını gerçek arazi sonucuyla karıştırmayın. Eşit konum kıyası için aynı tarih aralığı, zaman adımı, yükseklik varsayımı ve model kullanın. Farklı sürelerde oranlar gösterilse de “en uzun kesinti” gibi mutlak sürelerin aynı soruyu yanıtlamayabileceğini unutmayın.

Production yolunu kullanın. Bu ortamda CRA geliştirme sunucusu `options.allowedHosts[0] should be a non-empty string` hatası vermiştir; çözüm olarak host güvenliği kapatılmamıştır.

## Sonuçları nasıl yorumlamalı?

Beklenen sonuç **karar destek tablosudur**, otomatik iniş tavsiyesi değil:

- Hangi senaryoda Güneş daha uzun süre en az kısmen görünür?
- Disk alanıyla ağırlıklandırıldığında görünürlük ne kadar değişir?
- Dünya merkezi hangi zamanlarda ufkun üzerinde kalır?
- İki koşulun birlikte sağlandığı pencereler ne zaman?
- Güneş/Dünya görünmeme kesintileri ne kadar sürer?
- Sonuç hangi kaynak, çerçeve, çözünürlük ve varsayımla üretilmiştir?

Örneğin yüksek `bothFraction`, yalnız iki geometrik görünürlük koşulunun daha çok çakıştığını gösterir. Batarya kapasitesinin yeterli olduğunu, antenin Dünya'yı izleyebildiğini veya yüzeyin inişe uygun olduğunu göstermez. Sistem birleşik görev puanı üretmez; senaryoları otomatik sıralamaz.

## Doğrulama ve testler

Son MVP doğrulamasında:

| Kontrol | Kaydedilmiş sonuç |
| --- | --- |
| React production build | Uyarısız başarılı |
| UI sözleşme testleri | 4/4 |
| Gerçek HTTP pipeline testi | 1/1 |
| Veri + ephemeris + analiz + kabul yeniden koşusu | 83/83 |
| Chromium production smoke | İki senaryo hesaplama ve CSV indirme başarılı; sıfır `pageerror` |

Bu sayılar farklı koşulardan gelir; önceki test gruplarıyla örtüşür ve toplanmaz. UI testleri kaydedilmiş HTTP fixture'ını kullanır; tek başına astronomi doğruluğunu sınamaz. HTTP ve tarayıcı kontrolleri gerçek entegre hesap yolunu ayrıca çalıştırır.

Paketli referans karşılaştırmasında **78 yön**, **0.1° hedefi** altında **0.00775688093675673° maksimum açısal fark** vermiştir. Bu, test edilen örnekler için kanıttır; her tarih, arazi veya görev koşulu için doğruluk garantisi değildir. Referans yön karşılaştırması ile ara zaman interpolasyon hatası aynı test değildir; raporlar ayrı yorumlanmalıdır.

Temel test komutları:

```bash
npm run test:data
npm run test:ephemeris
npm run test:integration
CI=true npm --prefix frontend test -- --watchAll=false --runInBand
node --test src/features/analysis/tests/*.test.mjs
node --experimental-strip-types --test tests/acceptance/pipeline.test.mjs
```

Gerçek arazi testleri ham raster/kernel dosyalarını ayrıca gerektirir. Dosyalar hazır olduğunda, Bash ortamında:

```bash
mkdir -p /tmp/opencode
python -m venv /tmp/opencode/lunar-registration-venv
/tmp/opencode/lunar-registration-venv/bin/python -m pip install -r scripts/requirements-registration.txt
PATH="/tmp/opencode/lunar-registration-venv/bin:$PATH" TMPDIR=/tmp/opencode node --test tests/horizon.test.mjs tests/visibility.test.mjs tests/terrain.test.mjs tests/lola.test.mjs tests/registration.test.mjs tests/real-workflow.test.mjs tests/integration.test.mjs tests/independent-audit.test.mjs
```

Komutlar ham veriyi otomatik olarak sağlamaz. Dosya yerleşimi ve kökeni için `docs/real-workflow.md`, `docs/registered-workflow.md`, `docs/lola.md` belgelerini izleyin. Eksik veriyle geçen sentetik test, gerçek arazi entegrasyonu kanıtı sayılmaz.

## Sınırlar ve sonraki hedefler

### Bugünkü sınırlar

- Bir günlük paketli gök verisi, mevsimsel veya tam Ay döngüsü analizi değildir.
- Flat ufuk topografik gölgelenme hesaplamaz; terrain LOLA ufkunu kullanır.
- HTTP/CLI terrain hattındaki yaklaşık 7.58 km/piksel LOLA verisi küçük krater, kaya ve yerel tehlikeleri çözemez; hassas kutup iniş planlaması için yetersizdir.
- Küresel Ay ve yerel teğet düzlem yaklaşımı kullanılır; hassas yüzey şekli modeli değildir.
- Güneş diski için yerel düz ufuk yaklaşımı, Dünya için merkez görünürlüğü kullanılır.
- Zaman pencereleri örnek çözünürlüğüyle sınırlıdır; kesin astronomik olay çözücüsü yoktur.
- QuickMap/Moon Trek hedef bilimsel katman incelemesi tamamlanmadı. Dört kaynağın tümü hesapta entegre edilmiş sayılmaz.
- Panel yönelimi/verimi, ışınım ve termal model, batarya, anten yönelimi/kazancı, frekans, link marjı, röleler, eğim/pürüzlülük ve iniş dinamiği yoktur.

### Ulaşılmak istenen sonraki aşama

1. Daha uzun zaman kapsamını kaynaklı ve doğrulanmış vektörlerle sağlamak.
2. Hedef bölgeye uygun çözünürlükte DEM ve doğrulanmış ortak koordinat çerçevesiyle arazi ufkunu web hattına bağlamak.
3. Örnek adımı/interpolasyon etkisini ve ufuk çözünürlüğü belirsizliğini nicel raporlamak.
4. Portal katmanı, ürün kimliği, koordinat ve yükseklik referanslarını uçtan uca doğrulamak.
5. Gerekirse ayrı güç ve iletişim modellerini açık mühendislik girdileriyle eklemek; geometrik görünürlükten doğrudan yeterlilik sonucu çıkarmamak.

Bunlar planlanan geliştirmelerdir, mevcut MVP özelliği değildir.

## Teknik belgeler

- [`docs/architecture.md`](docs/architecture.md): birimler, veri sözleşmeleri, mimari ve model sınırları.
- [`docs/acceptance.md`](docs/acceptance.md): kabul kapıları.
- [`docs/verification.md`](docs/verification.md): komutlar, kaydedilmiş sonuçlar ve tarihsel ara durumlar.
- [`docs/team/05-integration.md`](docs/team/05-integration.md): MVP bütünleştirme sorunları ve çözümü.
- [`docs/sources/usage-status.md`](docs/sources/usage-status.md): kaynakların ayrı erişim/entegrasyon durumları.
- [`docs/sources/portal-inspection.md`](docs/sources/portal-inspection.md): görsel katman doğrulaması ve eksikler.
- [`docs/sources/method-review.md`](docs/sources/method-review.md): yöntem kaynakları ve inceleme kapsamı.
- [`docs/lola.md`](docs/lola.md): LOLA verisi ve çözünürlük sınırları.
- [`docs/registered-workflow.md`](docs/registered-workflow.md): ayrı kayıtlı arazi/gök iş akışı.
- [`src/features/ephemeris/README.md`](src/features/ephemeris/README.md): gök modeli ve doğrulama araçları.
- [`docs/project-instructions/`](docs/project-instructions/): proje şartlarının kopyaları.

**Kısa özet:** gök verisi hedefin yönünü, ufuk modeli önündeki engeli anlatır. Aynı referans sisteminde karşılaştırır, görünürlük sürelerini toplarız. Sonuç görünürlüktür; tek başına enerji, iletişim veya güvenli iniş değildir.
