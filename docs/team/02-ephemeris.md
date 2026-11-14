# Agent 2 — Ephemeris / yerel teslim

## Güncel durum — yargıç onarımı

Ortak repo erişimi var; `feat/lunar-ephemeris-review` dalındaki önceki teslim SHA `84d02a5`. Aşağıdaki erişim/commit yok ifadeleri yalnız başlangıç geçmişidir. Güncel kaynak yapısı frontend/backend; modül bağımsızdır, mevcut backend'e bağlandı iddiası yok. UTC saniyeli Z ve 1–3 kesir basamağı artık kabul edilir. Agent 1 gerçek modül sözleşmesi ve Agent 3 frame sınırı için yeni test/politika eklendi; ayrıntılar `02-ephemeris-judge-fixes.md` içindedir.

## Başlangıç ve koordinasyon

2026-11-14. Başlangıç SHA: yok; yerel Git deposu henüz commit içermiyor, remote yok. Kullanıcı sonradan yerelde başlamayı ve erişim geldiğinde senkronizasyonu istedi. `git ls-remote https://github.com/kekurttel/Nasa-spaceapps-lunar.git HEAD` iki kez `Could not resolve host: github.com` verdi. Web fetch özel repo için HTTP 404 verdi; bu özel depoya erişim yetkisinin olmadığını kesin kanıtlamaz. AGENTS.md/ortak stack mevcut değil. Kullanıcı dosyaları korunmuştur. Ayrı worktree henüz oluşturulamaz. Commit, push, PR yok. Ortak depo geri gelince başlangıç SHA ve ekip notları okunarak `feat/lunar-ephemeris` izole dalına yalnız sahip olunan yollar taşınmalı, çatışmalar incelenmeli ve testler yeniden çalıştırılmalı. Otomatik arka plan senkronizasyonu kurulmadı.

Ana oturum nasa-sol (önceden kullanıcıya açıklandı); beş alt ajan 9router/nasa/nasa-luna kullandı. OpenCode/9router kullanıldı; duo erişimi doğrulanmadı. Bu model/araç sapmaları giderilmiş gibi sunulmuyor.

## Mimari

Site yeri, Scenario yer + UTC zaman çizelgesini tanımlar. Agent 2 SkySeries üretir; Agent 3 bunu HorizonProfile (arazinin gökyüzüne çizdiği sınır) ile birleştirip VisibilitySeries (zamana göre görünürlük) üretir. Agent 4 bundan AnalysisResult (süreler/değerlendirmeler) çıkarır, Agent 5 ekranda sunar. Agent 1 kaynaklı yer kataloğunu sağlar. Son üç sözleşmenin gerçek tanımları yerelde yok; bu akış varsayımdır, ortak sözleşmeler değiştirilmeyecektir.

- Ben şu sözleşmeyi üretiyorum: SkySeries.
- Ben şu sözleşmeyi tüketiyorum: Site içeren Scenario; kaynak bilgili MoonFixedDataset.
- Benim çıktımı kim kullanacak: Agent 3; Agent 4/5 dolaylı veya doğrudan.
- Ekibe teyit: kuzeyden saat yönü azimut, yerel teğet düzlemine göre irtifa ve eş indeksli UTC dizileri olarak anladım, doğru mu? Ufuk/arazi bu modülde uygulanmıyor.
- Diğer ekip notlarını fetch edip okuma: depo erişimi nedeniyle henüz yapılamadı.

## API hazır

Yollar: `src/features/ephemeris/**`, bu not dışında başka alana yazılmadı; root config/package/lockfile/UI/arazi/katalog değiştirilmedi.

`index.ts`: `computeSkySeries(scenario, dataset?)`, SkySeries, Scenario, Site, MoonFixedDataset, MoonFixedSample, Vector3, EphemerisError.
`coordinates.ts`: localSkyDirection, angularRadiusDeg.
`scenario.ts`: buildScenarioTimes, ScenarioError.
`vectorData.ts`: sampleMoonFixedVectors, EphemerisVectorError.

