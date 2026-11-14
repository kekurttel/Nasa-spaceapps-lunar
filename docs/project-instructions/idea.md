# IDEA.md — Lunar Landing Site Navigator

## 1. Hackathon ve Challenge Bilgisi

•  *Etkinlik:* 2026 NASA Space Apps Challenge
•  *Challenge:* Lunar Landing Site Navigator
•  *Kod / Kategori:* 10 - CLPS
•  *Zorluk:* Advanced / Intermediate
•  *Konular:* Human Exploration, Moon, Software, Space Exploration
•  *İlgili Program:* NASA Commercial Lunar Payload Services (CLPS) ve diğer Ay görevleri

## 2. Bizden İstenen Görev — Detaylı Kapsam

Ay’ın güney kutbuna yapılacak görevlerde aşırı aydınlatma ve iletişim kısıtları vardır. Görev planlaması, bilim ve mühendislik ekipleri arasında dikkatli koordinasyon gerektirir. Sun ve Earth konumlarını aday iniş bölgelerinde belirlemek için araçlar mevcuttur; ancak bu araçların karmaşık arayüzleri, kritik bilgilerin hızlı ve verimli değerlendirilmesini zorlaştırır.

*Bizden istenen:* Görev planlayıcılarının, eğitimcilerin ve halkın iniş bölgelerini ve tarihleri hızlıca karşılaştırabilmesini sağlayan; Sun ve Earth konumlarını ufka göre görselleştirerek güç üretim potansiyelini ve doğrudan Dünya iletişim pencerelerini değerlendirebilen *sezgisel bir araç veya uygulama* geliştirmek.

Çözüm kapsamında aşağıdaki hedefler istenmektedir:

### 2.1 Etkileşimli iniş bölgesi seçimi ve karşılaştırma
•  Kullanıcıların seçili önemli iniş bölgelerinden seçim yapabilmesi:
  •  Geçmiş Apollo görevleri
  •  Gelecek CLPS görev hedefleri
  •  Diğer ticari Ay görevleri
  •  Diğer ülkelerin Ay programlarındaki iniş bölgeleri
•  Kullanıcıların özel Ay koordinatları girebilmesi
•  Birden fazla bölgenin yan yana veya sıralı karşılaştırılabilmesi
•  Ödünleşimlerin hızlıca değerlendirilebilmesi

### 2.2 Tarih ve zaman esnekliği
•  İniş tarihi ve saati seçilebilmesi
•  Koşulların farklı Ay günleri veya mevsimleri boyunca nasıl değiştiğinin incelenebilmesi
•  Görev takvimindeki değişikliklerin fizibiliteyi nasıl etkilediğinin anlaşılabilmesi

### 2.3 Sun ve Earth konum görselleştirmesi
•  Seçilen iniş bölgesi ve tarihte Sun ve Earth konumlarının ufka göre gösterilmesi
•  Sunset veya Earthset’e kalan sürenin gösterilmesi
•  Bu sürenin görev operasyonları ve güç üretim pencereleri üzerindeki etkisinin açıkça sunulması

### 2.4 Güç ve iletişim değerlendirmesi
•  Solar elevation angle gibi temel metriklerin vurgulanması
•  Güneş ışığı süresinin gösterilmesi
•  Earth visibility windows’un gösterilmesi
•  Bölge-tarih kombinasyonunun uygulanabilir olup olmadığının hızlıca değerlendirilebilmesi

### 2.5 Çoklu görselleştirme yaklaşımları
•  2D haritalar
•  3D yüzey görselleştirmeleri
•  İniş bölgesi, Sun ve Earth arasındaki uzamsal ilişkileri anlamaya yardımcı diğer yaratıcı gösterimler

### 2.6 Zamansal dinamikler
•  Sun ve Earth konumlarının bir Ay günü veya birden fazla gün boyunca nasıl değiştiğini gösteren animasyonlar veya zaman çizelgesi görünümleri
•  Operasyonel pencerelerin süresi ve zamanlamasının anlaşılması

### 2.7 Farklı beceri seviyelerine erişilebilirlik
•  Görev planlayıcıları için hızlı karar vermeye yönelik detaylı teknik bilgi
•  Eğitimciler ve halk için Ay’ın neden bu kadar farklı mühendislik zorlukları sunduğunu anlaşılır kılan bir deneyim
•  Arayüzün hızlı site değerlendirmeyi açık ve verimli hale getirmesi

### 2.8 Çözüm formatı
•  Web uygulaması
•  Mobil uygulama
•  Etkileşimli görselleştirme
•  Eğitim oyunu
•  Hızlı site değerlendirmeyi net ve verimli kılan başka bir format

## 3. Dikkate Alınabilecek Hususlar

Bu maddeler challenge metninde “yapılabilir / değerlendirilebilir” olarak belirtilmiştir; zorunlu değildir.

