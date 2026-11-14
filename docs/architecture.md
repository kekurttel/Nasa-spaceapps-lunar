# Tek hesap hattı ve sınırları

Bu bir eğitim/erken değerlendirme aracıdır. NASA onayı, görev sertifikası veya iniş güvenliği iddiası yoktur.

## Akış

```text
Site + Scenario (kaynak, konum, UTC, saniye adımı)
    |                     |
    v                     v
SkySeries             HorizonProfile
(gök yönleri)         (arazi veya açık düz ufuk)
    |                     |
    +------ eşleşme kontrolü ------+
                                  v
                         VisibilitySeries
                         (disk/merkez görünürlüğü)
                                  |
                                  v
                         AnalysisResult
                         (süreler, pencereler)
                                  |
                                  v
                         HTTP adapter ve React ekranı
```

- Agent 1: yer kataloğu ve senaryo doğrulaması; kaynaklı konum gerçek gök verisinin tarih kapsamını genişletmez.
- Agent 2: verilen gerçek vektörlerden yerel Güneş/Dünya yönleri; ufuk engeli hesaplamaz.
- Agent 3: aynı yer/yükseklik/yön referansında gök ile ufku karşılaştırır; Dünya merkezi kuralı ve yaklaşık Güneş diski görünür alanı.
- Agent 4: zaman ağırlıklı süreler ve 2–4 senaryo karşılaştırması; fiziksel enerji veya radyo modeli değildir.
- Agent 5: mevcut React ekranını tek hesap hattına bağlayan adapter; ekran sonuç uydurmaz.

Bölümleri ayrı tutma nedeni: cetvel ile ekranın işleri farklıdır. Ekran değişirken fiziksel hesap testleri aynı kalır. Bedeli, arada kesin birim ve metadata sözleşmesi gerekir. Eski Python/analitik hesap yolunu paralel doğruluk kaynağı kabul etmek iki çelişkili sonuç üretebilir; entegrasyon tek hattı kullanmalıdır.

## Birimler ve sözleşmeler

Site: `latDeg`, doğu-pozitif `lonDeg`, `surfaceElevationM`, `observerHeightM`. Bilinmeyen yüzey yüksekliği `null`; sıfır kot demek değildir. Scenario: `id,site,startUtc,endUtc,stepSeconds`. UTC Z işareti gerekir; yerel saat belirsizliğine izin verilmez.

SkySeries dizileri aynı zaman indeksine hizalıdır; azimut kuzeyden doğuya `[0,360)`, yükselim yerel teğet düzleme göre derece. Güneş yarıçapı açısaldır. Bu yükselim arazi ufku değildir. Paketli gerçek vektör kapsamı 2026-01-01–2026-01-02, IAU_MOON. Başka tarihlerde sonuç uydurulmaz. Geometrik vektörler görünen/apparent konumla aynı değildir; ışık süresi ve aberration farkı açıklanır.

HorizonProfile yer ve gözlemci yüksekliğine bağlıdır. IAU_MOON ile MOON_ME/MOON_PA aynı değildir. Aynı `Ay` etiketi ortak referans kanıtı sayılmaz. DEM'in referans yarıçapı, birimi, NoData ve projeksiyonu etiketten okunmalıdır. Gövde eğriliği ve uzak arazi kapsamı ayrıca önemlidir. Eksik arazi sıfır olmaz. Strict terrain isteği eksikse hata gerekir; yalnız kullanıcının açık düz ufuk seçimiyle flat hesap yapılabilir.

## Görünürlük ve süre

- Güneş: yerel düz siluet kesiti varsayımıyla diskin görünen yaklaşık alan oranı; panel watt değeri değildir.
- Dünya: merkez ufuktan kesin yüksekse görünür. Eşitlik görünür sayılmaz. Dünya diskinin herhangi bir parçasını sayan başka ürünlerle yüzdeler doğrudan karşılaştırılamaz.
- Birlikte: `sunVisibleFraction > 0 && earthVisible`. Batarya, panel verimi, anten, bant, yer istasyonu ve link bütçesi bilinmeden görev yeterliliği sonucu çıkmaz.
- Her örnek `[t_i,t_i+1)` boyunca sabit; son örnek senaryo bitişine kadar. Pencereler yarı açık. Izgaraya hizalı bitiş örneği sıfır süre taşır; süreyi iki kez sayamaz.
- Örnek sayısı oranı değil, gerçek saniye ağırlığı kullanılır. Son kısa aralık özellikle önemlidir. Eksik veya sırasız seri açık hata olmalıdır.
- Örnek geçişi tam astronomik olay anı değildir. Zaman adımı ve model uyarıları sonuçla taşınır.

Sentetik öğretim örneği: 00:00, 01:00, 02:00 örnekleri ve 02:30 bitiş; Güneş oranları 0, 0.5, 1 ise toplam 2.5 saat, Güneşin bir kısmının görünmesi 1.5 saat (%60), eşdeğer disk görünürlüğü 1 saat (%40). Bu örnek gerçek Ay analizi değildir; süre ağırlığının neden gerektiğini anlatır.

## Kanıt kapıları

1. Her modül kendi testlerini geçirir; orkestratör çıktıyı bağımsız yeniden çalıştırır.
2. Adapter alanları ve UTC/frame metadata uyumu bütünleşik testle kontrol edilir.
3. React build + gerçek tarayıcı davranışı ayrıca kontrol edilir; modül testi UI testi değildir.
4. Dört kaynak erişim/indirme/entegrasyon/doğrulama durumları ayrı kaydedilir; HTML erişimi katman incelemesi sayılmaz.
5. İnsan mimari teyidi alınmadan commit yok. Hedef/tarih/çözünürlük ve büyük indirme onayları ayrı kararlardır. Default dala push veya otomatik merge yok.
