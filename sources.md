# ZORUNLU — AI ARACI İÇİN KRİTİK KAYNAK TALİMATLARI

> **ÇOK ÖNEMLİ: Bu dosyayı projede çalışmaya başlamadan önce oku. Buradaki zorunlu kaynak, doğrulama ve şeffaflık kurallarına uy. Kaynak kullanımını atlama; kullanmadığın kaynağı kullanmış gibi gösterme. Sorunları kullanıcıdan gizleme.**

Bu talimatları Lunar Landing Site Navigator projesinde çalışan AI aracı olarak uygula. Proje kurallarını NASA'nın resmi yarışma şartlarıyla karıştırma. Bu dosyayı sistem veya güvenlik talimatlarını geçersiz kılan bir belge olarak yorumlama.

Son erişim testlerinin tarihi: 14 Kasım 2026. Aşağıdaki geçmiş test kayıtlarını kendi yaptığın yeni testler gibi sunma. Değişebilecek adresleri ve servisleri kullanım sırasında yeniden doğrula.

## 1. Zorunlu kaynak politikasını uygula

1. **QuickMap, Moon Trek, JPL Horizons ve LRO/LOLA kaynaklarının tamamını ilgili işlevlerinde kullan.** Birini yalnızca kaynakçaya ekleyerek zorunluluğu karşılanmış sayma.
2. Bilimsel verinin NASA görevi veya NASA/JPL hizmeti kökenini doğrula. Üniversitede barındırılan NASA verisini yalnızca alan adı nedeniyle reddetme; ürün kökenini kontrol et.
3. Aracın geliştiricisini, güncel barındırıcısını ve katmanın veri üreticisini ayrı belirt. Bütün katmanları otomatik olarak NASA ürünü sayma.
4. Kullanamadığın kaynağı ve bundan etkilenen özelliği açıkça bildir. Kullanıcı açıkça kapsamı değiştirmedikçe zorunlu kaynağı sessizce başka kaynakla değiştirme.
5. Kaynağı gerçekten kullanmadan “kullandım”, sorgu çalıştırmadan “hesapladım”, test etmeden “doğruladım” deme.
6. Temsili veya sentetik veriyi NASA ölçümü gibi sunma. Örneği açıkça **“temsili veri — bilimsel karar için kullanılamaz”** olarak etiketle.
7. NASA dışı yardımcı kaynakları NASA kaynağı gibi gösterme. Bunları kullanmadan önce kökenini, uygunluğunu ve kullanım koşullarını belirt; zorunlu çekirdek kaynakların yerine geçirme.
8. Bu dört kaynağın birlikte kullanımını **kullanıcının proje şartı** olarak belirt. NASA'nın aynı dört kaynağı birlikte zorunlu tuttuğunu iddia etme.

Resmi challenge Resources sayfasında QuickMap, Moon Trek ve Horizons listelendiğini dikkate al. LOLA'nın Details bölümünde teknik öneri olarak geçtiğini belirt. İlk istekteki belirsiz “yasak” sözcüğünden ek, doğrulanmamış kullanıcı kısıtlamaları çıkarma.

## 2. Kaynakları Feynman tekniğiyle anlat — zorunlu

Her kaynak veya sonucu kullanıcıya açıklarken şu sırayı uygula:

1. Ne işe yaradığını günlük dille tek cümlede söyle.
2. Somut bir benzetme kullan.
3. Hangi konum, zaman ve veriyi girdi aldığını belirt.
4. Çıktıyı ve birimini açıkla.
5. Sonucun neyi söylemediğini ve belirsizliklerini belirt.
6. Gerçek veya temsili olduğu etiketlenmiş küçük bir örnek ver.
7. Kısa bir anlama kontrolü yap; takip sorularını yanıtla.

Teknik terimi ilk geçtiği yerde açıkla. Kullanıcının hiçbir sorusunun kalmayacağını garanti etme; anlamadığı noktaları görünür kıl ve açıklamayı sadeleştir.

