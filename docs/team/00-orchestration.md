# Orkestrasyon — 2026-11-14

## Başlangıç ve izin kapısı

- Repo: https://github.com/kekurttel/Nasa-spaceapps-lunar (private), GitHub CLI viewerPermission WRITE doğrulandı.
- Başlangıç SHA: e744dc637f78546efd5a0c2e6f638499fcb6cbd3.
- Varsayılan dal feat/app-integration; doğrudan push/merge yapılmayacak.
- İzole çalışma ağacı: /home/ytwrie/Projects/NasaSpaceApp/navigator-unified, feat/lunar-navigator-unified.
- /home/ytwrie/Projects/NasaSpaceApp/visibility-work değiştirilmiş kullanıcı işi içeriyor; korunuyor.
- İnsan mimari/yayın teyidi alındı: **Sınırlarla yayınla**. Test/inceleme geçince ayrı dalda commit/push yetkili; garanti yok, portal eksikleri açık. Alt agentlar yine commit atmaz; orkestratör kapıları denetler.
- Hedef bölge/tarih/çözünürlük/çevrimdışı gereksinim soruldu. Öneri karar değildir; gerçek hedef seçilene kadar paketli kapsam geliştirme testi içindir.

## Model ve araç dürüstlüğü

Ana oturum 9router/nasa/nasa-sol; kullanıcıya fark bildirildi. Beş uygulama alt agentı açıkça 9router/nasa/nasa-luna ile açıldı. OpenCode ve 9router kullanılıyor; duo mevcut araçlarda yok. İleri yapı için Sol alt agent gerekirse önce kullanıcı izni alınacak. Alt agentların commit yetkisi yok.

## Mimari ve sahiplik

Site ve Scenario yer/zaman girdisidir. Agent 1 katalog/doğrulamayı sağlar; Agent 2 SkySeries üretir; Agent 3 HorizonProfile ile SkySeries'i VisibilitySeries'e çevirir; Agent 4 süre ağırlıklı AnalysisResult üretir; Agent 5 ekran ve hizmet bağlantısını yapar. Orkestratör API birleşimini ve bağımsız kabul testlerini denetler.

- Agent 1: src/features/data/**, docs/team/01-data.md, tests/integration/data-contract.test.mjs.
- Agent 2: src/features/ephemeris/**, docs/team/02-ephemeris.md, tests/integration/ephemeris-contract.test.mjs.
- Agent 3: src/features/visibility/**, ilgili horizon/visibility/terrain/lola/registration testleri, mevcut terrain veri ve araçları, docs/team/03-visibility.md.
- Agent 4: src/features/analysis/**, docs/team/04-analysis.md.
- Agent 5: frontend/**, backend/**, server/**, root package config, tests/integration/app*, docs/team/05-integration.md.
- Orkestratör: bu kayıt, docs/sources/**, docs/project-instructions/**, README.md, bağımsız kabul raporu/testi.

Yapay veri gerçek NASA ölçümü değildir. Flat model gerçek araziyi kanıtlamaz. Frame uyumu ölçülmeden gerçek arazi ile gökyüzü birleştirilmez. Görünürlük; elektrik, iletişim yeterliliği veya iniş güvenliği garantisi değildir.

## Ek bağımsız inceleme

Altıncı Luna rolü salt okunur bilimsel modül incelemesi yapar: süre, input ve provenance hatası için somut yeniden üretim arar. UI/server aktif değişikliklerine dokunmaz. Beş uygulama rolünün yerine geçmez.

## Kabul kapıları

1. Her agent gerçek dosya ve export teslim eder; sadece plan kabul edilmez.
2. Test komutu ve gerçek çıktı yeniden çalıştırılır.
3. Sahiplik çakışması ve ortak sözleşme doğrulanır.
4. Zaman toplamı senaryo süresine eşit olur; bitiş örneği ekstra süre sayılmaz.
5. İki senaryo, CSV, hata modu, kalite ve kaynak görünümü aynı ürün hattında sınanır.
6. QuickMap/Moon Trek bilimsel katman görsel incelemesi ayrı kanıtlanır; HTML erişimi yerine geçmez.
7. İnsan mimari teyidinden önce commit/push yok.
