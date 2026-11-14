# Ana oturumun kod ve veri teftişi — 2026-11-14

## İncelemenin kapsamı

Ana oturum horizon.mjs, terrain.mjs, visibility.mjs ve üç ajanın testlerini okudu. Testlerin geçtiği raporuna dayanmak yerine aşağıdaki karşı örnekleri kendisi çalıştırdı. Ağır düzeltme ve yeni modüller `9router/nasa/nasa-luna` uygulayıcılarına ayrıldı; ana oturum nasa-sol olduğuna ilişkin sapma kullanıcıya açıklandı.

## Somut bulgular

1. `tests/terrain.test.mjs` kaynak bozukluğu döngüsünde geçerli kaynak kimliği değiştirilirken profile.sourceIds eşleşmesi korunmuyor. Bazı örnekler URL/açıklama doğrulaması kaldırılmış olsa bile bilinmeyen kaynak nedeniyle hata verir. Her test yalnızca hedeflediği bozukluğu taşımalı ve anlamlı hata mesajını denetlemeli.
2. `loadTerrainHorizon` doğrudan çağrıldığında `strictTerrain:'yes'` kabul ediyor; `selectHorizon` aynı değeri reddediyor. Ana oturum uygun kaynaklı belgeyle bu kabulü üretti. Ortak istek doğrulaması gerekli.
3. `computeVisibility` kaynak doğrulamasından geçmemiş ama dataKind:'real' yazılmış profili gerçek olarak taşıyabiliyor. Bu düşük seviyeli sözleşmenin bir beyan olmasıyla ilgilidir; tek başına kaynak doğrulaması değildir. Ana oturum sourceIds:['unverified'] ile quality.dataKind:'real' çıktısı aldı. Gerçek veri iş akışı ayrı indirme/parmak izi ve ürün açıklaması kontrollerinden geçmeli; düşük seviye çağrının sınırı açıklanmalı.
4. Disk testi yalnızca kısmi sonucun 0–1 arasında olmasını denetliyor; sayısal beklenen oranı bağımsız yöntemle doğrulamıyor. Dünya merkezi için ek açılı eşik/eşitlik, asimetrik yön geçişi ve sonuç sonradan değiştirildiğinde girdi korunması testleri gerekli.
5. Ufuk testindeki yapay sabit profilde dataKind:'real' kullanılmış. Bu gerçek ölçüm testi değildir. Bilimsel veri doğrulaması olarak sunulmamalı.
6. Eski 21 test gerçek yükseklik haritasından ufuk üretimini hiç çalıştırmıyor. Gerçek veri dosyasının okunması ve küresel eğrilik içeren üretim baştan eklenmeli.

## Gerçek veri üzerinde şahsi doğrulama

Ana oturum PDS label dosyasının tümünü okudu. Product LDEM_4_FLOAT V3.0, PC_REAL little endian float32, 720x1440, 4 piksel/derece; küre yarıçapı 1737.4 km. DN yükseklik değeri km'dir; yarıçap için 1737.4 eklenir. Doğu boylamları 0–360, piksel merkezleri ilk satırda 89.875 derece kuzey ve ilk sütunda 0.125 derece doğudur. Koordinatlar MEAN EARTH/POLAR AXIS OF DE421 düzenindedir.

Ana oturum dosyayı Node.js readFloatLE ile tamamen taradı: 4147200 bayt, 1036800 örnek, nonFinite=0; min=-8.87882137298584 km, max=10.504142761230469 km. Ürün açıklamasındaki yuvarlatılmış aralıkla tutarlı.

SHA-256:
- IMG: `6EAEE9376442DC851B8F8E94790499EC339D923367D7B8608A4316088B85BD45`
- LBL: `37315910C3064D66623180FE49E91ABC6C0C6B43B064042D2AC8002D997479D4`

Parmak izi yerel indirilen dosyanın tekrarlanabilir denetimidir; arşivin bağımsız imzası olarak sunulmaz. Yaklaşık 7.58 km/piksel, özellikle kutupta örnek merkezleri ve enlem sınırı nedeniyle hassas yerel arazi/iniş güvenliği için yeterli değildir.