```ts
import { computeSkySeries } from './src/features/ephemeris/index.ts';
// real-moon-vectors.json içeriğini uygulamanın kendi JSON yükleme yöntemiyle al.
const result = computeSkySeries({
  id: 'equator-demo',
  site: { id: 'custom', name: 'Equator', latDeg: 0, lonDeg: 0,
    surfaceElevationM: 0, observerHeightM: 2, kind: 'custom', sourceIds: [] },
  startUtc: '2026-01-01T00:00:00.000Z',
  endUtc: '2026-01-01T02:00:00.000Z', stepSeconds: 3600,
}, realDataset);
// timesUtc ve bütün açı dizileri: 3 eleman; quality.dataKind === 'real'.
```

Sadece `.sssZ` milisaniye kesinlikli UTC senaryo tarihleri kabul edilir; çıktı normalize ISO'dur. Başlangıç dahil, bitiş yalnız adım ızgarasına denk gelirse dahil. Maksimum 100000 örnek. Dataset olmadan EPHEMERIS_DATA_UNAVAILABLE; örtük sahte veri yok. Paketli gerçek demo verisi 2026-01-01 00:00Z–2026-01-02 00:00Z, saatlik 25 örnek; çalışma anında ağ gerekmez. Test verileri ayrı ve synthetic etiketlidir.

## Bilimsel yaklaşım ve sınırlar

Tek üretim yaklaşımı: kaynaklı önhesaplanmış Ay-sabit Kartezyen vektörler (bir cismin üç eksendeki uzaklığı), ardından gözlemci konumunu çıkarma ve yerel kuzey/doğu/yukarı dönüşümü. Dünya paralaksı (bakılan yer değişince yönün değişmesi) bu çıkarma ile uygulanır. Yüzey ve gözlemci yüksekliği metre, vektörler km; Ay yarıçapı 1737.4 km. Negatif yüzey kotu geçerli, toplam gözlemci yarıçapı pozitif olmalı; bilinmeyen kot 0 varsayılır ve uyarılır. Tam kutup reddedilir. Azimut [0,360), irtifa derece. Güneş yarıçapı asin(695700 km / gözlemci uzaklığı).

