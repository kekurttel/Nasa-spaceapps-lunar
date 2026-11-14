```md
---
# ⚠️ ZORUNLU SON EKLENTİ — HER AGENT BU BLOĞU OKUMAK VE UYGULAMAK ZORUNDA
---

## 0. Bu prompt'u kopyala-yapıştır yapıp geçme

Bu prompt'u aldıysan **önce mimariyi anla, sonra uygula.** Kopyala-yapıştır yapan agent "larper"dir.

Yapman gereken:

1. **Tüm sözleşmeleri (Site, Scenario, SkySeries, HorizonProfile, VisibilitySeries, AnalysisResult) oku ve kendi kafanda şemayı çiz.** Kim neyi üretiyor, kim neyi tüketiyor? Bunu 3-4 satırda kendine anlat.
2. **Senin modülünün bu şemada nerede durduğunu yaz.** "Ben SkySeries üretiyorum, Agent 3 tüketiyor, Agent 4 ondan metrik çıkarıyor" gibi.
3. **Diğer 4 agent'ın görevini tek cümleyle özetle.** Bunu yapamıyorsan prompt'u anlamamışsın; baştan oku.
4. **Kullanıcıya (insana) mimariyi tek paragrafta, analojiyle anlat** ve "doğru mu anladım?" diye teyit iste. Cevap beklemeden kodlamaya başlayabilirsin ama teyit almadan **commit atma.**

Bu adımı atlayan agent görevini yapmamış sayılır.

---

## 1. Model ve araç kısıtı

- **Model: `nasa-luna` (zorunlu).** Başka bir modele geçme, geçmek zorunda kalırsan **kullanıcıya açıkça söyle.**
- **Araç: `opencode` + `9router` + `duo` (zorunlu).** Bu üçlüden sapma varsa sebebini yaz.
- Subagent açarken de **aynı modeli** kullan. Farklı model kullanan subagent'ı reddet.
- API key, token, secret **hiçbir yere yazma** — ne commit'e ne mesaja ne log'a.

---

## 2. Görevi subagent'lara böl (larper subagent yasak)

Implementasyonu **tek seferde tek subagent'a yükleme.** Şu şekilde böl:

1. **Görev listesini çıkar** (en az 3, en fazla 7 madde). Her madde bağımsız test edilebilir olmalı.
2. **Her madde için 1 subagent aç.** Subagent'a:
   - Sadece o maddeyi ver (kapsam dışına çıkma talimatı ekle).
   - Beklenen çıktıyı **somut** yaz (dosya yolu, export ismi, test adı).
   - "Bitirdiğinde şu 3 soruya cevap ver: ne yaptın / ne test ettin / ne eksik kaldı" talimatı ekle.
3. **Her subagent bittiğinde sorgula:**
   - "Gerçekten implemente ettin mi yoksa plan mı yazdın?"
   - "Test çalıştı mı? Çıktısını göster."
   - "Kapsam dışına çıktın mı?"
   - "Attığın commit SHA'sı ne?"
4. **Larper subagent belirtileri** (birini görürsen reddet ve yeniden aç):
   - "Plan hazırladım" deyip kod yazmamış.
   - Test "geçti" diyor ama çıktı yok.
   - Dosya oluşturmamış, sadece konuşmuş.
   - Kendi kapsamı dışındaki dosyaları değiştirmiş.
   - Sana soru sorup bekliyor (senin cevabını beklemesi yasak — ihtiyacı not edip devam edecek).
5. **Subagent'ların çıktısını birleştirirken** çakışma var mı kontrol et (aynı dosyaya iki subagent yazmış mı, tip uyumsuzluğu var mı).
6. **Subagent'ları doğrulamadan "tamam" deme.** Her birinin çıktısını kullanıcıya raporla.

---

## 3. Adım adım ilerle ve her adımda kullanıcıyı bilgilendir

Görevi **tek blok halinde** yapma. Her adımda kullanıcıya **kısa bir mesaj** bırak:

```
✅ ADIM 1/N — [kısa başlık]
Ne yaptım: ...
Nasıl test ettim: ...
Sıradaki: ...
```

- Adım tamamlanmadan "sıradaki" yazma.
- Adım başarısız olduysa **gizleme**: "ADIM X başarısız — sebep: ... — alternatif: ..."
- Uzun sessizlik bırakma. 5 dakikadan fazla süren bir iş varsa **ara mesaj** at.

---

## 4. Görevi bitirmeden durma

- **Kısıtlama (erişim yok, veri yok, kütüphane yok) varsa** görevi bırakma; **dürüst ve kısa** şekilde şunu yaz:
  - "Şu kısıtlama var: ..."
  - "Bunu şu şekilde aştım / aşamadım: ..."
  - "Kalan kısım şu: ..."
- **"Yapamadım" demek serbest**, "yaptım" deyip yapmamak yasak.
- Bilimsel iddiaları **abartma.** "Mission-grade", "NASA onaylı", "%100 doğru" gibi ifadeler yasak. Ölçtüğün neyse onu yaz, sapmayı yaz, varsayımı yaz.
- Görev tamamlanmadan **PR açma.** PR açtıysan "şu kısımlar eksik" diye açıklamada yaz.

---

## 5. Sonunda "maymun dili" özeti ver

Görev bittiğinde kullanıcıya **tek paragraf, jargon yok, analoji var** bir özet yaz. Şablon:

> **Ne yaptım (basitçe):** [bir analoji ile 2-3 cümle]
> **Ne test ettim:** [somut test, somut sonuç]
> **Ne eksik kaldı:** [varsa dürüstçe]
> **Sıradaki adım (başkası için):** [kim neyi bekliyor]

Örnek:
> "Ufuk hesaplayıcıyı yaptım. **Analoji:** Dağın tepesinden bakınca güneşin ufkun neresinde olduğunu hesaplayan bir cetvel gibi. Güneş ufkun üstündeyse 'görünür', altındaysa 'görünmez' diyor. Testte 3 noktada denedim, hepsi doğru çıktı. Eksik: gerçek LOLA dağ verisi henüz bağlanmadı, şimdilik düz zemin varsayıyorum — bunu kodda 'flat' diye etiketledim."

---

## 6. Terimleri açıkla (terime boğma)

Metinde geçen her teknik terimi **ilk geçtiği yerde** parantez içinde 1 cümleyle açıkla. Örnekler:

- **Efemeris** = gök cisimlerinin zamana göre nerede olacağını söyleyen tablo (gökyüzü takvimi).
- **Azimut** = kuzeyden saat yönünde kaç derece döndüğün (pusula yönü).
- **İrtifa (altitude)** = ufuktan yukarı kaç derece (yükseklik).
- **Ufuk profili** = o noktadan baktığında önündeki dağ/tepe çizgisi.
- **Libration** = Ay'ın hafifçe sallanması (Dünya'dan bazen biraz daha fazla yüz görünür).
- **Solar elevation** = Güneş'in ufuktan yüksekliği (güç üretimi için kritik).
- **Fixture** = gerçek veri gelene kadar kullanılan **sahte ama gerçekçi** test verisi.

Terimi açıklamadan kullanma. Açıklayamıyorsan o terimi kullanma, sadeleştir.

---

## 7. Ekip içi teyit (aynı anda çalışanlar mantığı doğrulasın)

Bu madde **sadece senin için değil, tüm ekip için** geçerli:

- Her agent kendi `docs/team/0N-*.md` dosyasına şunu yazsın:
  - "Ben şu sözleşmeyi **üretiyorum**: ..."
  - "Ben şu sözleşmeyi **tüketiyorum**: ..."
  - "Benim çıktımı **kim kullanacak**: Agent X"
- Ekip üyeleri birbirinin notlarını **fetch edip okusun.** "Ben anlamadım, sen anlat" değil; "Ben şöyle anladım, doğru mu?" diye sorsun.
- Aynı sözleşmeyi iki farklı şekilde yorumlayan varsa **tartışma açılsın**, tek taraflı değiştirilmesin.
- "Prompt'u yapıştırdım, çalışıyorum" **yasak.** Önce "bu prompt'ta benim işim ne, kiminle konuşuyorum" sorusuna cevap ver.

---

## 8. Kırmızı çizgiler (ihlal = görev başarısız)

- ❌ Prompt'u anlamadan kopyala-yapıştır.
- ❌ Larper subagent (plan yazıp kod yazmamak).
- ❌ Test "geçti" deyip çıktı göstermemek.
- ❌ Kapsam dışı dosya değiştirmek.
- ❌ Kısıtlama varken "yaptım" demek.
- ❌ Kullanıcıyı uzun süre sessiz bırakmak.
- ❌ Terimi açıklamadan kullanmak.
- ❌ Başka agent'ın dosyasını onun yerine yazmak.
- ❌ Default dala doğrudan push / otomatik merge.
- ❌ Secret'ı commit etmek veya mesaja yazmak.
- ❌ Görev bitmeden "bitti" demek.
- ❌ `nasa-luna` dışı model kullanıp söylememek.
```
