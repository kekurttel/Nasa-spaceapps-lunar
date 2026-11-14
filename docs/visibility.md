# Yerel ufuk ve görünürlük — bağımsız teslim

Bu klasör özel depodan indirilemediği için onunla bütünleştirilmiş bir özellik değildir. Ek paket gerektirmeyen JavaScript modülleri Node.js ile sınanır. Gerçek projenin diline, kurallarına ve veri biçimlerine uyarlama erişim sağlandığında yapılmalıdır.

## Veri akışı ve kapsam

Sözleşme, iki modülün paylaştığı veri biçimidir. SkySeries gök cisimlerinin zamanla değişen konumlarını içerir; HorizonProfile gözlem yerinden görülen dağ çizgisidir. Bu modül ikisini tüketip VisibilitySeries, yani örnek zamanlardaki görünürlük sonuçlarını üretir. Site, Scenario ve AnalysisResult'ın gerçek tanımları erişilemediğinden yeniden oluşturulmadı.

Azimut kuzeyden saat yönündeki pusula açısıdır; girdide [0,360) derece kullanılır. İrtifa ufuktan yukarı açıdır; [-90,90] derece kullanılır. ObserverHeightM yüzey üstünde metre cinsinden gözlemci yüksekliğidir. Frame açıların hangi yerel koordinat düzeninde ölçüldüğünün adıdır; farklı düzenlerdeki açılar karşılaştırılamaz.

`src/features/visibility/horizon.mjs`:
- `validateHorizonProfile(profile)`: profil biçimi ve sonlu sayıları denetler; doğru/yanlış döndürür. Çağıran yanlış sonucu reddetmelidir.
- `interpolateHorizon(profile, azimuthDeg)`: sıralı yön örnekleri arasında doğrusal ara değer hesaplar; son örneği ilkine 360 derece üzerinden bağlar.

`src/features/visibility/terrain.mjs`:
- `createFlatHorizon({siteId, observerHeightM})`: açıkça flat/synthetic etiketli sıfır dereceli ufuk.
- `loadTerrainHorizon(document, request)`: hazırlanmış kaynaklı profili denetler.
- `selectHorizon(documentOrNull, request)`: veri yokken strictTerrain true ise hata; değilse uyarılı düz ufuk. Bozuk mevcut veri sessizce düz ufka çevrilmez.

`src/features/visibility/visibility.mjs`:
- `solarVisibleFraction(centerAltitudeDeg,horizonElevationDeg,radiusDeg)`: diskin ufuk üstündeki yaklaşık alan oranı.
- `computeVisibility(sky,horizon,options)`: Güneş oranı, Dünya merkezi ve ikisinin birlikte müsaitliği.

## Örnek kullanım

```js
import { createFlatHorizon } from '../src/features/visibility/terrain.mjs';
import { computeVisibility } from '../src/features/visibility/visibility.mjs';

const frame = 'local-north-clockwise'; // örnek ad; üreticiyle birlikte kararlaştırılmalı
const horizon = createFlatHorizon({siteId:'synthetic-site', observerHeightM:2});
const sky = {
  scenarioId:'synthetic-demo',
  timesUtc:['2026-11-14T00:00:00Z','2026-11-14T00:01:00Z','2026-11-14T00:02:00Z'],
  sunAltDeg:[1,0,-1], sunAzDeg:[359,0,1],
  earthAltDeg:[1,0,-1], earthAzDeg:[359,0,1], sunRadiusDeg:[0.25,0.25,0.25],
  quality:{dataKind:'synthetic',model:'example-only',frame,warnings:[]}
};
const result = computeVisibility(sky,horizon,{
  siteId:'synthetic-site',observerHeightM:2,frame,horizonFrame:frame,
  marginDeg:0,strictTerrain:false
});
// sunVisibleFraction: [1,0.5,0]; earthVisible: [true,false,false]
```

HorizonProfile sözleşmesine yeni alan dayatılmadı. Onun içinde frame bulunmadığından `horizonFrame` çağıranın açık beyanıdır; `frame` ve `sky.quality.frame` ile eşleşmesi gerekir. Arazi belgesinden yüklerken `coverage.frame` kullanılır ve çağıran aynı değeri görünürlük hesabına iletir. Bu beyanın fiziksel doğruluğu modül tarafından ölçülmez. SkySeries içinde site/yükseklik yoktur; çağıranın sky üreticisinin de aynı yeri kullandığını güvenceye alması gerekir.

## Arazi belgesi

Test örneği: `fixtures/synthetic-horizon.json`. Fixture, gerçek ölçüm gelmeden denemek için hazırlanmış yapay veridir; burada `dataKind:'synthetic'` kullanılır.

