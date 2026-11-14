# Doğrulama kaydı — 2026-11-14

## Son acil MVP kontrolü

Önceki açık HTTP/UI kapıları bu koşuda kapandı. `npm run build` uyarısız; frontend UI 4/4; HTTP 1/1; veri/ephemeris/analiz/kabul yeniden koşusu 83/83. Sayılar eski koşularla örtüşür, toplanmaz. Chromium production smoke iki senaryo hesapladı ve CSV indirdi; sıfır pageerror. Yerel kanıt `/tmp/opencode/lunar-mvp-smoke.png`, `/tmp/opencode/lunar-smoke.csv`.

HTTP/UI agentının yarım sözleşmesi düzeltildi. CRA dev sunucusu allowedHosts hatası yüzünden kullanılmadı; production React aynı Node sunucusunda. Başlatma: `npm --prefix frontend ci`, `npm run build`, `npm start`. Ayrıntılar `docs/team/05-integration.md`.

Açık kalanlar: portal hedef/katman doğrulaması, web arazi entegrasyonu, güç/link/iniş güvenliği. Kullanıcı sınırlı MVP yayınına ve ayrı dala commit/push'a izin verdi. Aşağıdaki erken kayıtlar tarihsel ara durumlardır.


## Son acil MVP kontrolü (aşağıdaki ara kayıtları günceller)

- `npm run build`: uyarısız başarılı.
- Frontend `CI=true npm test -- --watchAll=false --runInBand`: 4/4. Kaydedilmiş gerçek HTTP yanıtıyla UI sözleşmesi; bilimsel doğruluk testi değil.
- `npm run test:integration`: 1/1 gerçek HTTP, CSV, UTC, kapsam ve giriş reddi.
- Veri + ephemeris + analiz + kabul yeniden koşusu: 83/83. Önceki koşularla örtüşür; toplanmaz.
- Chromium production smoke: iki konum, açık kot varsayımı, gerçek hesaplama ve CSV; sıfır pageerror. Yerel kanıt: `/tmp/opencode/lunar-mvp-smoke.png`, `/tmp/opencode/lunar-smoke.csv`.
- Yarım agent teslimindeki SiteRecord türü, flat sözleşmesi, UTC regex ve sonuç site adı düzeltildi. Boş koordinatlar reddediliyor.
- CRA dev sunucusu `options.allowedHosts[0] should be a non-empty string` hatasında kaldı. Production React aynı Node sunucusundan servis ediliyor; güvenlik kontrolü kapatılmadı.
- Portal hedef katman doğrulaması açık; web flat ufuk, harita şematik. Güç/link bütçesi/iniş güvenliği garantisi yok. Bu sınırlı MVP; tüm bilimsel kapılar kapanmış değil.
- Kullanıcı ayrı dala acil commit/push istedi. Varsayılan dala yazılmaz.


Dal: `feat/lunar-navigator-unified`. Başlangıç/halen commit HEAD: `e744dc637f78546efd5a0c2e6f638499fcb6cbd3`. Kullanıcı mevcut veri demosunu ve takip sorusunda **Sınırlarla yayınla** seçeneğini onayladı. Güç/iletişim/iniş garantisi yok; portal eksikleri görünür. Test/inceleme geçince ayrı dala yayın yetkili. Henüz commit/push/PR yok. GitHub erişim kontrolünde private repo `kekurttel/Nasa-spaceapps-lunar`, WRITE izni; default `feat/app-integration`. Default dala yazılmadı.

Orkestratör 9router/nasa/nasa-sol; bu fark kullanıcıya bildirildi. Beş geliştirme alt agentı açık model seçimiyle `9router/nasa/nasa-luna`. OpenCode + 9router kullanıldı; `duo` doğrulanmadı/kullanılmadı. Ek Sol alt agent başlatılmadı.

## Bağımsız yeniden çalıştırılan testler

Çalışma dizini `/home/ytwrie/Projects/NasaSpaceApp/navigator-unified`; Node v26.13.0.

### Konum/senaryo

```sh
node --test src/features/data/tests/*.test.mjs tests/integration/data-contract.test.mjs
```

```text
tests 36
pass 36
fail 0
```

Kontrol: katalog kaynakları, bilinmeyen kot null, özel koordinat doğrulama, UTC işareti/takvim ve kapsam. Girdiler katalog + sentetik test verileri; gerçek gök/DEM doğruluğu testi değil.

### Gök yönleri

```sh
node --experimental-strip-types --test tests/integration/ephemeris-contract.test.mjs src/features/ephemeris/tests/*.test.ts
```

```text
tests 40
pass 40
fail 0
```

Kontrol: eş indeksli sonlu diziler, derece/km/m dönüşümleri, yerel yönler, gerçek paketli veri kapsamı, UTC saniye/milisaniye, bitiş sınırı, eksik veri/kapsam dışı hata. Geçmiş reference fixture ve kaynaklı vektörler kullanılır. Genel Ay doğruluğu sertifikası değil.

