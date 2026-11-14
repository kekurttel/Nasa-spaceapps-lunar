# Ara zaman, performans ve aykırı değer incelemesi — 2026-11-14

Bu not 02-ephemeris.md başlangıç ölçümlerini günceller; başlangıçtaki 18 referans/23 test sayıları tarihsel kalır. Son durum: 78 Horizons yönü, 30 Node testi, 4 Python testi.

## Ara zaman doğruluğu

`tools/measure_interpolation.py`: gerçek saatlik NAIF verisinin 24 aralığında her 5 dakikada (05..55), üç konumda, Güneş/Dünya doğrudan SPICE geometric IAU_MOON hesabıyla karşılaştırıldı. 264 ara an × 3 konum = 792 kayıt, her kayıtta iki cisim, toplam 1584 yerel yön. Saatlik değerlerle aynı çekirdek modeline karşı olduğundan bu bağımsız astronomik doğrulama değil; yalnız ara değer hesabının hatasını ayırır.

- En büyük yerel yön hatası: 0.00010179975360847115°.
- Yerel yön hatası yüzde 95: 0.00009793438730919069°.
- En büyük irtifa hatası: 0.00010121847731170419°.
- En büyük azimut hatası: 0.00009311517069932052°.
- Güneş açısal yarıçap hatası: en fazla 0.000002634144410595951°.
- En büyük yerel yön farkı 2026-01-01 00:30Z ekvator Dünya örneğinde; saat ortasında doğrusal yaklaşımın eğrisel hareketi temsil etmesinden doğan fark. Ölçülen değer 0.1° hedefine göre küçük; veri silinmedi veya referansa göre ayarlanmadı.
- Rapor: `fixtures/interpolation-spice-report.json`.

Horizons bağımsız kontrolü 00:00–02:00Z, her 10 dakikada 13 zaman × 3 konum × 2 cisim = 78 yön oldu. `tools/fetch_horizons.mjs` canlı kaydetti; `tools/validate_reference.ts` API sonuçlarını karşılaştırdı. En büyük yön farkı 0.00775688093675673°, 0.1° hedefi altında. Geniş tarih kapsamı için garanti verilmez.

## Büyük görünen farkın ayrıştırılması

`tools/diagnose_residual.py` doğrusal ara değer kullanmadan tam SPICE anlarını aynı Horizons sonuçlarıyla karşılaştırır. Tek seferde yalnız ışık yolu/hareket düzeltmesi değiştirilir:

| Seçim | Güneş maksimum yön farkı | Dünya maksimum yön farkı |
| --- | ---: | ---: |
| NONE (üretim geometrik tercihi) | 0.00775688094° | 0.00227129634° |
| LT+S | 0.00256105773° | 0.00210454961° |
| CN+S | 0.00256105773° | 0.00210434984° |

Ölçüm, Güneş farkının önemli bölümünün geometrik/görünür konum tercihiyle ilişkili olduğunu gösteriyor. Bunun için geometric veri CN+S diye yeniden etiketlenmedi; üretim sözleşmesi değiştirilmedi. CN+S burada Ay merkezinde uygulanıp gözlemci konumu çıkarılır, tam yüzey-gözlemcisi apparent hesabının aynısı değildir. Kalan farkı tamamen frame veya DE440/DE441 farkına bağlamak için ek deney gerekir; kesin neden iddiası yok. IAU_MOON ile ME arazi koordinatlarını karıştırma riski ayrıca devam ediyor.

Dünya ekvatorda irtifa yaklaşık 83.29° iken azimut farkı yaklaşık 0.014° görünüyor, ancak gerçek gök yön farkı yaklaşık 0.0023°. Tepeye yaklaştıkça pusula yönü daha hassastır; aykırı değer diye veri temizlemek yanlıştır. Vektörler arası açı temel doğruluk ölçüsü olarak korundu. Tam zenit/nadir için azimutun sayısal bir atan2 geleneği olduğunu API artık açıkça uyarır.

Rapor: `fixtures/residual-diagnosis.json`. Asıl gerçek veri setinde NaN/Infinity veya uzaklık/süreksizlik kontrol uyarısı yok. Dışarıdan gelen real dataset'lerde temkinli uzaklık sınırları (Güneş 130–170 milyon km, Dünya 300–450 bin km) ve >2°/saat yön değişimi için uyarı eklendi. Bunlar genel kaynak güvenilirliği testi değildir; değerler otomatik değiştirilmez. Kasıtlı aykırı veri testi uyarıyı doğrular.

## Performans

Sorun: her zaman örneğinde bütün kaynak örneklerini doğrulama ve doğrusal tarama. Çözüm: `createMoonFixedSampler` kaynağı bir defa doğrular, değişimden yalıtılmış kopyasını ve sayısal zamanlarını saklar; ikili arama ile aralığı bulur. `computeSkySeries` bunu bir kez oluşturup kullanır. Tek çağrılı eski export korunur. Örnekleme matematiği değişmedi.

`tools/benchmark.ts`: Node v24.22.0 Windows, 25 kaynak örneği, 10000 sorgu, 5 tekrar medyanı; 100 sorguda birebir sonuç eşitliği:

- Her sorguda doğrulama/kopyalama: 811.0463 ms.
- Bir kez hazırlanmış okuyucu: 26.0996 ms.
- Bu sınırlı ölçümde yaklaşık 31.08 kat; bütün uygulama veya eski Git revizyonu benchmark'ı değildir. Önceki yaklaşımın maliyetini koruyan tek-çağrılı wrapper ile yeni tekrar-kullanılan yol karşılaştırılır.
- Ham tekrarlar `fixtures/performance-report.json` içinde. Ana API bir defalık fiziksel kalite taramasını da yapar; bu okuyucu ölçümüne dahil değildir.

## Doğrulama ve kalan işler

30 Node testi geçti, 0 başarısız. 4 Python araç testi geçti. Ana API'nin yanlış biçimde her dataset'e paketli veri doğrulama uyarısı eklemesi düzeltildi; artık doğrulama sağlayıcı/rapor kapsamına bağlı olduğu açık. Birimler, çıktı şekli ve geometric/IAU_MOON tercihleri korunuyor.

Alt ajanların iki Python ölçümünde Windows Unicode kernel yolu ve rapor anahtarı hataları vardı; plan teslimi kabul edilmedi. Ana oturum gerçek Python executable'ını glob ile buldu, SPICE'e ASCII göreli kernel yollarını verdi, anahtarları düzeltti ve iki gerçek ölçümü yeniden çalıştırdı. Son raporlar bu başarılı çalıştırmalardan gelir.

Ortak depo halen senkronize edilmedi; commit/PR yok. Ortak uygulama statik tip derlemesi, ME arazi frame entegrasyonu ve daha geniş tarih testleri henüz yok. Root config veya diğer agent sahipliği değiştirilmedi.
