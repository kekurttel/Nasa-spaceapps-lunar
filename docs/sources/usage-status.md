# Kaynak kullanımı — canlı durum, 2026-11-14

Dört kaynağın birlikte kullanımı kullanıcı proje şartıdır; NASA şartı olduğu ileri sürülmez. `doğrulanmadı` bilinmeyen anlamındadır, sıfır veya başarı değildir.

| Kaynak | Bu oturumdaki yeni kanıt | Durum / sınır |
|---|---|---|
| QuickMap | HTTPS HTML 200, 8160 bayt, hash `access-2026-11-14.json`; başlangıç UI ve sınırlı tarayıcı tekrarı kaydedildi | erişildi; tekrar DOM'u boş bıraktı, hedef/katman/ürün/koşullar doğrulanamadı, bilimsel inceleme engellendi; kanıt `portal-inspection.md` |
| Moon Trek | HTTPS HTML 200, 8029 bayt; gerçek tarayıcıda varsayılan LRO WAC WMTS capabilities 200, bazı karolar 200/404 | erişildi; hedef koordinat/ürün metadata/koşullar/LOLA/3D doğrulanmadı, hedef incelemesi engellendi; kanıt `portal-inspection.md` ve `portal-evidence/` |
| JPL Horizons | İki yeni gerçek erişim sorgusu: Güneş 10 ve Dünya 399, coord@301, 0°E/-89°, 2026-11-14 00:00–01:00 UT | ham yanıt + sorgu manifesti saklandı; tablo/hedef/gözlemci/sütun doğrulandı; proje hedef analizi veya arazi birleşimi değil |
| LRO/LOLA | NASA/PDS HTTPS 200; mevcut Git nesnelerinden gerçek LDEM_4_FLOAT raster + PDS etiket + kernel; bağımsız 56/56 terrain/registration testi | entegre edildi, yerel yazılım/kayıt doğrulandı; yaklaşık 7.58 km/piksel ve kutup ekstrapolasyonu hassas iniş hesabına uygun değil; yeni raster indirilmedi |

## Yeni Horizons kontrolü

Kayıtlar `docs/sources/horizons-access/` içinde. Gözlemci boylamı doğu-pozitif 0°, enlem -89°, referans yüksekliği 0 km. Hedef birimi derece. Zaman UT, 2026 için UTC anlamında. `QUANTITIES='4'`, `APPARENT='AIRLESS'`, `CSV_FORMAT='YES'`. Ay referans yüzeyi ile DEM eşleştirmesi bu testte yapılmadı.

- Sun: HTTP 200, 7870 bayt, signature NASA/JPL Horizons API 1.2, iki satır. 00:00 azimut 126.635106°, yükselim 0.960002°; 01:00 azimut 126.127406°, yükselim 0.967149°.
- Earth: HTTP 200, 8424 bayt, signature NASA/JPL Horizons API 1.2, iki satır. 00:00 azimut 358.774106°, yükselim -3.648805°; 01:00 azimut 358.716465°, yükselim -3.606633°.
- Canlı belge sürümü 1.3, yanıt sürümü 1.2: fark açık. Bu iki yanıtın yapısı doğrulandı; tüm sürümlerde ayrıştırıcı uyumu iddiası yok.
- SHA-256 yerel bütünlük kaydıdır, yayıncı checksum doğrulaması değildir.

## Portal ve cihaz ayrımı

QuickMap katmanlı harita keşfi içindir: şeffaf haritaları üst üste koymak gibi. Güncel barındırma alanı Intuitive Machines; tarihsel challenge adresi https://quickmap.lroc.asu.edu/ ve ASU geliştirme atfı ayrı tutulur. Katman üreticisi/çözünürlük/gözlem zamanı bu oturumda henüz doğrulanmadı. LROC, LRO kamera sistemidir; LOLA ayrı lazer yükseklik cihazıdır.

Moon Trek NASA/JPL dijital atlasıdır: https://trek.nasa.gov/moon/. Aynı hedef koordinatta görsel inceleme henüz doğrulanmadı. 3D görünüm görüş hattı hesabının yerine geçmez.

LOLA lazerin dönüş süresiyle uzaklık ölçer; uzay aracı konumuyla yüzey yüksekliği üretilir. Kamera değildir. DEM hücreli yükseklik ızgarasıdır; hücre çözünürlüğü doğruluk garantisi değildir. Geçersiz hücre sıfır kabul edilmez. Kullanılacak ürünün etiketi projeksiyon, referans yüzeyi, birim, ölçek ve NoData tanımını belirlemelidir.

## Açık engeller

- Kullanıcı mevcut veriyle açık demo kapsamını seçti. İlk örnek Mons Mouton/katalog ve paketli 2026-01-01–2026-01-02; gerçek görev hedefi, hassas çözünürlük ve çevrimdışı kullanım ayrıca kararlaştırılmadı.
- QuickMap/Moon Trek gerçek bilimsel katman incelemesi olmadan dört kaynak kapısı tamamlanmış sayılmaz.
- Yeni büyük veri indirme onayı yok. Git içinde mevcut veri kopyalanması internet indirmesi sayılmaz; boyut ve köken yine belgelenir.
- Gerçek arazi ve gökyüzü ortak yön/yükseklik referansı doğrulanmadan birleştirilmez. Açık düz ufuk seçimi arazi hesabı yerine sunulmaz.
