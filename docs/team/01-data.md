# Agent 1 — Veri ve senaryo

## Başlangıç — 2026-11-14

- Durum: Agent 1 kapsamındaki yerel uygulama hazır ve bağımsız testlerden geçti; commit/push/PR insan mimari teyidi ve uzaktaki temel dal yokluğu nedeniyle yapılmadı. Tam uygulama/gerçek gökyüzü hesaplaması teslimi değildir.
- Hedef: `kekurttel/Nasa-spaceapps-lunar` (private), erişim `ADMIN` doğrulandı.
- Başlangıç dalı: boş klonun doğmamış `main` dalı; `feat/data-scenarios` açıldı.
- Başlangıç SHA: **yok** — `git ls-remote` boş, klon `You appear to have cloned an empty repository` bildirdi. SHA uydurulmadı.
- Mevcut AGENTS.md, stack, test altyapısı: boş depoda yok. Görev dosyaları `/home/kaneki/nasalunarmission/gorev/` içinden okundu; diğer rollerin sözleşmeleri `/home/kaneki/nasalunarmission/agent{2,3,4}.md` içinden okundu.
- Sahip olunan yollar: `src/features/data/**`, bu not `docs/team/01-data.md`. Root config/package/lockfile, ortak tipler, UI veya başka agent modülü oluşturulmaz.
- Seçim: bağımlılıksız JavaScript ESM (`.mjs`) + Node yerleşik testleri; TypeScript tüketicileri için yalnızca modül içinde `.d.mts` bildirimi. Depoda mevcut stack olmadığından bu izole seçim yapıldı; gelecekte stack seçimini dayatmaz.

## Mimari ve ekip sözleşmesi

1. `Site` kaynak ilişkili konumu; `Scenario` o konumdaki tarih aralığını ve örnekleme adımını taşır. Ben bunları üretir/doğrularım.
2. Agent 2 `Scenario` tüketir, Güneş/Dünya açılarını aynı zaman ekseninde tutan `SkySeries` üretir.
3. Agent 3 `SkySeries` ve dağ/tepe çizgisi `HorizonProfile` tüketir, `VisibilitySeries` üretir.
4. Agent 4 `Scenario` ve `VisibilitySeries` tüketir, süre/pencere özetlerini `AnalysisResult` olarak üretir; Agent 5 kullanıcı ekranında konum, tarih, gökyüzü ve sonuçları sunar.

- **Ben şu sözleşmeyi üretiyorum:** `Site`, doğrulanmış `Scenario`, kaynak kayıtları ve kapsam manifesti (manifest = verinin nerede/ne zaman geçerli olduğunu açıklayan kayıt).
- **Ben şu sözleşmeyi tüketiyorum:** kullanıcı `Site`/`Scenario` girdisi, kaynak kanıtları, hesaplama sağlayıcısının tarih/konum kapsamını bildiren manifest.
- **Benim çıktımı kim kullanacak:** Agent 2, Agent 4, Agent 5; konum kimliği/yükseklik eşleşmesi için Agent 3.
- Anladığım: tüm açılar derece, boylam doğu-pozitif; yüzey yüksekliği metre veya bilinmiyorsa `null`; gözlemci yüksekliği yüzey üzerindeki metre; zaman kesin UTC `Z`. `null` sıfır demek değildir. Doğru mu? Diğer agent notları/dalları boş uzakta mevcut değil; teyit alınmış gibi sunulmaz, yanıt beklenmeden izole geliştirilir.
- Analiz sözleşmesindeki yarı açık `[start,end)` aralıklarıyla uyumlu örnek bütçesi: `ceil(durationSeconds / stepSeconds)`; bitişte sıfır süreli fazladan örnek yoktur.
- Önerilen yerel manifest şeması: `{id,version,dataKind,sourceIds,dateCoverage:null|{startUtc,endUtc},locationCoverage:{latMinDeg,latMaxDeg,lonMinDeg,lonMaxDeg}}`. Bu, ortak sözleşmeyi tek taraflı değiştirmez; adaptör gereksinimi olursa tartışılmalıdır.
- Katalog gerçek koordinatlar içerir ama gökyüzü tarih tablosu içermez; bu nedenle gerçek katalog manifestinde `dateCoverage:null`. Sağlayıcı kapsamı olmadan senaryoyu destekleniyor diye kabul etmeyiz. Demo/test manifesti ayrı ve açıkça `synthetic` (sentetik = kontrol amacıyla üretilmiş, ölçülmüş olmayan).