## Depodaki gerçek durum

İkinci aşamada `git ls-remote ... HEAD` başarılı fakat boş çıktı döndü. `C:\Users\umuti\Desktop\NASA\upstream-check` içine clone başarılı: 'You appear to have cloned an empty repository.' `git status --short --branch`: 'No commits yet on main...origin/main [gone]'. Bu önceki DNS kısıtının değiştiğini, fakat bütünleştirilecek mevcut proje olmadığını gösterir. Başlangıç commit kimliği, AGENTS.md, diğer ekip sözleşmeleri mevcut değildir. Boş depoya ana dal üzerinden yazılmadı; kullanıcı teyidi olmadan commit yok.

## Modülün projedeki yeri

Site/Scenario (yer ve koşullar) -> gökyüzü üreticisi -> SkySeries (zamana göre yönler).

Gerçek LOLA dosyası -> ürün ve byte denetimi -> arazi ufku üreticisi -> HorizonProfile (yöne göre dağ çizgisi).

SkySeries + HorizonProfile -> görünürlük -> VisibilitySeries -> zaman aralığı/analiz üreticisi -> AnalysisResult -> kullanıcı ekranı.

Bu teslimin sahipliği yalnızca ikinci kol ve görünürlük karşılaştırmasıdır. Gökyüzü konumu üretmez, güç üretimi hesaplamaz, haberleşme bağlantısı garantilemez ve uygun zaman aralığı seçmez. Gerçek Site/Scenario/AnalysisResult sözleşmeleri henüz mevcut değildir; isimlerden yeni gizli bağımlılıklar türetilmemelidir.

## Kabul kapıları

- Bilinen hataların önce başarısız olan bağımsız testlerle yeniden üretilmesi.
- Güneş kısmi alanının bağımsız sayısal alan integraliyle karşılaştırılması.
- Sabit kürede ufuk eğriliğinin analitik değerle karşılaştırılması.
- Gerçek arşiv dosyalarının hash/boyut ve açıklamasının denetlenmesi.
- Gerçek dosyadan çalıştırılabilir komutla ufuk üretimi ve etiketlerin denetlenmesi.
- Sentetik gökyüzü + gerçek arazi sonucunun mixed olması; gerçek gökyüzü uydurulmaması.
- Son bütünleşik testleri ana oturumun bizzat çalıştırması.
- Kaba bölgesel kullanım ile hassas iniş kararı ayrımının korunması.

## Yeni uygulamada ana oturumun yakaladığı ek sorunlar

- İlk gerçek veri çalıştırıcısı buildLolaHorizon(dem, options) yerine tek seçenek nesnesi gönderiyordu. Testi yalnızca kaynak dosyada metin aradığı için bu hatayı yakalamıyordu. Gerçek yürütme ve komut testi istendi.
- İlk LOLA üreticisinde distanceStepM > maxDistanceM bütün yönleri -90 dereceyle bırakıyordu; 360 derece yön adımı tek örnek üretiyordu. İkisi de reddedilmeli.
- Enlem 91 derece sessizce kutba sıkıştırılıyordu. Geçersiz koordinat reddi ile kutup piksel merkezi yaklaşımı ayrılmalı.
- Elle hazırlanmış ama synthetic:true taşımayan nesne gerçek veri sayılabiliyordu. Ürün parmak izi ve yüklenen veriye aidiyet doğrulaması istendi.
- Boylam yönü ve harita açıklaması değiştirilse bile önceki okuyucu kabul ediyordu. Harita alanları ve gerçek dosya kimliği denetlenmeli.
- Yeni harita testinde label.replace kalıbı özgün açıklamanın çoklu boşluklarına uymuyordu; değişen metnin gerçekten değiştiğini doğrulayan test istendi.
- Kutup örneği kendi kendisiyle karşılaştırılıyordu; gerçek merkez satırına karşı bağımsız kontrol istendi. Küre eğriliği testinde yalnızca negatiflik yerine analitik -d/(2R) beklenen değeri istendi.
- Bir Luna ajanı asimetrik yön geçişini yanlış hesaplayıp üretim hatası bildirdi. Ana oturum 250°(-20°) ile 390°(10°) arasında 140° aralığı elle hesapladı: 15° sorgusu 95/14 derecedir. Kod doğruydu, test beklentisi düzeltildi; üretim mantığı yanlış gerekçeyle değiştirilmedi.