Büyük resmi şu ayrımla anlat:
- **QuickMap:** “Yer nasıl görünüyor?” sorusuna katmanlı haritayla yaklaş.
- **Moon Trek:** Bölgeyi harita ve üç boyutlu görünümle anlat.
- **LOLA:** Çevredeki tepelerin yüksekliğini ölçüm verisinden çıkar.
- **Horizons:** Seçilen saatte Güneş ve Dünya'nın yönünü hesapla.

Fotoğrafı yükseklik ölçümüyle karıştırma. Güneş'in yönünü bilmenin arada dağ olmadığını kanıtlamadığını açıkla.

## 3. QuickMap kullanımını uygula

- Güncel uygulama adresini kullan: https://quickmap.lroc.im-ldi.com
- Challenge'daki tarihi bağlantıyı kaynak geçmişi için koru: https://quickmap.lroc.asu.edu/

Aday iniş yerlerini görsel olarak incele; LRO/LROC katmanlarını keşfet; bulguları sayısal analizle karşılaştır. LROC'un LRO kamera sistemi, LOLA'nın ayrı bir cihaz olduğunu açıkla.

Kullanıcıya aracı “şeffaf haritaları üst üste koymak” benzetmesiyle anlat. Konumu, katman kimliğini, üreticiyi, çözünürlüğü ve varsa gözlem zamanını kaydet. Görsel gözlemle sayısal ölçümü ayrı sun.

Resmi challenge'ın ASU geliştirme atfını, uygulamanın Intuitive Machines barındırmasına taşınma duyurusundan ayır. Katman üreticisini ayrıca kontrol et.

Koyu pikseli kalıcı gölge kanıtı sayma. Çözünürlüğün göstermediği küçük taş ve çukurlar bulunabileceğini söyle.

**Geçmiş test kaydını doğru yorumla:** HTTP/1.1 tarayıcı denemesinde koordinat/çözünürlük göstergeleri, `Lunar/LROC Visibility Analysis` ve taşınma duyurusu görüldü. Bunu bilimsel katman, ürün indirme veya analiz testi tamamlandı diye sunma.

## 4. Moon Trek kullanımını uygula

Adresi kullan: https://trek.nasa.gov/moon/

Aynı koordinatı aç; bölgeyi incele; kullanılan görüntü/topografya katmanının kökenini kaydet. Varsa yükseklik abartısını ve görünüm ayarlarını belirt. Aracı kullanıcıya “Ay'ın dijital atlası” olarak anlat.

Üç boyutlu görünümü fiziksel görüş hattı hesabının yerine koyma. Ekranda küçük görünen tepenin Güneş veya Dünya'yı engelleyebileceğini açıkla.

**Geçmiş test kaydını doğru yorumla:** Ana JavaScript tam indirildi; değiştirilmeden geçici test önbelleğinden sunulduğunda `Welcome to Moon Trek`, `Start Tutorial`, `Skip Tutorial` görüldü. `Skip Tutorial` tıklandı; ölçek, konum ve metadata kontrolleri bulundu. Başlangıç arayüzünün açılmasını özel katmanların, 3D işlevin veya sayısal analizin doğrulanması sayma.

## 5. JPL Horizons kullanımını uygula

Şu resmi adreslerden yararlan:
- Açıklama: https://ssd.jpl.nasa.gov/horizons/
- Kılavuz: https://ssd.jpl.nasa.gov/horizons/manual.html
- Web uygulaması: https://ssd.jpl.nasa.gov/horizons/app.html
- API belgesi: https://ssd-api.jpl.nasa.gov/doc/horizons.html

Seçilen Ay yüzey noktasından Güneş ve Dünya yönlerini zamana bağlı hesapla. Kullanıcıya “Bu noktada, bu saatte dursam gök cismi hangi yönde olurdu?” sorusunun hesap makinesi olarak anlat.

Terimleri açıkla:
- **Efemeris:** Konumların zamana göre tablosu.
- **Azimut:** Yatayda bakılacak yön; standart tanımda kuzeyden doğuya doğru ölçülür.
- **Yükselim:** Yerel yataya göre yukarı/aşağı açı; gerçek arazi ufkuyla aynı değildir.
- **Gözlemci:** Seçilen Ay yüzey noktası; Ay veya Dünya merkezi değildir.