## İş bölümü ve model/araç kısıtları

- Ana oturum `9router/nasa-sol`; baştan kullanıcıya açıklandı, oturum içinden model değiştirilemiyor.
- Üç uygulama alt görevi `9router/nasa-luna` ile açıldı:
  1. `validation.mjs` + `tests/validation.test.mjs`: koordinat/senaryo doğrulama.
  2. `catalog.mjs` + `tests/catalog.test.mjs` + `sources/**`: gerçek katalog/kanıtlar.
  3. `index.mjs`, `index.d.mts`, `README.md`, `examples/demo.mjs`, `tests/integration.test.mjs`: kullanım arayüzü ve bütünleşme.
- Ana oturum bu notu, kısa referans incelemesini ve bağımsız kabul kontrollerini yürütür. Aynı dosyada iki yazıcı yoktur.
- OpenCode + 9router mevcut; `duo`, `prowl-agent`, `firecrawl` PATH içinde yok. `prowl-agent overview` gerçekten denendi: `zsh:1: command not found: prowl-agent`. Yerine boş depo Git kontrolü ve sınırlı dosya okumaları kullanıldı. Kuruluymuş gibi iddia yok; root bağımlılık değişikliği yok.
- İnsan mimari teyidi henüz gelmedi. `son.md` gereği **commit/push/PR yok**. Ayrıca boş uzakta PR hedefi olacak mevcut main/default commit yok; ilk temel dalı başka yetkili koordinatör oluşturmalı. Default dala doğrudan push yapılmaz.

## Public API hazır — yerel doğrulama tamamlandı

`normalizeLongitude`, `validateSite`, `createCustomSite`, `validateScenario`, `sites`, `sources`, `dataManifest`, `validateCatalog`, `getSiteById`, `getSourcesForSite`.

Varsayılan örnek bütçesi `10000`, çağrıda `maxSamples` pozitif güvenli tamsayı ile değişir. Alan/kod/mesaj içeren hatalar döner. Özel koordinat hazır siteye dönüştürülmez. Bilinmeyen yüzey yüksekliği `null` kalır.

## Referans kaynak kodu incelemesi

Kod kopyalanmadı; README iddiaları test sayılmadı. İnceleme GitHub API/raw üzerinden commit sabitlenerek yapıldı:

- `yutuf/lmNasa` @ `e616415af68027d699c0e6b0bbb0afdef67bbad7`: `lunanav/sites.py` içinde `Site` veri sınıfında `source`, `verified`, `reference`, `derived_from` alanları; `load_sites` kaynaklı ve türetilmiş kayıtları ayırır. `derived` özelliği `bool(self.derived_from)` döndürür. MIT lisansı API ile doğrulandı. Ders: türetilmiş nokta yayınlanmış iniş koordinatı değildir; burada kind/kaynak notunda ayrılır.
- `ziyadell/Lunar-Landing-Site-Navigator` @ `0eb4284029c202d703ae22adfc20f6ad6b65e9e0`: `src/data/validate.ts`, zorunlu bilimsel alan eksikse `DataIncompatible` üretir; bozuk isteğe bağlı görsel alanları ayrı düşürür; `validateEphemeris` başlangıç/adım/sayım/dizi uzunluğunu kontrol eder. API lisans alanı yok, lisans belirsiz: **kopyalama yok**. Ders: eksik bilimsel kapsamı sessiz değerle doldurma.
- `pythonhack000/lunar-navigator` @ `41721a7fd74c1968353c590f261f93e5f59a24bf`: `src/data/landings.ts` gerçek iniş zamanı/konum kimliği kayıtlarını açı hesaplarından ayrı tutar; `LANDINGS.find` ile kimlik ilişkilendirir. API lisans alanı yok: **kopyalama yok**. Ders: katalogdaki gerçek iniş bilgisi gökyüzü hesabı veya tüm tarihlerin kapsamı değildir.