İki farklı tanı birbirine karıştırılmaz: agentın yeniden çağırdığı `validate_reference.ts` 78 yön için maxSeparationDeg=0.00775688093675673° raporluyor (targetDeg=0.1, passed=true); başka tarih/interpolation raporundaki 0.00010179975360847115° başka karşılaştırmadır. İlk sayı yalnız agent çalıştırmasıyla kaydedildi; orkestratör doğrudan yeniden çağırmadı. İkinci sayı bu oturumda yeniden üretilmedi.

### Paketli gök referans karşılaştırması

```sh
node --experimental-strip-types src/features/ephemeris/tools/validate_reference.ts
```

Bağımsız sonuç: `{"count":78,"maxSeparationDeg":0.00775688093675673,"targetDeg":0.1,"passed":true}`. Yalnız paketli referans noktalarını kapsar; tüm Ay/tarih aralıkları veya terrain modelinin doğruluğu için üst sınır değildir.

### Python vektör dışa aktarma yazılımı

```sh
python -m unittest src.features.ephemeris.tests.test_export_vectors -v
```

Bağımsız sonuç: 5 test, OK. SPICE çağrıları taklit ediliyor; UTC/adım/sınır/atomik dosya ve hata temizliği yazılım kontrolü, gerçek astronomik doğruluk testi değil.

### Zaman analizi ve CSV

```sh
node --test src/features/analysis/tests/*.test.mjs
```

İlk altı test bağımsız geçti. İncelemede son örnekten bitişe kapsama kontrolü eksik bulundu; agent düzeltti. Yeni bağımsız sonuç: 8 test, 8 pass, 0 fail. Son kısa aralık, sıfır süreli bitiş, son kapsama boşluğu, UTC takvim doğrulaması, mixed kalite, 2–4 karşılaştırma, model/frame/kaynak metadata ve formül enjeksiyonu koruması test edildi. Testler sentetik aritmetik kanıtı; gerçek görev fizibilitesi değil.

### Yayın izni

Kullanıcı açık takip sorusunda **Sınırlarla yayınla** seçti. Test/inceleme geçince `feat/lunar-navigator-unified` dalına commit/push yetkili. Güç/iletişim/iniş garantisi yok; portal hedef katman eksikleri yazılacak. Onay, eksik kabul testlerinin yerine geçmez.

### Yeni canlı kaynak erişimi

Orkestratör Python standart HTTPS + TLS doğrulamasıyla iki ayrı Horizons sorgusu gönderdi. Sun 10 ve Earth 399, Moon coord@301, örnek 0°E/-89°, 2026-11-14 00:00–01:00 UT. JSON error yok, signature kaynağı doğru, SOE/EOE var, hedef/gözlemci/sütunlar ve iki satır doğrulandı. Yanıt API 1.2; belge 1.3. Ham yanıt/query/hash `docs/sources/horizons-access/` altında. Gerçek hedef + DEM analizi değildir.

### Ufuk ve görünürlük çekirdeği

```sh
node --test tests/horizon.test.mjs tests/terrain.test.mjs tests/visibility.test.mjs tests/integration.test.mjs tests/independent-audit.test.mjs
```

Sonuç: `tests 30`, `pass 30`, `fail 0`. Sentetik profil/flat testleri, bağımsız disk alanı ızgara karşılaştırması, kuzeyde 359°/0° sarma, kaynak/context/UTC hataları ve strict terrain reddi. Bu koşu gerçek DEM/kernel dosyasıyla sayısal iş akışını kapsamaz.

### Gerçek LOLA ve kayıtlı gök/arazi hattı

İlk agent koşusunda 56 testten 5'i `ModuleNotFoundError: No module named 'spiceypy'` verdi. Sistem Python'u değiştirilmedi; `/tmp/opencode/lunar-registration-venv` oluşturuldu, `scripts/requirements-registration.txt` ile önbellekten spiceypy 8.0.0 ve numpy 2.5.4 kuruldu. Yeni DEM/kernel internet indirmesi yapılmadı; mevcut Git nesneleri yerelde kullanıldı.

```sh
PATH="/tmp/opencode/lunar-registration-venv/bin:$PATH" TMPDIR=/tmp/opencode node --test tests/horizon.test.mjs tests/visibility.test.mjs tests/terrain.test.mjs tests/lola.test.mjs tests/registration.test.mjs tests/real-workflow.test.mjs tests/integration.test.mjs tests/independent-audit.test.mjs
```

Bağımsız sonuç: `tests 56`, `pass 56`, `fail 0`. Önceki 30 çekirdek testi bunun alt kümesidir, ayrıca toplanıp 86 test denmez. Gerçek etiketli raster okuma/hash, bozuk DEM reddi, gerçek Python SPICE generator, yer/yükseklik/frame/terrain/kernel kayıt ve değiştirilmiş metadata reddi çalıştı. Bu, kaba veriyle uygulama tutarlılığı kanıtıdır; DEM çözünürlüğünü iyileştirmez, dış doğruluk sertifikası değildir.