Frame (koordinat eksenlerinin tanımı) IAU_MOON; MOON_ME/PA ile eşdeğer değildir. Gerçek demo pck00011.tpc yönelim modeli ve libration (Ay'ın yönelimindeki salınım) terimlerini kullanır; yüksek hassasiyetli DE440 ikili yönelim modeli olduğu iddia edilmez. Agent 1/3 LOLA ME koordinatlarını dönüşümsüz bağlamamalı; ortak frame kararı gerekli. UTC -> ET/TDB (hesapta kullanılan zaman ölçeği) dönüşümü SPICE str2et ile yapılır; sabit saniye eklenmez. Tarayıcı yalnız UTC indekslerini Date ile okur; artık saniye ':60' reddedilir. Light-time (ışığın yol süresi), aberration (gözlemci hareketinin görünür yöne etkisi) ve atmosferik kırılma uygulanmaz; geometric/NONE seçimi açıkça saklanır. Horizons karşılaştırması airless apparent olup bu tercih farkları ölçülen farka dahildir. Arazi ufku ve gölge yok.

Doğrusal ara değer hesabı mevcut; hatası örnek aralığına bağlıdır ve saat arası doğruluk ölçülmedi. Metadata'daki real etiketi fiziksel kaynağı bildirir, doğruluk sertifikası değildir. Her kullanıcı dataset'inin doğruluğu ayrıca sınanmalıdır.

## A–G kaynak erişim kanıtı

[A] Başarılı: Horizons canlı API Güneş COMMAND=10 ve Dünya COMMAND=399, CENTER=500@301, 2026-01-01 00:00Z; HTTP 200. Ay merkezindeki RA/DEC (gökyüzündeki ekvator yön açıları): Güneş 18h44m05.36s / -23°03′40.8″; Dünya 16h14m06.51s / -26°20′18.7″. Ay merkezinde yerel ufuk tanımsızdır; bu değerler yüzey azimut/irtifası diye sunulmaz. Yüzey için coord@301 ile ayrıca 6 sorgu, HTTP200 ve 18 satır alındı. Ham gövdeler, ilk 5 satır ve tüm parametreler fixtures/horizons-reference.json'da. Ekvator 00:00Z Güneş az/alt 92.503437°/57.455366°, Dünya 190.988776°/83.288323°.

[B] Manuel web arayüzü indirmesi denenmedi; canlı API başarılı olduğu için yedek yol gerekmedi. Ön hesaplanmış API CSV tablosu JSON içindeki table alanlarında saklandı (6 tablo × 3 satır). Manuel indirilmiş CSV olduğu iddia edilmez.

[C] Başarılı: NAIF de440s.bsp 32726016 byte, pck00011.tpc 131226 byte, naif0012.tls 5257 byte indirildi ve gerçek SPICE hesabında kullanıldı. İlk de440s denemesi 120 s timeout; retry başarılı. de440.bsp HEAD ayrıca HTTP200, 119799808 byte; küçük kernel yeterli olduğu için büyük dosya indirilmedi. SHA256 kanıtı fixtures/kernel-report.md. Kernel'ler yalnız onaylı temp dizininde, Git'e eklenmedi.

[D] Skyfield kurulu değil: `py -m pip show spiceypy skyfield` ilk kontrolde `Package(s) not found`. Skyfield kurulumu/hesabı denenmedi; alternatif olarak spiceypy 8.4.0 ve numpy 2.5.4 temp hedefe kuruldu ve çalıştı. Skyfield erişilemez denmiyor.

[E] Ön hesaplanmış set kontrolü: Ridgeline web/public/data/ephem_meta.json HEAD HTTP200. MOON_ME/CN+S modeli mevcut IAU_MOON/geometric sözleşmeye uymadığından içeri alınmadı; gerçek demo kendi NAIF hesabımızdan üretildi. Başka projenin verisi/lisansı kopyalanmadı.

[F] Repo içi motor yok: yerelde başlangıçta sadece agent2.md, son.md, idea.md ve boş .git vardı. Referansların ilgili kaynakları uzaktan okundu: lmNasa lunanav/ephemeris.py (Skyfield ME frame, apparent), lunar-navigator src/lib/ephemeris.ts (Astronomy Engine IAU eksenleri), Ridgeline pipeline/ephemeris.py (SPICE MOON_ME CN+S). Kaynak kod kopyalanmadı; README doğruluk iddiaları kendi ölçümümüz sayılmadı. Ridgeline pending testleri geçti sayılmadı.

[G] Ağ bütünüyle kapalı değil: Node fetch Horizons, raw GitHub ve NAIF çalıştı; curl NAIF LSK HEAD HTTP200. Git transport github.com DNS hatası verdi; web fetch özel repo HTTP404. Genel ağ kesintisi iddiası geri çekildi. Özel repo yetki kontrolü tamamlanmadı.

## Test ve teslim

- `node --experimental-strip-types --test src/features/ephemeris/tests/*.test.ts`: 23 test, 23 geçti, 0 başarısız.
- `py -m unittest src.features.ephemeris.tests.test_export_vectors -v`: 4 test, OK; mock SPICE ile CLI davranışı, gerçek bilimsel doğruluk testi değil.
- `node src/features/ephemeris/tools/fetch_horizons.mjs`: Saved 6 queries; 18 rows.
- `node --experimental-strip-types src/features/ephemeris/tools/validate_reference.ts`: 18 yön, maksimum 0.00775688093675673°, hedef 0.1°, passed true. Fark gök yönü birim vektörleri arasındaki açıyla ölçüldü; yalnız azimut farkına dayanmaz. Ayrıntılar fixtures/validation-report.json.
- Node v24.22.0 yerel type stripping kullanıldı; TypeScript statik derleyici/linter ve ortak uygulama build'i yok, bu kontroller yapılmadı.
- İlk koordinat tesliminde metre/km hatası bulundu, alt ajana geri gönderildi; /1000 düzeltmesi ve 1000 m -> tam 1 km uzaklık regression testi sonrası kabul edildi. Senaryo import .js hatası .ts yapılarak düzeltildi.
- Alt ajanlar: koordinat 4 test; veri okuma 4 test; senaryo 9 test; Python araç 4 test; gerçek veri 25 örnek finite/schema kontrolü. Her biri yalnız ayrılan dosyalara yazdı, commit atmadı. Dosyalar ana oturumda okunup toplam testler yeniden çalıştırıldı.

Kalan: ortak repo senkronizasyonu/ekip teyidi, ME terrain frame entegrasyonu, daha geniş tarih ve ara-zaman referans ölçümü, uygulama derlemesi. Gerçek gökyüzü yolu mevcut ve offline çalışıyor; tüm proje tamamlandı iddiası yok. PR URL yok.