İncelenen URL kalıbı `https://github.com/<owner>/<repo>/blob/<SHA>/<yol>`; yukarıdaki tam repo, SHA ve dosya yolları tekrar erişim için yeterlidir. Referans projelerin testleri bu görevde çalıştırılmadı; doğruluk sonuçları ithal edilmedi.

## Test ve teslim kaydı

İlk teslimlerde konum kapsamı eksikliği, `Scenario.site` alanının yanlışlıkla metin beklenmesi, milisaniyesiz UTC'nin reddi ve readonly (paylaşılan verinin değiştirilememesi) tip uyumsuzluğu saptanıp dosya sahiplerine geri verildi. İki alt görevden yalnızca plan içeren ara yanıtlar kabul edilmedi; gerçek dosya değişiklikleri istendi. Bağımsız kabul testi, zaten uygun `23.47314` boylamının `23.473140000000058` yapılmasını yakaladı; normalizasyon yazarı mevcut geçerli değerleri aynen koruyan/idempotent (tekrarlanınca değişmeyen) uygulamayla düzeltti. Sonuçlar aşağıda ana oturum tarafından tekrar ölçüldü; yalnızca alt görev beyanına dayanılmaz.

Bağımlılık talebi: yok; Node >=18 (yerleşik `node:test`, `structuredClone`) yeterli. Kalan risk: gerçek efemeris/terrain tarih/konum kapsamı Agent 2/3 tarafından sağlanmalıdır; bu veri modülü astronomi veya arazi hesaplamaz.

## GitHub yayımlama güncellemesi — 2026-11-14

Kullanıcı önce GitHub'da görünmediğini sordu, ardından açıkça GitHub'a gönderme onayı verdi. Önceki teyit engeli böylece kaldırıldı; aşağıdaki ilk teslim engelleri tarihsel kayıttır. `feat/data-scenarios` dalında yalnız Agent 1'in 17 dosyası commit edilecek; default dala push veya otomatik merge yapılmayacak.

Yayımlama öncesi `node --test src/features/data/tests/*.test.mjs`: 32 test, 32 başarılı, 0 başarısız. Strict TypeScript kontrolü tekrar hatasız tamamlandı. Uzak dal kontrolü artık `feat/app-integration` dalını gösteriyor (`e744dc637f78546efd5a0c2e6f638499fcb6cbd3`); ilk teslimdeki boş uzak durumu değişti. Sonraki fetch sırasında DNS hatası alındı: `Could not resolve host: github.com`. Yayımlama sonucu kullanıcıya gerçek push çıktısına göre bildirilecek; bu not tek başına push kanıtı değildir.

## İlk yerel teslim — 2026-11-14

### Gerçek katalog ve bilimsel sınırlar