Sorguya hedef, yüzey koordinatları, referans yüksekliği, zaman ölçeği, tarih aralığı, adım, koordinat sistemi, boylam yönü, birimler ve çıktı türünü açıkça koy; kaydet.

Kimlikleri doğru kullan: Güneş `10`, Dünya merkezi `399`, Ay `301`. `3` değerini Dünya merkezi sanma; bu Dünya–Ay kütle merkezidir. Yüzey gözlemcisi tanımını resmi kılavuzla doğrula.

Ham sorguyu ve yanıtı sakla. Yanıt başlığındaki hedefi, gözlemciyi ve birimleri kontrol et. Anlık geometrik konum ile görünen konumu ayır.

Horizons'ın yerel krater duvarlarını DEM üzerinden kendiliğinden analiz ettiğini söyleme. Dünya görüşünü iletişim bütçesi, Güneş görüşünü panel elektrik üretimi yerine koyma.

**Test sınırını koru:** Resmi kılavuz okundu. Bölüm 12.3'te örnek koordinatla başarılı bir Güneş API erişim testi kaydedildi; bunu projeye ait gerçek iniş yeri sorgusu veya sayısal entegrasyon olarak sunma.

## 6. LRO/LOLA kullanımını uygula

Şu doğrulanmış başlangıç adreslerini kullan:
- NASA açıklaması: https://science.nasa.gov/mission/lro/lola/
- NASA PDS Geosciences arşivi: https://pds-geosciences.wustl.edu/missions/lro/lola.htm

Eski bağlantıya tek başına bağımlı kalma: https://lola.gsfc.nasa.gov/

Yükseklik, eğim ve arazi ufku için uygun LOLA ürününü seç. Lazerin dönüş süresiyle uzaklık ölçüldüğünü, uzay aracının konumuyla birlikte yüzey yüksekliğinin çıkarıldığını basitçe anlat. LOLA'yı kamera olarak tanıtma; açılımını Lunar Orbiter Laser Altimeter olarak ver.

Terimleri açıkla:
- **DEM:** Hücrelerinde yükseklik bulunan sayısal ızgara.
- **Çözünürlük:** Hücrenin temsil ettiği yer büyüklüğü; doğruluk garantisi değildir.
- **Referans yüzeyi:** Yüksekliğin başlangıcı sayılan matematiksel yüzey; deniz seviyesi değildir.
- **NoData:** Geçerli değer yok; sıfır metre değildir.

Ürün kimliğini, sürümü, projeksiyonu, referans yüzeyini, birimleri, ölçeği, NoData değerini ve kapsamayı kontrol et. Koordinat dönüşümlerini kaydet. Kutuplarda yön ve projeksiyon tanımlarını özellikle doğrula.

Her ızgara hücresini bağımsız doğrudan lazer ölçümü sayma; enterpolasyonu kontrol et. Küçük iniş tehlikelerinin çözülemeyebileceğini açıkla. SLDEM gibi birleşik ürünleri yalnızca LOLA verisi gibi sunma; NASA dışı bileşenleri belirt.

**Geçmiş test sınırını koru:** NASA açıklaması HTTP 200/285939 bayt; PDS dizini HTTP 200/34532 bayt verdi. EDR/RDR/GDR grupları görüldü. Bunu belirli DEM'in indirildiği veya doğruluğunun test edildiği şeklinde yorumlama.

## 7. Ortak hesaplama akışını izle

1. Konum ve zaman aralığını belirle.
2. QuickMap/Moon Trek ile bölgeyi incele.
3. Uygun LOLA ürünüyle arazi ufkunu hesapla.
4. Horizons ile aynı konum/zamandaki Güneş/Dünya yönlerini al.
5. Gök cismi yükselimini aynı azimuttaki arazi ufkuyla karşılaştır.
6. Sonucu kaynakları, belirsizlikleri ve kapsam sınırlarıyla göster.