Belge `{profile,coverage,sources}` içerir. `coverage` aynı siteId, observerHeightM, frame ve `azimuthCoverage:'full-circle'` beyanını taşır. `sources` kaynak kimliği, URL ve açıklama taşır. Kaynak bildirimi gerçek veri olduğunun kanıtı değildir; kaynağın doğruluğu ve sayısal verinin kaynağa bağlılığı ayrıca incelenmelidir. Full-circle beyanı örnekler arasındaki keskin tepelerin yakalandığı anlamına gelmez; bu sürüm en büyük yön boşluğu için bilimsel çözünürlük garantisi vermez.

## Yaklaşımlar ve sınırlar

- Güneş diski boyunca ufuk yerel düz bir çizgi, disk düz ve eşit parlaklıkta bir daire kabul edilir. Merkez ile ufuk farkı d, yarıçap r, x=d/r olduğunda ara bölgede alan oranı `(acos(-x)+x*sqrt(1-x*x))/pi` kullanılır; uçlar 0 ve 1'e sınırlandırılır. Bu ışınım/güç hesabı değildir; kararma ve keskin ufuk değişimleri modellenmez.
- Dünya yalnızca merkezi `ufuk + marginDeg` değerinden **büyükse** görünür; eşitlik görünmezdir. Bu geometrik görünürlük anten, frekans, arazi saçılması veya gerçek haberleşme başarısını garanti etmez.
- `bothAvailable = sunVisibleFraction > 0 && earthVisible`.
- Düz ufukta gözlemci yüksekliğine bağlı ufuk çökmesi ve Ay eğriliği hesaplanmaz; bu ideal, sıfır dereceli açık varsayımdır.
- **Güncelleme:** Gerçek DEM (sayısal yükseklik haritası) artık `data/raw/` altında indirildi. LOLA (Ay yüzeyini lazerle ölçen aygıt) LDEM_4_FLOAT V3.0 ürünü yaklaşık 7.58 km/piksel çözünürlüktedir. `lola.mjs` bu üründen küresel geometriyle kaba ufuk üretir; `terrain.mjs` ise hazır profili denetleyen ayrı katmandır. Ayrıntılar: `docs/lola.md`, `docs/real-workflow.md`, `docs/quality-audit.md`. Bu güncelleme hassas yerel iniş kararı için yeterlilik anlamına gelmez.
- İleride gerçek üretici için Ay eğriliği, yarıçap/yükseklik referansı, gözlemci yüzey yüksekliği, ışın tarama uzaklığı, veri kapsama sınırı, eksik hücre davranışı ve örnek çözünürlüğü belgelenmelidir. Küresel koordinatlardaki gözlemci ve arazi noktalarının yerel ufka izdüşümüyle açı hesaplanmalı; aynı eğrilik etkisi iki kez eklenmemelidir. Büyük haritalar bu teslimde yoktur.
- Gerçek raster dosyası yüklenip kaynak açıklamasıyla denetlenir; bağımsız yüksek çözünürlüklü ufuk ölçümüyle karşılaştırma veya ölçülmüş bilimsel hata sınırı sunulmuyor. Gerçek JPL gökyüzü yanıtları ayrıca indirildi, ancak araziyle koordinat/yükseklik uyumu kanıtlanmadığı için birleşik gerçek görünürlük sonucu olarak kullanılmıyor.

## Kaynak incelemesi

2026-11-14 tarihinde GitHub API üzerinden şu üç deponun bilgisi okundu; her birinde `license:null` geldi. Açık erişim, yeniden kullanım izni değildir; kod alınmadı.

- https://github.com/pythonhack000/lunar-navigator
- https://github.com/ziyadell/Lunar-Landing-Site-Navigator
- https://github.com/JAlavindu/Ridgeline

Hedefli okunan kod: ziyadell deposunda `src/science/visibility.ts`, main ağacı kimliği `2f50f96a4c3f4f5ae371dd148448e6f1d51ec087`. Kaynakta eşit aralıklı yön örnekleri üzerinden döngüsel hesap ve merkez görünürlüğü kullanılıyor. Bu teslim farklı sözleşmeye göre bağımsız yazıldı; kaynakta yer alan zaman aralığı/metrik fonksiyonları Agent 3 kapsamına alınmadı. Diğer iki deponun kaynak kodunun incelendiği iddia edilmiyor.

## Çalıştırma

Teslim kökünde:

```powershell
node --test tests/horizon.test.mjs tests/terrain.test.mjs tests/visibility.test.mjs tests/integration.test.mjs
```

Testler yapay verilerle matematiksel davranışı ve hata reddini sınar; gerçek Ay ölçümlerinin doğrulanması değildir. Son sonuçlar `docs/team/03-visibility.md` içinde kaydedilir.
