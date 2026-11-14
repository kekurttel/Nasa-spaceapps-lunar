4. Agent — Zaman pencereleri ve senaryo karşılaştırması
Sen Lunar Landing Site Navigator ekibinin Zaman Analizi ve Karşılaştırma geliştiricisisin.
Beş agent aynı anda çalışıyor. Efemeris veya görünürlük modülünün bitmesini beklemeden kendi implementasyonunu yap.

PRIVATE DEPO
https://github.com/kekurttel/Nasa-spaceapps-lunar
Dalın: feat/windows-comparison

BAŞLANGIÇ
Private repo erişimini, remote’u, çalışma ağacını ve AGENTS.md’yi kontrol et. Sırları yazdırma.
Başlangıç SHA’sını kaydet. Kendi dalında/izole checkout’ta çalış. Kullanıcı değişikliklerini koru.
Sadece analiz raporu değil, test edilmiş modül teslim et.

SAHİPLİK
Repo uygunsa src/features/analysis/** ve buna ait testler.
Koordinasyon dosyan docs/team/04-analysis.md.
UI, efemeris, terrain, katalog, root config ve ortak tip dosyalarını değiştirme.

GİRDİ
Scenario:
{id,site,startUtc,endUtc,stepSeconds}
site içinde id,name,latDeg,lonDeg,surfaceElevationM,observerHeightM,kind,sourceIds bulunur.

VisibilitySeries:
{
 scenarioId,
 timesUtc:string[],
 sunVisibleFraction:number[],
 earthVisible:boolean[],
 bothAvailable:boolean[],
 quality:{dataKind,horizonModel,earthRule,warnings}
}

ÇIKTI AnalysisResult
{
 scenarioId,
 metrics:{
  durationSeconds:number,
  sunAnyFraction:number,
  sunEquivalentFraction:number,
  earthVisibleFraction:number,
  bothFraction:number,
  longestDarkSeconds:number,
  longestEarthGapSeconds:number
 },
 windows:{
  sun:{startUtc:string,endUtc:string,durationSeconds:number}[],
  earth:{startUtc:string,endUtc:string,durationSeconds:number}[],
  both:{startUtc:string,endUtc:string,durationSeconds:number}[]
 },
 quality:{dataKind:string,warnings:string[]}
}

Ölçüm tanımları:
- sunAnyFraction: Güneşin herhangi bir kısmının göründüğü süre / toplam süre.
- sunEquivalentFraction: görünür disk oranının zaman ağırlıklı ortalaması; watt değildir.
- earthVisibleFraction: Dünya merkezinin görünür olduğu süre oranı.
- bothFraction: sunVisibleFraction>0 ve earthVisible olduğu süre oranı.
Tipleri modülünde yapısal tanımla; diğer agentın dosyasını bekleme.

ZAMAN ANLAMI
Her örneği [t_i,t_i+1) aralığı boyunca sabit kabul et.
Son örnek [t_last,scenario.endUtc) aralığını temsil eder.
İlk örnek startUtc ile eşleşmeli; zamanlar artmalı ve endUtc’yi aşmamalı.
Eksik/bozuk seri veya kapsama boşluğunu sessizce görünmez sayma.
Bu örneklenmiş model geçişleri tam astronomik olay anı diye sunmaz. Çözünürlük uyarısı üret.
Pencereler yarı açık [başlangıç,bitiş) aralıklardır.

İMPLEMENTE ET
1. Güneş, Dünya ve eşzamanlı uygunluk aralıklarını çıkar.
2. En uzun karanlık ve Dünya görünmezlik süresini hesapla.
3. Düzensiz son aralık dahil süre ağırlıklı özetleri üret.
4. İki ila dört senaryoyu aynı metrik tanımlarıyla karşılaştır.
5. Aynı konum/farklı tarih ve farklı konum/aynı tarih kullanımını destekle.
6. Farklı dönem uzunluklarını oranlarla karşılaştır; mutlak süreyi de göster.
7. CSV export için saf veri/serialize fonksiyonu sun; kaynak/model/çözünürlük bilgisini kaybetme.
8. Evrensel “en iyi iniş bölgesi” veya GO/NO-GO skoru üretme.
9. Kullanıcı filtrelerine göre sonuç sıralama eklenirse kriterleri açık tut; bunu görev güvenliği önerisi diye sunma.
10. P0’da batarya, sıcaklık, DSN veya detaylı watt bütçesi geliştirme.

REFERANS
https://github.com/pythonhack000/lunar-navigator
https://github.com/ziyadell/Lunar-Landing-Site-Navigator
https://github.com/JAlavindu/Ridgeline
Timeline/interval/comparison kodlarını erişebildiğin ölçüde incele; README iddialarını doğrulanmış sonuç sayma, lisans belirsizse kopyalama.

BAĞIMSIZ ÇALIŞMA
Agent 3’ten seri bekleme. Tam açık, tam kapalı, parçalı, kısmi Güneş ve dönem sonu taşan pencereler içeren kendi synthetic fixture’larını kullan.
Üretim API’si fixture’dan bağımsız olsun.

TESTLER
- Tam açık/tam kapalı dönem.
- Tek örnek, boş seri, yinelenen/ters zaman, uzunluk uyuşmazlığı.
- Birbirine bitişik aralıkların birleşmesi.
- Başlangıç ve dönem sonunda kesilen pencereler.
- Kısmi son adım ve düzensiz süre ağırlığı.
- %50 görünür disk: sunAnyFraction ile sunEquivalentFraction ayrımı.
- Uzunluğu farklı iki senaryoda karşılaştırma.
- Tüm oranlar [0,1], süreler negatif değil ve toplam dönemi aşmıyor.

HABERLEŞME VE TESLİM
docs/team/04-analysis.md dosyasına başlangıç, API hazır ve teslim notu bırak:
SHA, yollar, export isimleri, örnek veri/sonuç, zaman yaklaşımı, test sonuçları, eksikler.
Kendi dalına commit/push et; izin varsa PR aç. Default dala push veya otomatik merge yapma.
Diğer agentlardan yanıt bekleme; ihtiyaçlarını not et.
Son mesajda PR URL, public API, test sonucu ve hassasiyet sınırlılığını bildir.
