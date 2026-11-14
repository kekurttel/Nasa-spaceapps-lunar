# 04d2620 sonrası entegrasyon kabulü

## İnceleme isteği

Önceki `04d2620` sınırlı flat demo teslimidir; terrain entegrasyon kabulü değildir. Tarihçe korunur, varsayılan dala merge yapılmaz. Yeni düzeltme aynı `feat/lunar-navigator-unified` dalında hazırlanır.

## Kapanması gereken kapılar

- Eksik ham LOLA ve DE421 ikili dosyaları için resmi URL, beklenen boyut ve SHA-256 ile veri hazırlama.
- Mevcut yerel dosyaların manifest değerleriyle doğrulanması.
- Temiz klonda tek komutla veri hazırlama, Python bağımlılıkları ve gerçek veri testleri.
- Web API'de açık `flat`/`terrain` ayrımı; terrain hesabı mevcut `runRegisteredAnalysis` yoluyla.
- Terrain için DEM'den gelen yüzey kotu, gözlemci yüksekliği, örnek zamanları, kernel hash'leri ve frame kayıt doğrulamalarının korunması.
- `IAU_MOON` paketli DE440s hattı ile `MOON_ME_DE421` terrain hattının dönüşümsüz karıştırılmaması.
- En az iki gerçek terrain senaryosunun analizi ve metadata CSV'si.
- UI kaynak/model/kalite gösterimi, frontend testleri, production build ve gerçek tarayıcı kontrolü.
- Agent5 dalının doğrudan merge edilmemesi; faydalı küçük değişikliklerin önce değerlendirilmesi.

## Kanıt durumu

2026-11-14 kabul sonuçları:

- `node scripts/prepare-data.mjs --verify-only`: altı dosyanın boyut/SHA-256 doğrulaması geçti.
- Temiz snapshot: `/tmp/opencode/lunar-clean-data-_xubeuqx`, `git archive HEAD` üzerine yeni hazırlama dosyaları eklendi. Başlangıçta üç ikili dosya ve `.venv` yoktu. `node scripts/prepare-data.mjs --setup-python --test` resmi URL'lerden 22,708,224 byte indirdi; altı dosyayı doğruladı; yeni ortamda spiceypy 8.0.0/numpy 2.5.4 kurdu; **61 geçti, 0 hata, 0 skip**. Bu kanıt snapshot içindir; henüz yayımlanmamış commitin uzaktan klonlandığı iddia edilmez.
- Ortam: CachyOS x86_64, Node.js 26.13.0, Python 3.14.9, pip 26.2.2. `venv`, pip ve HTTPS gerekir.
- `NAVIGATOR_PYTHON=/tmp/opencode/lunar-registration-venv/bin/python npm run test:integration`: **3 geçti, 0 skip**. İki gerçek SPICE/LOLA terrain senaryosu, 2/5 m gözlemci yüksekliği, dört kernel hash'i, DEM hash'i, CSV kökeni ve geçici dosya temizliği kontrol edildi.
- `node --test src/features/analysis/tests/*.test.mjs`: **9 geçti**. Agent5 seçkisinden yalnız whitespace/formül CSV koruması mevcut Node serializer'a uyarlandı. Unicode, tırnak, virgül, çok satır ve girdiyi değiştirmeme testleri eklendi. Remote commit `e1550ca3c62c333001f7dee65e02a822ffa98a6f` merge/cherry-pick edilmedi.
- `CI=true npm test -- --watchAll=false --runInBand` (`frontend/`): **8 geçti**; flat/terrain beyanı, DEM kotu, frame onayı, kaynak hash'leri, dört karma senaryo ve hata durumları.
- `npm run build`: **Compiled successfully**, uyarı yok.
- Gerçek Chromium, üretim sunucusu `4174`: iki katalog konumu terrain olarak açık koordinat onayıyla `2026-11-14T00:00`–`00:10` UTC aralığında hesaplandı. İki sonuç da `ME_DE421_LOCAL_NORTH_EAST` ve `6eaee9376442dc851b8f8e94790499ec339d923367d7b8608a4316088b85bd45` DEM hash'i taşıdı. CSV indirildi, frame/hash içerdi, **0 pageerror**. Kanıtlar: `/tmp/opencode/lunar-terrain-smoke.png`, `/tmp/opencode/lunar-terrain-smoke.csv`; yerel kanıt dosyaları Git'e eklenmez.

## Korunan sınırlar

LOLA yaklaşık 7.58 km/piksel; yerel iniş güvenliği kanıtı değildir. Terrain koordinatları kullanıcının ME_DE421 beyanıyla yorumlanır; katalog koordinatlarının dönüştürüldüğü veya bağımsız frame doğrulaması yapıldığı iddia edilmez. QuickMap/Moon Trek portal erişimi bilimsel katman entegrasyonu sayılmaz. Güç üretimi, link bütçesi ve güvenli iniş modellenmez. Flat gerçek gök vektörü + sentetik ufuk içerir; terrain bu pakete sessiz fallback yapmaz.