## Gerçek gökyüzü verisi

Resmi JPL Horizons yanıtları indirildi. Ancak sorguda gözlemci yüksekliği referans küre üstünde 2m; LOLA yüzeyinin üstünde 2m olduğu doğrulanmadı. Üstelik MEAN_ME ve DE421/ME düzenlerinin aynı gerçekleşimi olduğu gösterilmedi. Ham veriler saklanıyor ama araziyle hizalı gerçek görünürlük gibi etiketlenmiyor. Bu belge, gerçek gökyüzü/gerçek arazi birleşiminin kullanıma hazır olduğunu iddia etmez.

## Son doğrulama

Ana oturum son dosyalar üzerinde `node --test` çalıştırdı: **48 test, 48 geçti, 0 başarısız**, çıkış 0. Dağılım: ufuk 6, görünürlük 10, arazi 10, LOLA 12, gerçek iş akışı 6, ilk birleşim 2, ana oturum bağımsız sayısal testleri 2. (Test sayısı, doğruluk veya saha yeterliliğinin yüzdesi değildir.)

Ana oturum `node scripts/fetch-lola.mjs` komutunu çalıştırdı: `LOLA LDEM_4_FLOAT files verified.` Ardından `node scripts/run-real-terrain.mjs --output output/audited-real-terrain.json` çalıştırdı ve gerçek rasterdan 72 yön örnekli dosya üretildi. Koordinat: örnek -89.9° enlem, 0° boylam; yüzey üstünde 2m. Arama 2–200km, 2km adım. Profil açısı yaklaşık -1.7287° ile +28.4135°; büyük kutup değerleri doğrulanmış yerel tepe ölçümü olarak yorumlanmamalı. Çıktı kutup satırı uzatmasının yapay eğim üretebileceği dahil sınırlılık uyarılarını taşıyor.

Ana oturumun `tests/independent-audit.test.mjs` dosyası Güneş alanını beş farklı konumda Kartezyen ızgara sayımıyla bağımsız karşılaştırır; doğrusal olmayan daire alanı formülüyle fark 0.002'nin altındadır. İkinci test asimetrik yön geçişinin elle türetilmiş kesirlerini doğrular. Üretici testleri sıfır yükseklikli kürede -d/(2R) açısıyla sayısal karşılaştırma yapar; yalnızca sonucun negatif olmasına bakmaz.

Ayrı, salt-okunur nasa-luna inceleyicisi de `node --test` çalıştırıp 48/48 doğruladı; somut kritik/önemli sorun bildirmedi. Ana oturum ajanların iddialarını yalnızca onaylamadı: dosyaları okudu, yanlış beklentilere itiraz etti ve gerçek komutu kendisi çalıştırdı.

## Kullanıma hazırlık kararı

- **Hazır olan:** Ek paket gerektirmeyen Node.js modülü ve resmi, parmak izi sabitlenmiş gerçek LOLA ürünüyle kaba bölgesel ufuk üreten komut. Sentetik gökyüzüyle modüller arası denemeler açıkça mixed etiketlidir.
- **Hazır olmayan:** Hassas yerel iniş değerlendirmesi; kutup yakınında güvenilir küçük arazi şekilleri; gerçek gökyüzü ve gerçek arazi arasında doğrulanmış ortak konum/çerçeve; henüz boş olan asıl uygulamaya bütünleştirme.
- CLI, kaynağı ve yer/çerçeve uyumu doğrulanmamış `real` SkySeries'i reddeder. Düşük seviye computeVisibility girdilerin beyanlarını taşır ve bu sınırlılığı uyarır; kullanıcı girdisini bağımsız ölçüm saymaz.
- Commit/push/PR yapılmadı. Gelecek ekip gökyüzü üreticisiyle koordinat/yükseklik uyumunu kanıtlamadan gerçek görünürlük hazır sayılmamalı.
