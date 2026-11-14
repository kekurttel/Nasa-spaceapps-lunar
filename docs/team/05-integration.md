# Acil MVP bütünleştirme

## Takılan yerler

Uygulama agentı bilimsel modülleri HTTP/UI hattına eksik bağladı. SiteRecord türü, açık flat model, UTC regex, sonuç site adı, CSV durumu ve boş koordinat doğrulaması düzeltildi. UI testleri eski doğrudan hesaplama hattını bekliyordu; HTTP fixture ile sözleşme testine çevrildi. Gerçek hesaplama ayrı HTTP ve Chromium smoke ile kontrol edildi.

CRA dev sunucusu `options.allowedHosts[0] should be a non-empty string` hatası verdi. Güvenlik kontrolü kaldırılmadı; production build aynı Node sunucusundan servis edildi.

## Kanıt

- Production build uyarısız.
- UI 4/4; HTTP 1/1; veri/ephemeris/analiz/kabul yeniden koşusu 83/83.
- Chromium: iki katalog konumu, açık kot varsayımı, karşılaştırma ve metadata CSV; sıfır pageerror.
- Yerel smoke ekranı `/tmp/opencode/lunar-mvp-smoke.png`.

## Sınırlar

Web yalnız flat ufuk ve 2026-01-01–2026-01-02 paketli vektör kapsamı. Harita şematik. Portal hedef katman doğrulaması eksik. Güç, iletişim ve iniş güvenliği garantisi yok. Büyük raster ve kernel dosyaları commit dışında; CLI bunları ayrıca gerektirir. Varsayılan dala merge yapılmaz.