### 3.1 Teknik yaklaşım
•  Ephemeris verileri JPL Horizons System ile hesaplanabilir veya önceden hesaplanmış veri setleri kullanılabilir.
•  Lunar Orbiter Laser Altimeter (LOLA) kaynaklı Ay topografyası verileri, gerçekçi yüzey görselleştirmeleri ve doğru ufuk hesaplamaları için kullanılabilir.
•  Ay’da atmosfer olmadığı için ufuk konumu, yerel arazi ve iniş bölgesinden görülen Ay küresinin kenarı tarafından belirlenir; atmosferik kırılma dikkate alınmaz.
•  Solar elevation angle, güç üretimi için temel metriktir ve belirgin şekilde hesaplanıp gösterilebilir.

### 3.2 Kullanıcı deneyimi
•  Arayüz, hızlı senaryo karşılaştırmasına öncelik verebilir.
•  Sunset veya Earthset’e kalan süre açıkça iletilmelidir.
•  Ay ve Dünya koşulları arasındaki aşırı farklar etkili görselleştirmelerle görünür kılınabilir.
•  Küçük konum veya tarih değişikliklerinin görev fizibilitesi üzerindeki büyük etkileri kullanıcıya gösterilebilir.

### 3.3 Veri ve doğruluk
•  Ay’ın gerçek topografyası dikkate alınabilir; arazi yüksekliği ufuk konumlarını ve görünürlük pencerelerini önemli ölçüde etkileyebilir.
•  Earth’ün libration (salınım) etkisi veya Ay’ın yörünge varyasyonları hesaba katılabilir.
•  Güney kutbu arazisi özellikle karmaşıktır; dik yamaçlar ve derin kraterler aşırı gölge koşulları oluşturur.

### 3.4 Etkileşim ve etki
•  Görev planlayıcılarının bilim ve mühendislik ekipleri arasında koordinasyonunu destekleyebilir.
•  Takvim değişiklikleri veya donanım geliştirme zorlukları ortaya çıktığında ekiplerin iniş tarihi veya konumunu hızlıca ayarlamasına yardımcı olabilir.
•  Öğrenciler ve halk için Ay keşif zorluklarını ve görev planlamasının neden karmaşık olduğunu anlatan eğitim aracı olabilir.

## 4. Veri Kaynakları

### 4.1 NASA Data & Resources

•  *Quickmap*
  •  Arizona State University tarafından geliştirilen etkileşimli haritalama aracı.
  •  NASA’nın Lunar Reconnaissance Orbiter (LRO) verilerinden yüksek çözünürlüklü Ay görüntüleri, topografik veriler ve diğer veri setlerine erişim sağlar.
  •  İniş bölgelerini keşfetmek, araziyi görselleştirmek ve Ay yüzeyini detaylı anlamak için kullanılabilir.
  •  Özellikle güney kutbu bölgelerinin karmaşık topografyasını anlamak için faydalıdır.

•  *Moon Trek*
  •  NASA’nın etkileşimli 3D Ay keşif görselleştirme aracı.
  •  Ay yüzeyini keşfetmeyi, topografik verileri görüntülemeyi ve aday iniş bölgelerindeki araziyi anlamayı sağlar.
  •  Ay konumlarının uzamsal olarak anlaşılması için sezgisel bir arayüz sunar.
  •  Arazinin ufuk konumlarını nasıl etkilediğini görselleştirmeye yardımcı olabilir.

•  *Horizons System*
  •  NASA Jet Propulsion Laboratory tarafından geliştirilen güçlü ephemeris hesaplama aracı.
  •  Ay üzerindeki herhangi bir konumdan Sun ve Earth dahil olmak üzere gök cisimlerinin konum ve hızlarını hesaplar.
  •  Belirli zaman ve konumlarda Sun ve Earth’ün hassas açısal konumlarını elde etmek için kullanılabilir.
  •  Görselleştirmelerin ve güç/iletişim değerlendirmelerinin temelini oluşturur.

•  *LOLA (Lunar Orbiter Laser Altimeter)*
  •  Challenge metninde Ay topografyası verisi kaynağı olarak belirtilmiştir.
  •  Gerçekçi yüzey görselleştirmeleri ve doğru ufuk hesaplamaları için kullanılabilir.


https://eyes.nasa.gov/apps/solar-system/#/home
•  *Önceden hesaplanmış veri setleri / JPL Horizons*
  •  Challenge metninde ephemeris verileri için JPL Horizons System veya önceden hesaplanmış veri setleri kullanılabileceği belirtilmiştir.

### 4.2 Space Agency Partner Resources

•  *CSA (Canadian Space Agency) — Moon Exploration*
  •  CSA’nın Moon Exploration portalı.
  •  Geçmiş, mevcut ve gelecek Ay görevleri hakkında bilgi.
  •  Kanada’nın Ay keşfine katkıları, teknolojileri, bilimsel araştırmaları ve Artemis programına katılımı.

### 4.3 Veri kullanım notu
•  NASA, ABD Hükümeti dışı kuruluşları onaylamaz ve ABD Hükümeti dışı web sitelerindeki bilgilerden sorumlu değildir.
•  ABD Hükümeti dışı web siteleri için katılımcılar ilgili web sitesinin veri kullanım parametrelerine uymalıdır.
