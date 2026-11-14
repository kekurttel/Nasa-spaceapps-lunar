# Agent 4 — zaman analizi ve karşılaştırma

## Başlangıç ve sahiplik

- Başlangıç SHA: `e744dc637f78546efd5a0c2e6f638499fcb6cbd3`; yerel dal `feat/lunar-navigator-unified`; çalışma ağacı başlangıçta temizdi.
- Remote `origin`: `https://github.com/kekurttel/Nasa-spaceapps-lunar.git`; `AGENTS.md` bulunamadı. Remote yetkisi bu görevde doğrulanmadı.
- Yalnız `src/features/analysis/**` ve bu not değiştirildi. Commit/push yok; insan mimari teyidi olmadan yasak.
- `docs/team/01-data.md`, `docs/team/02-ephemeris.md`, görünürlük worktree'sindeki `docs/team/03-visibility.md`, `docs/team/05-design-review.md` okundu.
- Entegrasyon: `buildScenarioTimes` bitiş grid'e denk gelirse `endUtc` örneği dahil eder; analiz bunu sıfır süreli örnek olarak destekler ve pencere/metriklere katmaz. Agent 3'ün `mergeDataKinds` sonucu `mixed` kalite değeri `quality.dataKind` içinde aynen korunur.
- Frontend/backend mevcut API'si ile Agent 1 Scenario API'si doğrudan uyumlu değil; UI Agent 5 adapter'ı sahip. Bu modül doğrudan API adapter'ı değildir.

## Mimari ve veri akışı

Site ve Scenario yer/zamanı tanımlar. Agent 2 `SkySeries` (gök konumlarının UTC dizisi) üretir. Agent 3 bunu arazi ufkuyla birleştirip `VisibilitySeries` (Güneş disk oranı, Dünya merkezi görünürlüğü, ortak uygunluk) üretir. Bu modül Scenario ile `VisibilitySeries` tüketir, zaman ağırlıklı metrik ve yarı açık pencereler çıkarır. Agent 5 UI'da sunar; saha sıralaması veya görev kararı yok.

- Üretilen: saf JS `AnalysisResult`-benzeri nesne, comparison nesnesi, CSV.
- Tüketilen: structural `Scenario`/`VisibilitySeries`; başka feature import edilmez.
- Tüketici: Agent 5/UI.
- Agent 1 katalog/site; Agent 2 efemeris; Agent 3 görünürlük; Agent 5 UI (Agent 1 rolü görev tanımından, notu okunamadı).
- VisibilitySeries sözleşmesinde kaynak/çözünürlük alanı belirtilmiyor. Kaynak ID'leri `scenario.site.sourceIds`, çözünürlük `scenario.stepSeconds` olarak taşınır; bu provenance doğrulaması değildir.

## API

`src/features/analysis/index.mjs` (Node ESM):

```js
analyzeVisibility(scenario, series)
compareScenarios(entries)
serializeComparisonCsv(entries)
```

`analyzeVisibility` takes `{scenario, series}`: Scenario `{id,site,startUtc,endUtc,stepSeconds}`, series `scenarioId`, `timesUtc`, `sunVisibleFraction`, `earthVisible`, `bothAvailable`, `quality:{dataKind,horizonModel,earthRule,warnings}`. Dönen nesne `{scenarioId,metrics,windows,quality}`. `sunEquivalentFraction` zaman ağırlıklı disk görünür oranıdır; watt değildir. Windows `{startUtc,endUtc,durationSeconds}` dizileridir.

```js
import { analyzeVisibility } from './src/features/analysis/index.mjs';
const result = analyzeVisibility(scenario, visibilitySeries);
```

Örnek i, `[t_i,t_(i+1))`; son örnek `[t_last,scenario.endUtc)`. Başlangıç hizası, artan timestamp, dizi uzunlukları, değer aralıkları, senaryo ID, `bothAvailable` ve kapsam doğrulanır; boşluk/bozuk seri hata verir, sessizce yok sayılmaz. Son örnek `endUtc` ile eşit olabilir; bu örnek sıfır süre taşır ve pencere/metriklere dahil edilmez. Son örneğin `endUtc`'ye kadar uzaması sözleşme varsayımıdır; son örnekten bitişe kalan aralık da `stepSeconds` üstündeyse reddedilir. Düzensiz aralıklar gerçek timestamp farkıyla ağırlıklandırılır; ardışık veya son aralıkta `stepSeconds` üstündeki boşluk reddedilir. UTC parser saniye hassasiyetli `...ssZ` ve milisaniyeli `...ss.sssZ` girdilerini kabul eder; çıkan pencere zamanları ISO milisaniyeye normalize edilir, takvim dışı tarihler reddedilir. Pencereler birleşik yarı açık aralıklardır ve dönem sınırında kırpılır.

Sonuç uyarısı `stepSeconds` çözünürlüğünü bildirir; örnek sınırları enterpole edilmiş astronomik olay değildir. `compareScenarios` 2–4 benzersiz senaryo kabul eder; farklı dönem uzunluklarında oranlar ile mutlak saniyeler verilir. Evrensel en iyi, GO/NO-GO, güvenlik tavsiyesi veya sıralama üretmez.

CSV CRLF kayıt ve alıntılı hücreler kullanır; metrik, kalite, ufuk modeli, Dünya kuralı, model, frame, birleştirilmiş Site/Scenario/VisibilitySeries kaynak ID'leri, çözünürlük ve uyarıları korur. Kaynak yoksa `unknown` yazılır. Formula başlangıç karakterleri `=`, `+`, `-`, `@` olan metin hücrelerine `'` öneki eklenir.

## Test ve sınırlar

`src/features/analysis/tests/analysis.test.mjs`: sentetik %50 disk, düzensiz/kısmi son aralık, pencere uçları/merge, karanlık süre, malformed/duplicate/reversed/misaligned/gap seri, karşılaştırma farklı süreleri, CSV ve 2–4 sınırı testleri. Sentetik aritmetik testi gerçek Ay verisi, LOLA veya saha güvenliği doğrulaması değildir. Örneklenmiş geçişler cadence çözünürlüğüyle sınırlı. Güç, iletişim link bütçesi, iniş güvenliği modellenmez.

## Teslim doğrulaması

- `node --test src/features/analysis/tests/*.test.mjs` → **8 test, 8 geçti, 0 başarısız, 0 atlandı**. Kapsam: ağırlıklı süre/%50 disk, kısmi son aralık, pencerelerin birleşmesi ve dönem sınırları, hatalı/gap serilerin reddi (son aralık dahil), `endUtc` sıfır süreli örnek, saniye/milisaniye UTC ve geçersiz tarih, `mixed` kalite korunumu, farklı süreli comparison, CSV model/frame/source metadata/formula injection, 2–4 sınırı.
- `git diff --check` → hata yok.
- Başlangıç ve mevcut HEAD SHA: `e744dc637f78546efd5a0c2e6f638499fcb6cbd3` (commit oluşturulmadı).
- `src/features/analysis/index.mjs` ve `src/features/analysis/tests/analysis.test.mjs` ile bu koordinasyon notu dışında proje dosyası değiştirilmedi; başlangıçta var olan diğer untracked dosyalar korunmuştur.
- Kaynak/gerçek astronomi verisi bu saf aritmetik modülde çekilmedi. Sentetik fixture testi doğruluk/uygunluk, enerji, iletişim veya iniş güvenliği garantisi değildir.