- 9 `Site`, 5 kaynak kaydı: altı Apollo Lunar Module noktası, IM-1 Odysseus ve Blue Ghost Mission 1 gerçek iniş noktaları (`landed`: 8); Mons Mouton isimli dağın merkezi, tarihsel duyurulmuş VIPER bölgesini temsil eden **tek işaret** (`planned-region`: 1).
- Mons Mouton `(-84.60,31.00)` USGS/IAU Gazetteer Feature 16070 kaydından bağımsız kontrol edildi. NASA bölge duyurusu koordinat vermez; USGS merkezini kesin iniş noktası, iniş elipsi veya 2026 güncel görev taahhüdü saymayın. `candidate` kind'ı desteklenir ama dayanağı olmayan aday veri eklenmedi.
- Apollo noktaları NASA NSSDCA tablosunun Lunar Module satırları ve ME/PA DE421 çerçevesiyle bağımsız karşılaştırıldı. Odysseus NASA sayfasında `-80.13,+1.44,2579 m`; Blue Ghost LROC sayfasında `18.5623,61.8103,-3650 m` doğrulandı. `execute` HTTP yolunda NSSDCA DNS erişimi başarısız oldu (`getaddrinfo ENOTFOUND nssdc.gsfc.nasa.gov`); webfetch yolu aynı resmî tabloyu başarıyla getirdi.
- Çerçeveler aynılaştırılmadı: USGS Mons Mouton planetographic, Apollo planetocentric; CLPS sayfalarında adlandırılmış yatay çerçeve belirtilmiyor. Yükseklik datumları (hangi sıfır yüzeye göre ölçüldüğü) aynı/kanıtlı kabul edilmez. Hassasiyet kaynakta yayımlandığı kadar. `observerHeightM:1.6` uygulama tercihi, kaynak ölçümü değil.
- Global `locationCoverage` yalnızca geçerli koordinat alanını tanımlar; her noktada veri, arazi veya ufuk çizgisi var demek değildir. Gerçek katalog `dateCoverage:null`: gerçek gökyüzü kapsamı sağlamaz.
- `sources/*.md` kaynak künyesi ve kısa metin alıntılarını saklar; ham sayfaların tam arşivi değildir. Kod/harici görsel kopyası yok. Koşullar kaynak başına saklanır; üçüncü taraf görseller için otomatik sınırsız kullanım hakkı iddiası yok.

### Kullanılabilir API örneği

Depo kökünden (`src/features/data/examples/demo.mjs` bağımsız tam örnektir):

```js
import { getSiteById, validateScenario } from './src/features/data/index.mjs';
const manifest = {
  id: 'example-only', version: '1.0.0', dataKind: 'synthetic', sourceIds: [],
  dateCoverage: { startUtc: '2030-01-01T00:00:00Z', endUtc: '2030-01-02T00:00:00Z' },
  locationCoverage: { latMinDeg: -90, latMaxDeg: 90, lonMinDeg: -180, lonMaxDeg: 180 },
};
const result = validateScenario({
  id: 'sample', site: getSiteById('apollo-11'),
  startUtc: '2030-01-01T00:00:00Z', endUtc: '2030-01-01T01:00:00Z', stepSeconds: 60,
}, { manifest, maxSamples: 60 });
// {ok:true, value:{id:'sample',site:{...tam Site},startUtc:...,endUtc:...,stepSeconds:60},
//  warnings:['Scenario uses synthetic data.']}
```

Bu örnek konumu gerçek katalogdan, tarih kapsamını yalnızca test kaydından alır; hesaplanmış Güneş/Dünya açıları içermez. Üretimde Agent 2'nin gerçek kapsamını kullanın; gerçek katalog manifestiyle senaryo çağrısı tarih kapsamı yok diye reddedilir. `Scenario.site` **tam Site nesnesidir**, ayrı `options.site` yoktur.

### Komutlar ve gerçek sonuçlar

Çalışma dizini: `/home/kaneki/nasalunarmission/Nasa-spaceapps-lunar`.

```text
node --test src/features/data/tests/*.test.mjs
ℹ tests 32
ℹ pass 32
ℹ fail 0
ℹ skipped 0
```

- Test dağılımı: katalog 6, doğrulama 15, public API bütünleşmesi 3, bağımsız kabul 8. Kabul testinde ayrıca 10001 boylam için aralık/açı korunması tarandı; bunlar 10001 ayrı test vakası diye sayılmadı.
- `tsc --noEmit --strict --module nodenext --moduleResolution nodenext --target es2022 src/features/data/tests/typecheck.mts` → çıkış 0, hata çıktısı yok. Full Site sözleşmesi, değiştirilemeyen katalog/manifest ile kullanım ve kopyaların değiştirilebilirliği doğrulandı.
- `node src/features/data/examples/demo.mjs` → çıkış 0; `lonDeg:-90`, `surfaceElevationM:null`, `kind:custom`, tam Site içeren bir saatlik Scenario ve `dataKind:synthetic` JSON çıktısı.
- Sınırlar: `270 → -90`, `180 → -180`, `360 → 0`; `91`, NaN/sonsuz/boş/hex girişleri, bozuk UTC/gerçek dışı takvim tarihleri, ters/aralık dışı tarihler, eksik/tekrarlı kaynaklar, geçersiz adım ve aşırı örnek sayısı reddi test edildi. Kaynak/site kopyaları ortak veriyi değiştirmiyor.
- Root package olmadığı için uygulama production build komutu yok; Agent 1 saf modülü için JS çalıştırma ve TS tüketim kontrolü yapıldı, UI build geçti iddiası yok.

