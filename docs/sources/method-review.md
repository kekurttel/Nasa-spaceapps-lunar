# Yöntem ve kaynak incelemesi — 2026-11-14

Bu belge proje şartıdır; NASA'nın dört kaynağı birlikte zorunlu tuttuğu iddiası değildir. Kaynak incelemesi sayısal doğruluk testi yerine geçmez.

## Okunan resmi yöntem özeti

### Lunar Polar Illumination — Erwan Mazarico / NASA GSFC

- URL: https://pgda.gsfc.nasa.gov/products/69
- Erişim: 2026-11-14, canlı ürün sayfası okundu. Makalenin tamamı okunmadı.
- Atıf: Mazarico et al. (2011), *Illumination conditions of the lunar polar regions using LOLA topography*, Icarus 211, 1066–1081, DOI https://doi.org/10.1016/j.icarus.2010.10.030.
- Yöntem: sayfanın açıklamasına göre 240 m/piksel LOLA kutup haritaları, bir saatlik zaman adımı, yaklaşık 18.6 yıllık Ay nutasyon döngüsü boyunca aydınlanma modeli. Daha yeni ürünler 60 m/piksele kadar listeleniyor.
- Referans: kutupsal stereografik projeksiyon, 1737.4 km küre, kutupta gerçek ölçek. Bu bilgi başka ürünün etiketini okumadan ona uygulanmaz.
- Önemli ayrım: sayfadaki Earth visibility ürünleri Dünya diskinin herhangi bir parçası görünürse açık sayıyor. Projemizdeki `earthRule: center` farklıdır. Sayfadaki yüzdeler doğrudan bizim merkez kuralı için doğruluk referansı olamaz.
- Sınırlama: uzun dönem ortalaması belirli iniş tarihi penceresi değildir. Göz yüksekliği, kısa dönem, çözünürlük ayrıca incelenmeli. COG küçük ölçek görünümü ortalama overview hücreleri kullanabilir; görüntüden sayısal değer okumak sakıncalı.
- Kabul: arazi ufku + zaman tablosunu ayrı hesaplama yaklaşımına birincil kurum rehberi olarak kabul edildi. Paketli kaba rasterin hassas güney kutbu iniş analizi olduğuna kanıt olarak reddedildi.
- Koşul: sayfa PDS aydınlanma haritaları kullanılırken Mazarico et al. (2011) atfı istiyor. Bu çalışmada o haritalar indirilmedi/hesap girdisi yapılmadı. Atıf yöntem bağlamı içindir.

### JPL Horizons API

- URL: https://ssd-api.jpl.nasa.gov/doc/horizons.html
- 2026-11-14 canlı doküman okundu; belge sürümü 1.3 (2025 June).
- Resmi uç nokta: https://ssd.jpl.nasa.gov/api/horizons.api.
- `CENTER='coord@301'` gözlemci yüzey koordinatıyla tanımlanır; `COMMAND='10'` Güneş, `COMMAND='399'` Dünya merkezi. `3` Dünya merkezi değildir.
- `QUANTITIES='4'` azimut/yükselim, `APPARENT='AIRLESS'`, açık zaman/birim/koordinat sözleşmesi gerekir. DEM referans yüksekliği ile SITE_COORD yüksekliği körlemesine eşleştirilemez.
- Doküman JSON `signature.version` kontrolü, hata alanı ve tablo kontrolünü açıkça ister. HTTP 200 yeterli değildir.
- `TLIST` en fazla 10000 zaman destekler; ince adımlar için unitless STEP_SIZE ayrımı belgelenmiş. Servisi paralel sorgularla zorlamamak gerekir.
- Bu doküman okuması yeni gerçek proje sorgusu değildir. Gerçek kullanım agentın ham sorgu/yanıt kaydı ve testleriyle ayrıca değerlendirilir.

## Erişim kanıtı ve açık kapılar

`docs/sources/access-2026-11-14.json`: yeni HTTPS erişim denemeleri, URL, zaman, HTTP durumu, bayt, SHA-256 içerir. QuickMap 8160 bayt, Moon Trek 8029 bayt, PDS LOLA 34532 bayt, NASA LOLA 285939 bayt ve HTTP 200. Bunlar HTML dosyalarıdır, DEM değildir. NTRS metadata sayfası bu denemede `The read operation timed out` verdi; PGDA resmi ürün açıklaması güvenli alternatif yöntem kaydı olarak okundu. NTRS makalesinin tamamı okunmuş sayılmaz.

QuickMap ve Moon Trek belirli katman/konum görsel incelemesi bu aşamada doğrulanmadı. İlk kontrolde PATH/cwd içinde tarayıcı bulunmadı; sonra mevcut Playwright Core önbelleği ve Chromium 131 keşfedildi, yeni kurulum yapılmadan güvenli HTTPS tarayıcıyla iki uygulama açıldı. QuickMap Close ve Moon Trek Skip Tutorial başarıyla tıklandı; arayüz kontrolleri kaydedildi. Bu, katman verisinin doğrulanması değildir. Sonraki girişimde QuickMap `net::ERR_NAME_NOT_RESOLVED`, Moon Trek screenshot font bekleme timeout verdi; kaynak alt agentı sınırlı tekrar deniyor. HTML/başlangıç arayüzünü görsel katman incelemesi gibi sunmuyoruz. Kullanıcı mevcut veriyle demo kapsamını seçti; görev yeterliliği/güvenlik garantisi talebi veriyle desteklenemediği açıklandı. Büyük veri indirme onayı yok.

## Basit açıklama

Gökyüzü takvimi el fenerinin yönünü, yükseklik ızgarası önündeki duvarı anlatır. El fenerinin yönünü bilmek duvar olmadığını kanıtlamaz. Uzun yılların ortalama aydınlığı da yarın kaç saat ışık geleceğini söylemez.

```text
Konum + tarih -> gökyüzü açıları (derece)
Konum + yükseklik ürünü -> tepe çizgisi (derece)
Aynı yön ve referans doğrulaması -> görünürlük -> süre (saniye)
```

Sentetik öğretim örneği: Güneş merkezi 3°, aynı yöndeki tepe 5° ise merkez engellenir; tepe 1° ise merkez üsttedir. Bu basit merkez testi tam Güneş diski/panel/iletişim hesabı değildir.