Öğretici örneği **temsili veri** diye etiketle: Güneş merkezi yatayın 3° üstünde, aynı yöndeki tepe ufku 5° ise merkezin engellendiğini anlat; tepe ufku 1° ise merkezin ufkun üstünde olduğunu göster.

Basitleştirilmiş merkez testi olarak şu ifadeyi kullan; tam fiziksel model sanma:

```text
cismin yükselim açısı > aynı azimuttaki arazi ufuk açısı
```

Üretim hesabına Ay eğriliğini/uzak ufku, gözlemci/panel/anten yüksekliğini, cismin açısal büyüklüğünü, yüzey eğimini, DEM kapsamını, koordinat uyumunu ve zaman adımını dahil et. Ay'a Dünya atmosfer kırılması uygulama. Eşitlik veya belirsizlik sınırında kesin görünürlük iddiası yapma.

Güneş görünürlüğünü, panel gücünü, Dünya görünürlüğünü, iletişim yeterliliğini ve iniş güvenliğini ayrı sonuçlar olarak sun. Birini diğerinin garantisi sayma.

## 8. Sorunları hemen bildir — zorunlu

Uyarıyı yalnızca geliştirici günlüğüne yazma. Etkilenen sonucu göstermeden önce kullanıcıya kaynağı, hatayı, etkilenen özelliği, bilinen/bilinmeyen nedeni ve sonraki adımı açıkla.

| Sorun | Yapman gereken |
|---|---|
| Horizons alınamıyor | Yönün alınamadığını söyle; sonuç uydurma; önbelleği tarih ve sorgusuyla ayır. |
| LOLA eksik | Arazi engellenmesinin bilinmediğini söyle; eksik hücreyi sıfır sayma; hesabı durdur veya kapsamı sınırla. |
| Harita açılmıyor | Görsel karşılaştırmanın yapılamadığını söyle; boş ekranı düz arazi sayma. |
| Koordinatlar uyuşmuyor | Verilerin eşleştirilemediğini söyle; birleştirmeyi durdur. |
| Çözünürlük yetersiz | Küçük tehlikelerin ayırt edilemediğini söyle; güvenli iniş garantisi verme. |

Alternatif kaynağa veya eski veriye geçtiğinde bunu belirt. Zorunlu kaynak kullanılamıyorsa işi tamamlandı gösterme. Bilmediğin kök nedeni tahminle kesinleştirme.

## 9. Gerçek kullanım kanıtını kaydet — zorunlu

Aşağıdaki alanları gerçek değerlerle doldur. Bilinmeyeni `doğrulanmadı` bırak; değer uydurma.

```yaml
source_name: doğrulanmadı
provider_and_mission: doğrulanmadı
source_url: doğrulanmadı
product_layer_id_or_full_query: doğrulanmadı
version: doğrulanmadı
retrieved_at_utc: doğrulanmadı
observation_time_and_time_scale: doğrulanmadı
coordinate_frame_and_longitude_convention: doğrulanmadı
vertical_reference_and_units: doğrulanmadı
resolution_coverage_nodata: doğrulanmadı
processing_steps: doğrulanmadı
raw_file_sha256: doğrulanmadı
used_by_code_or_result: doğrulanmadı
citation_usage_terms: doğrulanmadı
validation_and_limitations: doğrulanmadı
```

Görsel keşifte katmanı, konumu ve incelemenin karara etkisini kaydet. Ekran görüntüsünü sayısal entegrasyon kanıtı sayma. Durumları ayrı tut: `planlandı`, `erişildi`, `indirildi`, `entegre edildi`, `doğrulandı`, `engellendi`.

Her üçüncü taraf katmanın kullanım koşulunu kontrol et. NASA ortaklığı veya onayı ima etme. Resmi challenge'ın ABD hükümeti dışı kuruluşları onaylamama ve üçüncü taraf veri koşullarına uyma uyarısını dikkate al.

## 10. Geçmiş erişim teşhislerini dikkate al

