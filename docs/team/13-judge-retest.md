# Yargıç raporu yeniden doğrulama — 2026-11-14

Temel: `e744dc637f78546efd5a0c2e6f638499fcb6cbd3`. İncelenen HEAD: `4171809a65d1d1b99a94bf25247e1e8faca1ca3b`; aşağıdaki düzeltmeler çalışma ağacında, commit/push yapılmadı. Kaynak: çalışma alanındaki `YARGIC-2026-11-14.md`. Eski 43/100 puanı güncel değerlendirme değildir; yeni puan üretilmedi.

## Şartname incelemesi

- Web tek Node API hattını kullanıyor; flat gök ve kayıtlı terrain açık ayrı modeller. Terrain için Python SPICE/DEM adaptörü mevcut; eski bağımsız Python hesap servisine sessiz dönüş yok.
- UTC saniye/milisaniye, kuzeyden saat yönünde azimut, yarı açık zaman ağırlıkları, kapsam dışı hata, frame/yükseklik/kaynak doğrulama regresyonları geçiyor. 25 uç örnekli 24 saat aralığı 86400 saniye; uç örnek fazladan saat eklemiyor.
- Terrain dahil tüm Node testleri gerçek yerel veri ve `.venv` ile çalıştı; skip yok. Diğer agentın varsayılan Python ile terrain testi atlaması bu koşuyu geçersiz kılmaz.
- Bağımsız tarihler, custom koordinatlar, playback, CSV mevcut. Aynı katalog konumunu iki farklı tarihle eklemek UI tarafından hâlâ engelleniyor.

### Bu tur düzeltilenler

1. Senaryo girdisi veya yükseklik onayı değişince eski sonuç, CSV ve playback temizleniyor. Çalışan isteğin girdileri değişirse eski yanıt sonuçları geri getiremiyor.
2. Yeniden hesaplama başında CSV temizleniyor; başarısız istek önceki indirmeyi bırakmıyor.
3. Moon Trek API açıklaması düzeltildi: metadata erişimi, uygulamada tile render/hesap entegrasyonu gibi gösterilmiyor. Hedef projeksiyonu doğrulanmış değil.

## Standart incelemesi

İki bağımsız Luna salt okunur incelemesi yapıldı. Doğrulanmış yeni bir repo kod standardı ihlali bulunmadı. Polar adaptörlerde projeksiyon sabitleri ve provenance doğrulama tekrarları bakım riski; otomatik bilimsel refactor bu tur yapılmadı. Agent katkıları parent tarafından test edildi; tarihsel görevlendirme şartı tamamlandı. Kaynak NAIF/PDS belgelerindeki ham whitespace korunuyor.

## Kanıt

- Node: `183/183`, `0 fail`, `0 skipped`; log `/tmp/opencode/judge-current-tests.log`. Komut: `.venv/bin` PATH başında ve `NAVIGATOR_PYTHON=$PWD/.venv/bin/python` ile `node --experimental-strip-types --test src/features/data/tests/*.test.mjs src/features/ephemeris/tests/*.test.ts src/features/analysis/tests/*.test.mjs tests/*.test.mjs tests/integration/*.test.mjs tests/acceptance/*.test.mjs`.
- Python: `.venv/bin/python -m unittest discover -s tests -p 'test_*.py'`: `20/20`.
- React: `CI=true npm test -- --watchAll=false --runInBand` (`frontend`): `11/11`. Yeni üç regresyon: tarih değişikliği, başarısız yeniden hesaplama, girdisi değişmiş bekleyen yanıt.
- `npm run build`: uyarısız başarılı.
- Sayılar farklı koşular; toplam bilimsel doğrulama sayısı olarak toplanmamalı. Bu tur yeni gerçek tarayıcı smoke yapılmadı; önceki smoke kanıtı tarihsel.

## Kalan işler ve sınırlar

- Aynı site/farklı tarih UI karşılaştırması; farklı aralıkların karşılaştırılabilirliği için görünür uyarı.
- Playback döngüsü son örnekten ilkine geçiyor; açık loop göstergesi yok.
- QuickMap hedef katmanı, Moon Trek hedef projeksiyonu bilimsel doğrulanmış değil; şematik harita gerçek raster render değil.
- Katalog frame belirsizliği kullanıcı beyanıyla çözülmüş sayılmaz. DEM/kernel hash doğrulaması konum doğruluğunu kanıtlamaz.
- 3×3, üç UTC polar snapshot süre, kalıcı gölge/PSR veya 18.6 yıl yakınsama kanıtı değil. 20 km kırpılmış ufuk yalnız smoke kabulü.
- Güç, iletişim link bütçesi, iniş emniyeti hâlâ modellenmiyor.

Bu inceleme için commit/push yapılmadı. Önceki `4171809` push isteğinin ağ engeli ayrı açık yayın işidir.
