# Agent 2 — Yargıç raporu onarımları

Tarih: 2026-11-14. Temel teslim: `84d02a5`. Dal: `feat/lunar-ephemeris-review`.
Kapsam yalnız `src/features/ephemeris` ve Agent 2 ekip notları. Backend, UI, veri ve terrain üretim kodu değiştirilmedi; default dala merge yapılmadı.

## P2: Agent 1 / Agent 2 UTC sözleşmesi

`scenario.ts` saniyeli `YYYY-MM-DDTHH:mm:ssZ` ve 1–3 kesir basamaklı UTC girdileri kabul eder. Çıktı `.sssZ` biçimindedir. Saat dilimi offsetleri, leap second, geçersiz takvim tarihleri ve milisaniyeden hassas girdiler reddedilir. Kabul/reddetme regresyonları `tests/scenario.test.ts` içindedir.

`tests/dataContract.test.ts`, Agent 1'in gerçek `validateScenario` fonksiyonunu Git nesnesindeki bağımlılıksız `validation.mjs` kaynağından yükler. Elle yeniden yazılmış doğrulayıcı veya mock kullanılmaz. Kaynak SHA ve yeniden üretim ayrıntıları `02-ephemeris-data-contract.md` içindedir. Test, kabul edilen senaryoyu paketli gerçek vektörlerle `computeSkySeries` fonksiyonuna verir. Test manifestinin kapsamı paketli verinin kapsamıdır; yeni tarih verisi üretildiği iddia edilmez.

## P2 / süre sınırı

Efemeris tam bitişe denk gelen örneği korur. `sampleDurationsSeconds` yarı açık `[start,end)` destek aralıklarını hesaplar; tam bitiş örneği sıfır süre taşır. 24 saat / 2 saat adım: 13 sınır, toplam 86400 saniye; 26 saat değil. Düzensiz son aralık yalnız kalan süreyi alır.

Agent 1 bütçesi `ceil(duration/step)` durum sayısını, Agent 2 ise tam bitişte ek sınırı sayar. Bu iki sayı eşit değildir. Adapter kaynak bütçesini sınır örneği dahil kontrol etmelidir; Agent 2'nin 100000 örnek üst sınırı korunur. Sınır farkı gizlenmez. Görünürlük olaylarının ara değer hesabı ve `AnalysisResult` Agent 4 sorumluluğudur; destek süreleri tek başına olay doğruluğu kanıtlamaz.

## P1: Başarısız hesapta fallback politikası

`computationPolicy`: `onFailure: 'error'`, `syntheticFallback: false`. Veri yoksa açık hata; örtük analitik/sentetik motor yok. Yeni üçüncü motor yazılmadı. Politika bir entegrasyon sözleşmesidir; mevcut Python backend'i kendiliğinden değiştirmez. Agent 5 adapter ve görünür kaynak/kalite etiketini bağlamalıdır. Backend fallback kusuru bu teslimle düzeltildi diye sunulmaz.

## P1: Ortak frame ve yükseklik

`assertCompatibleTerrain`, yalnız gerçek `IAU_MOON` terrain, `1737400 m` referans küresi ve `radial-above-reference-sphere` yükseklik sözleşmesini kabul eder. Frame farkında `EPHEMERIS_FRAME_MISMATCH`, yükseklik/radius farkında `HEIGHT_REFERENCE_MISMATCH`; eksik metadata ve sentetik girdide `EPHEMERIS_INVALID_METADATA` verir. Girdi değiştirilmez, frame etiketi yeniden yazılmaz.

Mevcut DE421 ME terrain bu kapıdan geçmez. Ölçülmüş ME/IAU dönüşümü yoktur; Agent 3 ile ortak gerçek terrain entegrasyonu tamamlanmış değildir. Kabul edilebilir varsayılan `flat`, yerel teğet ufuktur; gerçek topoğrafya değildir. Metadata kapısının geçmesi bağımsız bilimsel doğrulama sayılmaz. Kapıyı gerçek terrain adapter'ı çağırmalıdır.

## Doğrulama

Commit öncesi ana oturumda yeniden çalıştırılan sonuçlar:

- Node testleri: 49 geçti, 0 başarısız, 0 atlanan. Dört gerçek modül sözleşme testi dahil.
- Strict NodeNext TypeScript kontrolü: exit 0, tanı yok.
- Python exporter unittest: 5 geçti, 0 başarısız.
- Kaydedilmiş bağımsız Horizons referans doğrulayıcısı: 78 yön, maksimum fark `0.00775688093675673°`, hedef `0.1°` altında. Ham sorgular bu onarımda yeniden indirilmedi.
- `git diff --check`: boşluk hatası yok; Windows LF/CRLF uyarıları içerik hatası değil.

Bu sonuçlar tüm uygulama/backend/UI entegrasyon testi değildir.

## Kapsam dışı kalan rapor bulguları

Backend yön/süre/naive-aware tarih hataları, UI alanları/CSV/playback, katalog bağlantısı, AnalysisResult ve tüm uygulama uçtan uca teslimi değiştirilmedi. Bu teslim yalnız Agent 2 sınırlarını düzeltir ve diğer sahiplerin adapter sözleşmesini açıklar.