Bu bölümü geçmiş test kaydı olarak kullan. Yeni test yapmadan sonuçları güncelmiş gibi sunma. TLS doğrulamasını kapatma, kaynağı doğrulanmamış kök sertifika yükleme veya sistem güvenliğini düşürme.

### 10.1 Challenge: güvenli tarayıcı yolunu kullan

URL: https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/?tab=resources

Şu geçmiş bulguları koru:
- Metin aracı `Transport error` verdi.
- curl çıkış kodu `60`: `SSL certificate OpenSSL verify result: unable to get local issuer certificate (20)`.
- Python: `[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: unable to get local issuer certificate (_ssl.c:1082)`.
- OpenSSL zincirinde `SSL.com TLS Issuing RSA CA R1`, düzenleyici `AAA Certificate Services`; hata `depth=1`.
- Chromium 131, TLS doğrulaması açıkken Resources sayfasından HTTP **200** aldı; canlı içerik okundu.

Bunu HTTP 403, giriş zorunluluğu veya coğrafi engel olarak sunma. OpenSSL istemcilerinin güven yolu kuramadığını, Chromium'un kurabildiğini belirt. Alternatif zincir kaydedilmediği için eksik kökün kimliğini veya sunucu/yerel depo sorumluluğunu kesinleştirme. Tarayıcı erişimini çalışan güvenli yol olarak kullan; curl sorununun sistem düzeyinde düzeldiğini söyleme.

### 10.2 LOLA: çalışan resmi alternatifleri kullan

Yerel geçmiş hatayı koru: `[Errno -5] No address associated with hostname`.

Bağımsız A sorgusunu gerekirse tekrarla:
https://dns.google/resolve?name=lola.gsfc.nasa.gov&type=A

Geçmiş yanıttaki `Status: 0`, `Answer` yokluğu ve `gsfc.nasa.gov` SOA kaydını A sorgusu için NODATA olarak yorumla. NXDOMAIN veya bütün NASA hizmetleri kapalı deme. Bölüm 6'daki HTTP 200 veren NASA/PDS adreslerini kullan; eski alan adının DNS'ini düzelttiğini iddia etme.

### 10.3 QuickMap: HTTP/2 sorununu erişim yasağı sanma

Geçmiş JS/CSS hatasını dikkate al: `net::ERR_HTTP2_PROTOCOL_ERROR`.

Gerekirse yalnızca teşhis tarayıcısında `--disable-http2` kullanarak HTTP/1.1 yolunu dene; TLS doğrulamasını açık tut. Geçmişte bu yöntemle arayüzün açıldığını dikkate al. Hatanın sunucu mu ağ aracısı mı kaynaklı olduğunu kanıt olmadan söyleme.

`networkidle` zaman aşımını tek başına arayüzün açılmadığına kanıt sayma. Görünür öğeleri ve gerekli veri isteklerini ayrıca kontrol et. Güncel adresi ve taşınma duyurusunu tekrar doğrula.

### 10.4 Moon Trek: tam dosya yüklemesini kontrol et

Şu ana JavaScript isteğini incele:
`https://trek.nasa.gov/moon/dojo/dojo.js?v=3.6.29.1-Moon`

Geçmiş tam GET kanıtını koru:

```text
HTTP 200 bytes 5453544 seconds 46.382139
```

Geçmişte dosyanın `/tmp/opencode/moon-dojo.js` konumuna indirildiğini ve HEAD boyutuyla eşleştiğini dikkate al. Geçici dosyanın hâlâ mevcut olduğunu varsayma. Bunu bilimsel Ay verisi değil uygulama JavaScript'i olarak sınıflandır.

Gerekirse teşhis için doğrulanmış indirmeyi değiştirmeden geçici önbellekten sun; diğer kaynakların nereden geldiğini kaydet. Bu testi kalıcı kurulum veya normal tarayıcıyla eksiksiz canlı erişim olarak tanıtma.