### Gerçek yerel kayıtlı iş akışı

Agent 3, mevcut gerçek raster/kernel ile `Shackleton-reference-example` (-89.9°, 0°, gözlemci 2 m), 2026-11-14T00:00:00Z–2026-11-15T00:00:00Z, iki saat adımlı 13 örnek üretti. Orkestratör ham JSON'u bağımsız okudu: `registrationValidation.valid: true`, tüm konum/yükseklik/frame/terrain/kernel kontrol alanları true. Bu komut görünürlük serisi üretir; adı analysis olsa da JSON'da süre metrikleri yoktur, AnalysisResult teslimi diye sunulmaz.

Kanıt özeti `docs/sources/registered-workflow-evidence.json`; ham geçici sonuç `/tmp/opencode/lunar-real-evidence/registered-analysis.json`, SHA-256 `054e7faabaf89a43ba17478fa83d0037220ea5f8c485243e5d8eb04881be3d41`. `SPICE DE421 geometric positions; aberration correction NONE`, `ME_DE421_LOCAL_NORTH_EAST`. Yaklaşık 7.58 km/piksel, sonlu radyal arama ve kutupta en yakın satır ekstrapolasyonu uyarıları korunuyor. Bu yer örnektir; kullanıcıca doğrulanmış iniş hedefi değildir. Web uygulamasının IAU_MOON hattıyla körlemesine birleştirilmez.

### GitHub erişimi tekrar kontrolü

`gh repo view kekurttel/Nasa-spaceapps-lunar --json nameWithOwner,isPrivate,viewerPermission,defaultBranchRef` çıktısı: `isPrivate: true`, `viewerPermission: WRITE`, varsayılan dal `feat/app-integration`. Ayrı çalışma dalı `feat/lunar-navigator-unified`; henüz bu teslim için commit/push yok. Yazma izni, koşullu insan onayının yerine geçmez.

### Orkestratör uçtan uca modül kabulü

`node --experimental-strip-types --test tests/acceptance/pipeline.test.mjs`: 2 test, 2 pass, 0 fail. Gerçek paketli gök + açık sentetik flat ufuk `mixed` kalıyor; 25 grid örneği 24 saat (86400 saniye), 23.5 saatlik hizasız pencere 84600 saniye veriyor. Karşılaştırma CSV model/frame ve kaliteyi koruyor. Varsayılan kot 0 m bu yazılım örneğinde açık varsayım; gerçek arazi hesabı değil.

### Altıncı Luna bağımsız incelemesi

Salt okunur bilimsel modül incelemesi doğrulanmış yeni bug bulmadı. Aday son-kapsama bulgusunu yeniden değerlendirip mevcut kontrol nedeniyle geri çekti. UI/server inceleme kapsamı dışındaydı; bu inceleme onların kabulü yerine geçmez.

## Acil MVP kapanışı

- `npm run build`: uyarısız geçti.
- `CI=true npm test -- --watchAll=false --runInBand` (frontend): 4/4. API mock + kaydedilmiş gerçek HTTP yanıtı; canlı hesap testi değildir.
- `npm run test:integration`: 1/1; gerçek HTTP hesaplama, UTC/kapsam/horizon reddi, CSV metadata ve gövde boyutu.
- Data + ephemeris + analysis + acceptance birlikte: 83/83; önceki örtüşen koşulara eklenmez.
- Chromium production smoke: iki Apollo katalog senaryosu, açık kot varsayımı, gerçek API sonucu, CSV indirme; pageErrors=[] PASS. Geçici kanıt `/tmp/opencode/lunar-mvp-smoke.png`, CSV `/tmp/opencode/lunar-smoke.csv`.
- CRA dev sunucusu `options.allowedHosts[0] should be a non-empty string` hatasında takıldı. MVP derlenmiş ekranı Node sunucusundan servis eder; dev sunucusu düzelmiş sayılmaz.
- Boş özel koordinatların Number('') ile sıfıra dönüşmesi engellendi; sonuç başlığı API scenario.site.name alanına bağlandı.
- Uygulama agentı HTTP/UI sınırında eksik tip ve eski test sözleşmesi bıraktı; geçici-dizin agentı teslimi de tamamlanmadı. Bu parçalar orkestratör tarafından düzeltildi. Agent çıktısı kabul kanıtı sayılmadı.

## Açık bilimsel sınırlar

QuickMap/Moon Trek hedef katman görsel doğrulaması tamamlanmadı. Kullanıcının sınırlarla yayın onayı yalnız sınırlı MVP içindir. Hedef/tarih/çözünürlük ve uçuş fizibilitesi kabulü yok. Web flat modeli; kayıtlı LOLA CLI ayrı model. Güç/iletişim/iniş güvenliği modellenmez. Projenin tüm şartları tamamlandı denmez.
