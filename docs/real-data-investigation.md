# Agent3 visibility: gerçek DEM veri araştırması

## Sonuç
NASA PDS Geosciences Node'dan LOLA GDR ürününün gerçek, global düşük çözünürlüklü float rasteri indirildi: `data/raw/lola_ldem_4_float.img` (4,147,200 byte; yaklaşık 3.96 MiB) ve beraberindeki orijinal PDS3 label `data/raw/lola_ldem_4_float.lbl`. Bu, sentetik/varsayımsal veri değildir. Dosya gerçek sayısal örnekler içerir; ancak **4 piksel/derece (~7.58084 km/piksel)** çözünürlüktedir. Ufuk/LOS görünürlük hesabında yalnızca kaba bölgesel tarama/prototipleme için uygundur; küçük krater, kaya ve yerel ufuk güvenilirliği sağlamaz. 5/20 m kutup DEM'i yerine kullanıldığı iddia edilmemelidir.

## Kaynak ve ürün kimliği
- Ürün: `LDEM_4_FLOAT`, `PRODUCT_VERSION_ID = V3.0`
- PDS data set: `LRO-L-LOLA-4-GDR-V1.0`
- Ürün dosyası: https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/float_img/ldem_4_float.img
- Label: https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/float_img/ldem_4_float.lbl
- PDS LOLA ürün kataloğu/kaynak indeksi: https://pds-geosciences.wustl.edu/missions/lro/lola.htm
- Label'daki açıklama: LRO/LOLA'nın LRO_ES_52'ye kadar aldığı altimetri verileriyle oluşturulmuş şekil/radius haritası; veri aralığı 2009-07-13—2016-11-29; LOLA ekibi/GSFC.

## İndirilen verinin doğrulanması
- Kaynak dizininde `ldem_4_float.img` boyutu 4,147,200 byte olarak listeleniyordu; indirilen dosya boyutu da tam olarak 4,147,200 byte.
- Label: `LINES=720`, `LINE_SAMPLES=1440`, `SAMPLE_BITS=32`; 720×1440×4 = 4,147,200 byte. Ek header/prefix yok (PDS `RECORD_BYTES=5760`, 720 kayıt).
- Yerel little-endian IEEE-754 float32 (`PC_REAL`) ile okuma: 1,036,800 sayı; min `-8.878821`, max `10.504143` (km yarıçap değişimi); örnek `data[0]=-0.119755`, `data[100000]=-0.098806`. Label sınırları min `-8.879`, max `10.504` ile tutarlı.
- Fiziksel yükseklik yorumu: örnek DN, referans küre yarıçapı olan `1737.4 km`'ye eklenir. Böylece ilk örnek yarıçapı `1737.280245 km` olur. Bu, tek başına jeoid/ortalama deniz seviyesi yüksekliği değildir.

## Kodlama ve koordinat referansı (label kanıtı)
- Örnek tipi `PC_REAL`, 32 bit; little-endian IEEE float32.
- `SCALING_FACTOR=1`, `OFFSET=1737.4 km`; label formülü: `PLANETARY_RADIUS = (DN * SCALING_FACTOR) + OFFSET`. `HEIGHT` birimi km olarak verilmiş.
- Grid `SIMPLE CYLINDRICAL`, 4 pix/deg; küresel 720 satır × 1440 sütun, 0–360° doğu boylam, -90°…+90° enlem.
- Referans gövde eksenleri A=B=C=`1737.4 km`; koordinat sistemi `MEAN EARTH/POLAR AXIS OF DE421`, body-fixed rotating. Meridyen/örnek yönü ve piksel merkezleri için ürünün PDS label'ı esas alınmalı (`LINE/SAMPLE_PROJECTION_OFFSET` label'da).
- Label'da nodata/NULL için açık bir özel değer tanımlanmamış; bu rasterın okumasında min/max ve örnekler finite. Üretim iş akışında özel nodata varsayılmamalı; tüm piksel aralığı taranıp non-finite değer varsa geçerli değerlerden ayrılmalı.
- Tek bir ortalama datum yerine referans küre yarıçapı kullanır. Label jeopotansiyel topoğrafyanın `PLANETARY_RADIUS - GEOID_RADIUS` olduğunu, geoid yarıçapının gravite modelinden türetildiğini not eder. Bu ürünün DN değerlerini “sıfır deniz seviyesi” diye sunmak hatalı olur.

## Kullanım/lisans notu
PDS Geosciences Node ürün arşivinde kamuya açık bilimsel veri olarak sunulmaktadır. Kaynak label/ürün atfını koruyun; NASA/PDS markası veya NASA'nın ürünü onayladığı izlenimi yaratmayın. Arşivde bu ürün için ayrı bir açık lisans/SPDX hükmü tespit edilmedi; bu nedenle özel bir lisans (ör. CC-BY) iddiası yapılmıyor. Kullanım ve atıfta ürünün PDS SIS/katalog şartları esas alınmalı.

## İndirme ve sınırlar
İndirme doğrudan HTTPS ile `Invoke-WebRequest` kullanılarak yapıldı; büyük dosya yok, 20 MB sınırının altında. Kaynak küçük ürünün kendisi tam indirildi, dolayısıyla Range/crop gerekmedi. Kaynak label ayrıca indirildi ve byte boyutu/grid ölçüleri ile ikili veri çapraz kontrol edildi. Dosya global düşük çözünürlüklü haritadır; Agent3'ün yerel hassas ufuk analizi için üretime hazır yüksek çözünürlük verisi yerine geçmez.