Geçmişte görülen `Welcome to Moon Trek`, `Start Tutorial`, `Skip Tutorial`; başarılı tıklama ve `Map Scale`, `Current Mouse Position Coordinates`, `Metadata`, `Product Type` kontrollerini başlangıç arayüzü kanıtı olarak kullan. Katmanların çalıştığını bunlardan çıkarma.

Fontların `net::ERR_ADDRESS_UNREACHABLE` hatasını ve analitik kesilmelerini ana neden diye kanıtsız sunma. Dosyanın yavaş yüklenmesini kalıcı site arızası sayma. İlk yüklemeye yeterli süre tanı; tarayıcı önbelleğinden yararlan; TLS/CORS güvenliğini kapatma.

## 11. Tamamlanma iddiasını sınırla

Aşağıdaki geçmiş durumu esas al; yalnızca yeni kanıtla güncelle:

| Kontrol | Geçmiş durum |
|---|---|
| Challenge Resources canlı metni | Güvenli Chromium HTTP 200 ile okundu. |
| LOLA açıklaması ve arşiv erişimi | İki HTTP 200 ile doğrulandı. |
| QuickMap başlangıç arayüzü | HTTP/1.1 ile açıldı. |
| Moon Trek başlangıç arayüzü | Tam JS indirme ve geçici önbellekle açıldı. |
| QuickMap/Moon Trek belirli bilimsel katmanları | Henüz doğrulanmadı; tamamlandı deme. |
| Belirli LOLA DEM ürünü | Henüz indirilmedi/test edilmedi. |
| Gerçek Horizons proje sorgusu | Henüz çalıştırılmadı. |
| Arazi ufku ve güç/iletişim modeli | Henüz uygulanmadı. |

Gerçek katman/veri testleri için hedef bölgeyi, tarihi ve ürünü belirle. Dokümantasyon oluşturmayı veya site açılmasını bilimsel entegrasyon sayma. Commit/push yapmadıysan yaptığını söyleme.

## 12. Veri alma protokolünü uygula — zorunlu

### 12.1 Portal ile veri servisini ayır

QuickMap ve Moon Trek'i öncelikle keşif ve görsel karşılaştırma için kullan. Portalın HTML sayfasını, ekran görüntüsünü veya uygulama JavaScript'ini bilimsel veri dosyası sanma. Sayısal kullanım için katmanın metadata kaydından belgelenmiş indirme/servis adresini bul. API veya tile URL'si uydurma; tile görüntüsünü yüksekliği kodlayan ürün etiketi olmadan DEM olarak yorumlama. Belgelenmemiş dahili uç noktaya kalıcı bağımlılık kurma.

Her katman için ürün adı/kimliği, üretici, kapsama, çözünürlük, koordinat sistemi, atıf ve kullanım koşulunu kaydet. Aynı ürün iki portalda görünüyorsa bunları bağımsız iki bilimsel ölçüm sayma. Portalın kaynağı kullanma şartını görsel inceleme kaydıyla, sayısal veri kullanımını ürün ve hesaplama kanıtıyla ayrı karşıla.

### 12.2 LOLA ürününü gerçekten al ve doğrula

PDS Geosciences LOLA dizininden uygun GDR/DEM ürününe git. RDR'nin tekil yörünge ölçümleri, GDR'nin ızgaralı ürünler olduğunu ayır. Seçtiğin veri dosyasının beraberindeki PDS3 `.LBL` veya PDS4 XML etiketini ve ilgili ürün dokümanını da indir; etiketi veriyle eşleştir. Dosya adını veya formatını varsayma.

Etiketten piksel tipi, boyutlar, bantlar, byte order, ölçek/offset, özel geçersiz değerler, projeksiyon, referans yarıçap/yüzey ve birimleri oku. Ölçek/offseti etiketin tanımladığı sırada uygula; özel geçersiz değerleri normal sayıya dönüştürmeden maskele. Ürünün yarıçap mı referans yüzeyine göre yükseklik mi verdiğini doğrula. Metre/kilometre dönüşümünü açık yap; referans yarıçapını kanıtsız sabitleme.

