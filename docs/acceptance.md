# Kabul kapıları — açık demo

## Kapsam kararı

Kullanıcı mevcut veriyle açık demo seçti. Ayrı dal: `feat/lunar-navigator-unified`. İlk koşullu yanıttaki güvenlik/yeterlilik garantisi bilimsel olarak desteklenmediği için reddedildi. Sonraki açık soruda kullanıcı **Sınırlarla yayınla** seçti: testler ve inceleme geçince yalnız ayrı dala commit/push; güç/iletişim/iniş garantisi yok, QuickMap/Moon Trek hedef katman eksikleri görünür. Varsayılan dala push veya otomatik merge yok.

## Demo kabulü

| Kapı | Beklenen kanıt |
|---|---|
| Beş Luna rolü | `docs/team/01-data.md`–`05-integration.md`, rol/API/test notları |
| Tek hesap hattı | adapter gerçek modülleri import eder; eski Python modeli sessiz yedek olmaz |
| Konum doğrulama | koordinat/saat/yanlış giriş testleri, null kot korunur |
| Gerçek gök kapsamı | paketli kaynak ve tarih görünür; kapsam dışı açık hata |
| Düz ufuk açıklığı | açık seçim; terrainmiş gibi etiketlenmez; karma veri niteliği korunur |
| Gerçek terrain kapısı | DEM etiketi, ham dosya hash, referans ve observer eşleşmesi; strict reddi |
| Zaman ağırlığı | son kısa aralık ve sıfır süreli bitiş testi, toplam süre pencereye eşit |
| 2–4 karşılaştırma | bağımsız yer/tarih, tek üstünlük skoru yok |
| Çıktı | UTC/süre birimleri, kaynak/model/kalite/adım uyarılarıyla CSV |
| Oynatma/grafik | seçili zaman ile Güneş/Dünya yönleri aynı indeks; hata eski sonucu temizler |
| UI | production build + gerçek Chromium smoke; yalnız unit test yetmez |
| Kaynak dürüstlüğü | erişim/indirme/entegrasyon/doğrulama ayrı; dört kaynak kapısı açıkça raporlanır |
| Yayın | insanın desteklenebilir sınırlarla teyidi, başarılı test/kapsam/secret kontrolü; yalnız ayrı dal |

Gerçek harita portal katmanı veya yüksek çözünürlüklü terrain kapısı kapanmazsa demo için eksik yazılır; tüm proje tamamlandı denmez.

## Güvenlik/yeterlilik kapsam dışı

Şu girdiler/modeller olmadan garantili karar verilemez:

- Panel eğimi/yönü, sıcaklık/verim, gölge dağılımı, yük profili, batarya kapasitesi ve termal model.
- Anten geometrisi/kazancı, verici gücü, bant, kayıplar, alıcı/yer istasyonu erişimi ve link bütçesi.
- Yüksek çözünürlüklü eğim/pürüzlülük, krater/kaya tehlikeleri, iniş aracı kısıtları, navigasyon belirsizliği ve bağımsız görev doğrulaması.

Eksik durum `bilinmiyor/doğrulanmadı` olmalıdır. Haritada yeşil görünürlük boyası güvenli iniş alanı anlamına gelmez.
