# Agent 2 — Ephemeris / yerel teslim

## Başlangıç ve koordinasyon

Başlangıç SHA: `e744dc637f78546efd5a0c2e6f638499fcb6cbd3`; dal `feat/lunar-navigator-unified` temizdi. Yalnız sahip olunan modül, ekip notu ve entegrasyon testi yolları değiştirildi; root config, UI, diğer modüller değiştirilmedi. Kaynak `origin/feat/lunar-ephemeris-review`; commit/push yok.

Mevcut ekip notu olarak `docs/team/05-design-review.md` okundu: Agent 5 adapter contract/time playback kapsamı dışında bırakmış; backend görsel kontrollerde yokmuş. Diğer agent notları bu çalışma ağacında henüz mevcut değil. Agent 1 katalog Site/Scenario sağlar; Agent 2 SkySeries üretir; Agent 3 SkySeries + HorizonProfile ile VisibilitySeries üretir; Agent 4 VisibilitySeries analiz eder; Agent 5 arayüzde gösterir. Site ve Scenario şekilleri bu modülde doğrulandı; diğer üretici/tüketici sözleşmeleri notları gelmediği için kısmen geçici kabul edilir.

- Ürettiğim sözleşme: `SkySeries` (eş indeksli UTC anları, Güneş/Dünya azimut-yükselim dereceleri, Güneş açısal yarıçapı, kalite metadata).
- Tükettiğim sözleşme: `Scenario` içindeki `Site` + zaman aralığı; açıkça verilen `MoonFixedDataset`.
- Çıktımı kullanacak: Agent 3 doğrudan; Agent 4/5 sonraki hat üzerinden.
- Ekip teyidi: azimut kuzeyden saat yönünde, yükselim yerel teğet düzlemine göre; arazi ufku bu modülün dışında.

## Gerçek API ve çalışma yolu

`src/features/ephemeris/index.ts` public entry point. `computeSkySeries(scenario, dataset)`; `SkySeries`, `Site`, `Scenario`, `MoonFixedDataset`, `MoonFixedSample`, `Vector3`, `EphemerisError`, `createMoonFixedSampler`, `sampleMoonFixedVectors` export eder. API saf/offline çalışır; kendiliğinden ağ isteği yok, gerçek dataset yoksa `EPHEMERIS_DATA_UNAVAILABLE`, tarih kapsaması dışıysa `EPHEMERIS_OUT_OF_RANGE`; sentetik fallback yok.

Node `--experimental-strip-types` ile modülü çalıştırabilir; bu kurulumda `node --version` ve aşağıdaki test komutuyla doğrula. UI entegrasyonunda yerel HTTP servis gerekiyorsa UI agenti kendi servis komutunu/portunu doğrulamalı; bu modül HTTP servis sağlamaz. CRA TypeScript 4.9 ayarı `.ts` import ve native strip-types ile uyumsuz olabilir; root config değiştirmeden UI build entegrasyonu teyit edilmedi. Node çalıştırma örneği: `node --experimental-strip-types --test tests/integration/ephemeris-contract.test.mjs src/features/ephemeris/tests/*.test.ts`.

## UTC ve örnek sınırı

UTC `Z` tarihleri tam saniye veya 1–3 kesir basamağıyla kabul edilir; normalize çıktı `.sssZ`. Ofset (`+00:00`) ve artık saniye `:60` reddedilir. Başlangıç örneği daima dahil; bitiş yalnız adım ızgarasına hizalanırsa dahil. Örnek: `[00:00:00, 00:00:02]`, adım 1 s → 00, 01, 02; bitiş 00:00:02.5 ise son örnek 00:00:02. Maksimum 100000 örnek.

## Veri, kaynak, doğrulanmış kapsam

Paketli `src/features/ephemeris/fixtures/real-moon-vectors.json` gerçek SPICE/NAIF kernel’lerinden çıkarılmış, IAU_MOON geometrik vektör demo verisi. Ham Horizons yanıtı ve sorgu parametreleri `fixtures/horizons-reference.json`; NAIF kernel erişim/hash kaydı `fixtures/kernel-report.md`. Bundle kapsaması 2026-01-01T00:00:00Z–2026-01-02T00:00:00Z, saatlik ve 25 örnek. Tarih kapsamı karşılaştırma teşhisi `fixtures/date-coverage-report.json`: 14 aylık/tarihli aralıkta 4 site, 288 subdivisions/date; worst reported local direction error 0.00010179975360847115° (threshold 0.1°). Bu diagnostic sweep bundle'ın kapsamını genişletmez, doğruluk sertifikası değildir.

Kaynak vektörlerde frame `IAU_MOON`; `MOON_ME/PA` ile aynı değil. Yüzey yükseklikleri metre; vektör km; yerel açı derece; UTC indeksleri kullanılır. Kernel üretimi `pck00011.tpc` orientation kullanır, DE440s SPK; yüksek hassasiyetli ikili yönelim iddiası yok. UTC→ET/TDB dönüşümü SPICE exporter sırasında; runtime tabloyu UTC indeksler. Linear Cartesian interpolation. Geometric/NONE: ışık süresi, aberration, atmosferik kırılma yok. Yerel teğet ufku yalnız gök yönü referansıdır, arazi ufku değil. Kaynak provenansı dataset metadata ve fixture raporlarında tutulur; NASA/JPL Horizons karşılaştırma sonucu kendi model farklarını da içerir.

## Testler

```sh
node --experimental-strip-types --test tests/integration/ephemeris-contract.test.mjs src/features/ephemeris/tests/*.test.ts
node --experimental-strip-types src/features/ephemeris/tools/validate_reference.ts
```

Son çalıştırma çıktısı: test komutu `node --experimental-strip-types --test tests/integration/ephemeris-contract.test.mjs src/features/ephemeris/tests/*.test.ts` → `ℹ tests 40`, `ℹ pass 40`, `ℹ fail 0`, Node v26.13.0.

`node --experimental-strip-types src/features/ephemeris/tools/validate_reference.ts` CLI olarak gerçekten çalıştırıldı; yalnız modül yükleme değildir. Çıktı: `{"count":78,"maxSeparationDeg":0.00775688093675673,"targetDeg":0.1,"passed":true}`. Script `fixtures/validation-report.json` günceller; ortak çalışma ağacında bu fixture başka kapsamdan geldiği için bu görevde değiştirilmedi.

`docs/team/01-data.md` uyum notu: Agent 1 `Scenario` UTC sözleşmesi saniye ve opsiyonel milisaniyeyi kabul eder; ephemeris girdisi uyumludur. Fark: Agent 1 örnek bütçesi `[start,end)` iken ephemeris grid'e hizalı bitişi dahil eder. UI/Agent 5 adapterı dizileri eşdeğer saymadan önce ortak aralık kuralını Agent 1/2/4 sahipleriyle teyit etmeli. Agent 1 Site datumlarının ve katalog kapsamının efemeris kapsamını kanıtlamadığını da belirtir; bu modül ayrıca `IAU_MOON` koordinat çerçevesi ile bundle tarih kapsamını doğrular.

Yerel Python exporter unit tests: `python -m unittest src.features.ephemeris.tests.test_export_vectors -v` (SPICE davranışı mock; gerçek bilimsel hesap doğrulaması değil). Commit/push yok.