Yalnız iniş noktasındaki hücreyi alma; ufuk hesabına yetecek çevre kapsamını seç ve kapsamın neden yeterli olduğunu test et. Daha geniş arazi veya farklı örnekleme ile sonuç değişimini kontrol et. Raster koordinatlarını Dünya EPSG kodlarıyla varsayılan olarak yorumlama. Kutup projeksiyonunu, enlem türünü, doğu/batı boylamını ve 0–360°/−180–180° dönüşümünü belgele. Tam kutupta azimut tanımının tekilliğini ele al.

### 12.3 Horizons için belgelenmiş API'yi kullan

Gerçek GET uç noktası: `https://ssd.jpl.nasa.gov/api/horizons.api`.

API dokümanı: https://ssd-api.jpl.nasa.gov/doc/horizons.html

Ay yüzeyinden azimut/yükselim için başlangıç sözleşmesini şöyle kur; değerleri hedef senaryoya göre değiştir:

```text
format=json
COMMAND='10'                 # Dünya için ayrı sorguda '399' kullan.
EPHEM_TYPE='OBSERVER'
CENTER='coord@301'
COORD_TYPE='GEODETIC'
SITE_COORD='0,-89,0'          # Örnek: boylam derece, enlem derece, yükseklik km.
START_TIME='2026-11-14 00:00'
STOP_TIME='2026-11-14 01:00'
STEP_SIZE='1 h'
TIME_TYPE='UT'
QUANTITIES='4'
APPARENT='AIRLESS'
CSV_FORMAT='YES'
```

Bu bloğu doğrudan URL gibi kopyalama; yorumları gönderme, parametreleri URL-encode et. Bu koordinatı gerçek seçilmiş iniş yeri diye sunma; yalnızca erişim testi için kullan. `SITE_COORD` yüksekliğinin gözlemci referans yüzeyine göre kilometre olduğunu ve DEM'den dönüşüm gerektiğini kontrol et. Yanıtın `Center geodetic`, `Center pole/equ` ve `Center radii` bilgilerini DEM referansıyla karşılaştır; aynı Ay etiketi aynı referans sistemi demek değildir.

HTTP 200'ü başarı için yeterli sayma. JSON `error` alanını, `signature.source`, `signature.version`, `result` alanını ve `$$SOE`/`$$EOE` sınırlarını kontrol et. Başlıklardan doğru hedefi, Ay gözlemcisini, zaman ölçeğini ve azimut/yükselim sütunlarını doğrula. CSV'deki işaret alanlarını sayısal açı sanma. `n.a.` veya eksik satırı sıfırla doldurma. API sürümü beklenenden farklıysa şema uyumunu test et; körlemesine ayrıştırma.

**14 Kasım 2026 ek erişim testi:** Yukarıdaki Güneş sorgusu Python standart kütüphanesiyle TLS doğrulaması açıkken çalıştırıldı. HTTP 200, `signature.source: NASA/JPL Horizons API`, `signature.version: 1.2`, `error` alanı yok; iki veri satırı ve tablo sınırları alındı:

```text
$$SOE
 2026-Nov-14 00:00,*, , 126.635106,     0.960002,
 2026-Nov-14 01:00,*, , 126.127406,     0.967149,
$$EOE
```

Bu çıktıyı uç nokta erişim/sorgu testi olarak sınıflandır; gerçek iniş yeri analizi, Dünya sorgusu veya DEM entegrasyonu diye sunma. Aynı kontrolde API dokümanının sürümü `1.3`, canlı yanıtın sürümü `1.2` idi; bu farkı saklama. Bu örnekte tablo alınması bütün ayrıştırıcıların sürümler arasında uyumlu olduğunu kanıtlamaz.

### 12.4 İndirmeyi güvenli ve tekrar üretilebilir yap