### Alt görevlerin teslim kontrolü

| Alt görev / model | Gerçek çıktı | Test sonucu | Kapsam / SHA |
|---|---|---|---|
| Doğrulama / `9router/nasa-luna` | `validation.mjs`, kendi testleri; sözleşme ve hassasiyet düzeltildi | 15 yerel + son toplu 32/32 | Sadece ayrılan iki dosya; commit yok |
| Katalog / `9router/nasa-luna` | `catalog.mjs`, 5 kaynak notu, kendi testleri | 6/6; ana oturum kaynakları ayrıca okudu | Kendi dizinleri; commit yok |
| API / `9router/nasa-luna` | `index.mjs`, `index.d.mts`, demo, README, 3 test | Toplu 32/32, demo ve tsc başarılı | Kendi dosyaları; commit yok |

Ana oturum `tests/acceptance.test.mjs`, `tests/typecheck.mts` ve bu ekip notunun sahibi. İki yazıcı aynı dosyaya atanmadı; başlangıçta saptanan tip uyuşmazlıkları giderildi. Son Git yol kontrolü yalnız `src/features/data/**` ve `docs/team/01-data.md` içinde 17 yeni dosya gösterdi; root/diğer dört agentın dosyalarına dokunulmadı.

### Kaynak notlarının SHA-256 kaydı

Bunlar Git commit SHA'sı değil, yerel kısa kanıt dosyalarının içerik özetleridir:

```text
95c081484baab862f0935d1ce27e1aeb674fa23dad6c7fd7bdd9ec819c5cddd5  src/features/data/sources/lroc-blue-ghost.md
a483b2b78e7de2b47192986f86429fce806e2d65ec8fda5ff3f96f87418c17cd  src/features/data/sources/nasa-im1-odysseus.md
c735a925aa0a5cc5c41d2bdcfd94a91e473733bcb2eafe57cc844b20ef31f150  src/features/data/sources/nasa-nssdc-apollo.md
f1ad1c4426a17a96268c96d3172ee4071cb6c06a98b207c34bacfcb816e5765e  src/features/data/sources/nasa-viper-mons-mouton.md
344ab1b3e971b2c0c96b31cd4ffe2f31ced65a186821ca0c3432ba785acd2c13  src/features/data/sources/usgs-mons-mouton.md
```

### Kalan teslim engeli ve entegrasyon

- İnsan mimari teyidi gelmedi: `son.md:15` gereği commit yapılmadı. Başlangıç/son commit SHA **yok**, PR URL **yok**; yerel dosyalar kaydedildi fakat sürüm kontrolüyle yayımlanmadı.
- `git fetch origin` başarıyla tamamlandı; uzak repo hâlâ boş, diğer ekip dalları/notları yok. Okunmamış notlar okunmuş/onay alınmış gibi sunulmaz. Main/default temel commit yokken normal PR açılamaz; koordinatör root iskeleti ve temel dalı kendi yetkisinde oluşturmalıdır. Default dala otomatik push/merge yok.
- Agent 2 gerçek tarih/konum kapsamını sağlamalı; Agent 3 kaynak çerçevelerini ve yükseklik datumlarını uyumlandırmadan terrain hesabı yapmamalı; Agent 5 `index.mjs` importunu adapter'a bağlamalı. Manifest şeması bu modülün önerisi; ortak değişiklik gerekiyorsa diğer sahiplerle tartışılmalı.
- İstenen `duo` ve prowl araçları bulunmadığı için üçlü araç kuralı tam karşılanamadı; OpenCode/9router ve doğrudan alt görev araçlarıyla aynı kapsam uygulandı. Ana model `nasa-sol` sapması önceden bildirildi; tüm uygulama alt görevleri `nasa-luna` kullandı.