- Kaynak URL'sini ve yönlendirme sonrası son URL'yi, UTC zamanını, HTTP durumunu, Content-Type'ı ve gerçek indirilen boyutu kaydet. HTML hata sayfasını `.img`/`.tif` adıyla kaydetmiş olabileceğini kontrol et.
- İndirmeyi geçici `.part` dosyasına yap; tamamlanma ve içerik kontrolünden sonra nihai ada taşı. Content-Length varsa aktarım biçimini dikkate alarak boyutu karşılaştır; yoksa uzunluk uydurma. Yalnız dosya boyutuyla bilimsel doğruluk kararı verme.
- Yerel SHA-256 hesapla. Yayıncı checksum sağlıyorsa karşılaştır; yalnız kendi hesapladığın hash'i yayıncı doğrulaması diye sunma. Ham dosyayı değiştirmeden sakla; işlenmiş ürüne dönüşüm kaydı bağla.
- Zaman aşımı koy. Geçici ağ/429/5xx hatalarında sınırlı ve artan beklemeli tekrar dene; `Retry-After` varsa uy. 4xx parametre hatalarını aynı sorguyla sonsuz tekrarlama. Güncel servis kullanım politikasını kontrol et; paralel isteklerle servisi zorlama.
- Önbellek anahtarına tam sorguyu/ürün sürümünü, koordinatları, zaman ölçeğini, çıktı seçeneklerini ve işleme sürümünü dahil et. Eski veya farklı sorguya ait yanıtı yeni sonuç diye sunma.
- Tarayıcı CORS engelini kaynak servisinin kapalı olmasıyla karıştırma. Gerekirse uygulamanın kendi backend'ini kullan; rastgele halka açık proxy'ye veri veya kimlik bilgisi gönderme. TLS doğrulamasını kapatma.

### 12.5 Veri alma tamamlanma kapısını uygula

Bir kaynağı sayısal analiz için hazır saymadan önce şu koşulları kontrol et: gerçek veri alındı; etiket/şema okundu; köken ve koşullar kaydedildi; koordinat/zaman/birim uyumu test edildi; eksik/geçersiz değerler ele alındı; dosya veya sorgu tekrar üretilebilir; küçük bilinen senaryoda beklenen davranış görüldü. Sağlanmayan koşulu `engellendi` veya `doğrulanmadı` olarak belirt. Portal açılışıyla bu kapıyı geçme.

## 13. Kaynak planını netleştir ve yardımcı araştırma yap

Her proje bölümünden önce hangi kaynağa hangi iş için gerek olduğunu tespit et. Kullanıcıya her kaynağın ne içerdiğini, ne işe yaradığını ve o bölümde nerede kullanılacağını sade anlat; ardından hedef bölge, tarih, çözünürlük ve çevrimdışı kullanım ihtiyacını sor. Verilmiş yanıtı tekrar sorma; eksik kararı sessizce varsayma.

İndirme mi, web/API erişimi mi, yerel veri dizini veya önbellek mi gerektiğini belirle ve gerekçesini kullanıcıya açıkla. İndirme gerekiyorsa boyut, disk, süre ve kısıtları gizleme. Büyük indirme için onay al. Önerilen yerel düzeni `data/raw/`, `data/processed/`, `data/manifests/` olarak değerlendir; bu adları zorunlu teknoloji tercihi sayma. Ham/işlenmiş veriyi ayır ve büyük dosyaları otomatik Git'e ekleme.

**Yöntemi doğrulamak için web ve bilimsel literatür araştırması yap; bunu ek uygulama rehberi olarak değerlendir, kullanıcıdan gelmiş ayrı bir zorunluluk diye sunma.** Gerektiğinde dört kaynağın ötesinde; ufuk hesabı, kutup aydınlanması, Ay referans sistemleri, DEM doğruluğu ve Dünya görüşü için uygun ek yöntem/verileri araştır. Resmi belgeleri ve birincil yayınları önceliklendir. Aday kaynak için başlık, kurum/yazar, URL/DOI, tarih, yöntem, kapsama, sınırlama ve kabul/ret gerekçesini kaydet. Arama sonucunu makalenin tamamını okumuş gibi sunma; yalnız özete eriştiysen belirt. Bulguları Feynman tekniğiyle anlat. Bu dosyanın araştırma emri içermesini, araştırmanın yapılmış olduğuna kanıt sayma.
