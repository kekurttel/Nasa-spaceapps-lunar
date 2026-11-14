import { useCallback, useSyncExternalStore } from 'react';

/** UI language. API payloads, identifiers, and scientific field names remain unchanged. */
export type Language = 'en' | 'tr';

export const translations = {
  en: {
    powerAssessment: 'Power & communications assessment', assessmentNote: 'Comparative visibility from supplied ephemeris and summaries. No hardware performance modeled.',
    loadAssumption: 'Constant load assumption', angleDisplay: 'Angle display', elevationOnly: 'Elevation', clearanceUnavailable: 'Earth clearance (unavailable)',
    clearanceNote: 'Terrain/horizon clearance is not supplied. Elevation is not terrain clearance.',
    energyNote: 'Energy estimates consumption, not solar generation or battery capacity. Constant load, ideal storage; losses, reserve margin, eclipses, terrain obstruction and link budgets are not modeled.',
    visibilityComparison: 'Comparison of Sun-visible and Earth-visible hours', sunVisible: 'Sun visible', earthVisible: 'Earth visible', barScale: 'Bar scale: total observation hours',
    darkEnergy: 'Longest-darkness load energy', meanVisibleElevation: 'Mean visible elevation', earthClearance: 'Earth clearance', notProvided: 'Not provided', lowerBound: 'Lower bound: darkness touches observation boundary',
    energyFormula: 'Energy = longest continuous dark hours × constant load. Boundary-dark records give a lower bound; darkness may extend beyond the observation period. Geometric Earth visibility does not establish a usable communication link.',
    sun: 'Sun', earth: 'Earth', customLocation: 'Custom location', previous: 'Previous', next: 'Next', resetPin: 'Reset pin', zoomIn: 'Zoom in', zoomOut: 'Zoom out', closePopup: 'Close popup',
    timelineEmpty: 'No visibility samples available.', timelineBoth: 'Power & communication', timelineSelected: 'Selected moment (UTC)', visible: 'Visible', notVisible: 'Not visible', azimuth: 'Azimuth', relativeSolarFlux: 'Relative solar flux',
    timelinePinHint: 'Hover to inspect. Click to pin; click the pinned sample again or reset to unpin. Previous/next moves the selection.', pinned: 'Pinned',
    language: 'Language', english: 'English', turkish: 'Türkçe',
    skipToControls: 'Skip to mission controls', missionConsole: 'LunarSight mission console',
    appContext: 'Lunar landing site navigator', calculating: 'Calculating', unavailable: 'Service unavailable',
    resultsAvailable: 'Results available', notConnected: 'Not connected', exportJson: 'Export JSON',
    workspaceSouthPole: 'Mission workspace / South pole', assessment: 'Lunar site assessment',
    terrain: 'Terrain', geometry: 'Geometry', comparison: 'Comparison', missionSetup: 'Mission setup',
    missionControls: 'Mission controls', missionStart: 'Mission start date', missionEnd: 'Mission end date',
    samplingInterval: 'Sampling interval', hour: 'hour', hours: 'hours', runAnalysis: 'Run analysis',
    comparedSites: 'Compared sites', selectSiteNote: 'Select a site to inspect its terrain and visibility. All mission dates use UTC.',
    landingRegion: 'Landing region', candidateSite: 'Candidate site', catalogUnavailable: 'Catalog unavailable',
    addLandingSite: 'Add a landing site', latitude: 'Latitude', longitude: 'Longitude',
    selectedLandingSite: 'Selected landing site', solarIllumination: 'Solar illumination',
    earthVisibility: 'Earth visibility', longestDarkness: 'Longest darkness',
    longestCommunicationGap: 'Longest communication gap', illuminatedHours: 'h illuminated',
    lineOfSightHours: 'h line of sight', awaitingEphemeris: 'Awaiting ephemeris',
    continuousWithoutSunlight: 'Continuous interval without sunlight',
    continuousWithoutEarth: 'Continuous interval without Earth visibility', analysisUnavailable: 'Analysis unavailable',
    retryAnalysis: 'Retry analysis', sunEarthGeometry: 'Sun & Earth geometry', elevationTimeUtc: 'Elevation / time · UTC',
    dataProvenance: 'Data provenance', noSource: 'No calculation source received. Scientific results remain empty until the service responds.',
    mapImagery: 'Map imagery: NASA Moon Trek / LROC / USGS', certification: 'Site assessment, not flight certification',
    landingSiteComparison: 'Landing site comparison', comparisonDescription: 'Illumination, direct communication windows and blackout duration across candidate locations',
    landingSite: 'Landing site', coordinates: 'Coords (lat, lon)', sunlight: 'Sunlight %', earthComm: 'Earth comm %',
    maxDarkBlackout: 'Max dark blackout', maxCommBlackout: 'Max comm blackout', feasibilityScore: 'Feasibility score',
    action: 'Action', active: 'Active', remove: 'Remove', removeSite: 'Remove {site} from comparison',
    missionTimeline: 'Mission windows timeline', timelineDescription: 'Filled intervals are active · Dark intervals are inactive or blocked',
    solarPower: 'Solar power generation', intervalsActive: 'intervals active', dteLineOfSight: 'Direct-to-Earth (DTE) line of sight',
    optimalOperations: 'Optimal operations · Power & communication', intervalsOptimal: 'intervals optimal',
    solarPowerIntervals: 'Solar power intervals', dteIntervals: 'Direct-to-Earth communication intervals',
    combinedIntervals: 'Combined power and communication intervals', sunEl: 'Sun El', earthEl: 'Earth El', status: 'Status',
    sunlit: 'Sunlit', shadow: 'Shadow', directCommOpen: 'Direct Comm Open', blocked: 'Blocked',
    optimalWindow: 'Optimal Landing & EVA Window', constrained: 'Constrained',
    elevationChart: 'Elevation chart', sunEarthElevation: 'Sun & Earth elevation', noEphemeris: 'No ephemeris data',
    chooseSitePeriod: 'Choose a landing site and simulation period, then run the simulation to inspect elevation above the local horizon.',
    trajectoriesNote: 'Sun and Earth trajectories will appear here when results are available.',
    elevationVsHorizon: 'Sun & Earth elevation vs local horizon', site: 'Site', horizonVisible: 'Horizon at 0° · Elevation above 0° is visible',
    sunAnglePower: 'Sun angle (power)', earthAngleDte: 'Earth angle (DTE)', elevation: 'Elevation (°)',
    sunElevation: 'Sun elevation', earthElevation: 'Earth elevation', solarFluxEfficiency: 'Visible solar disk',
    time: 'Time', horizon: 'Horizon (0°)', minSunAngle: 'Min Sun angle', maxSunAngle: 'Max Sun angle',
    minEarthAngle: 'Min Earth angle', maxEarthAngle: 'Max Earth angle',
    selectLunarPoint: 'Select a point on the lunar surface', tileError: 'Some lunar map tiles could not load. Site markers and coordinate selection remain available.',
    selected: 'Selected', candidate: 'Candidate site', analyzeSite: 'Analyze this site',
    chooseEndAfterStart: 'Choose an end date after the start date',
    serviceError: 'Ephemeris service unavailable. Check the backend connection, then retry. No substitute data is shown.',
  },
  tr: {
    powerAssessment: 'Güç ve iletişim değerlendirmesi', assessmentNote: 'Sağlanan efemeris ve özetlerden karşılaştırmalı görünürlük. Donanım performansı modellenmez.',
    loadAssumption: 'Sabit yük varsayımı', angleDisplay: 'Açı gösterimi', elevationOnly: 'Yükseklik', clearanceUnavailable: 'Dünya ufuk açıklığı (mevcut değil)',
    clearanceNote: 'Arazi/ufuk açıklığı sağlanmamıştır. Yükseklik, arazi açıklığı değildir.',
    energyNote: 'Enerji, tüketim tahminidir; güneş üretimi veya batarya kapasitesi değildir. Sabit yük ve ideal depolama varsayılır; kayıplar, yedek payı, tutulmalar, arazi engelleri ve bağlantı bütçesi modellenmez.',
    visibilityComparison: 'Güneş ve Dünya görünürlük saatlerinin karşılaştırması', sunVisible: 'Güneş görünür', earthVisible: 'Dünya görünür', barScale: 'Çubuk ölçeği: toplam gözlem saati',
    darkEnergy: 'En uzun karanlıkta yük enerjisi', meanVisibleElevation: 'Görünürken ortalama yükseklik', earthClearance: 'Dünya ufuk açıklığı', notProvided: 'Sağlanmadı', lowerBound: 'Alt sınır: karanlık gözlem sınırına ulaşıyor',
    energyFormula: 'Enerji = en uzun kesintisiz karanlık süresi × sabit yük. Gözlem sınırındaki karanlıkta sonuç alt sınırdır; karanlık gözlem dönemini aşabilir. Geometrik Dünya görünürlüğü kullanılabilir iletişim bağlantısı anlamına gelmez.',
    sun: 'Güneş', earth: 'Dünya', customLocation: 'Özel konum', previous: 'Önceki', next: 'Sonraki', resetPin: 'Sabitlemeyi kaldır', zoomIn: 'Yakınlaştır', zoomOut: 'Uzaklaştır', closePopup: 'Açılır pencereyi kapat',
    timelineEmpty: 'Görünürlük örneği yok.', timelineBoth: 'Güç ve iletişim', timelineSelected: 'Seçili an (UTC)', visible: 'Görünür', notVisible: 'Görünmez', azimuth: 'Azimut', relativeSolarFlux: 'Bağıl güneş akısı',
    timelinePinHint: 'İncelemek için üzerine gelin. Sabitlemek için tıklayın; kaldırmak için aynı örneğe tekrar tıklayın veya sıfırlayın. Önceki/sonraki seçimi değiştirir.', pinned: 'Sabitlendi',
    language: 'Dil', english: 'English', turkish: 'Türkçe',
    skipToControls: 'Görev kontrollerine geç', missionConsole: 'LunarSight görev konsolu',
    appContext: 'Ay iniş alanı navigatörü', calculating: 'Hesaplanıyor', unavailable: 'Hizmet kullanılamıyor',
    resultsAvailable: 'Sonuçlar hazır', notConnected: 'Bağlı değil', exportJson: 'JSON dışa aktar',
    workspaceSouthPole: 'Görev çalışma alanı / Güney kutbu', assessment: 'Ay alanı değerlendirmesi',
    terrain: 'Arazi', geometry: 'Geometri', comparison: 'Karşılaştırma', missionSetup: 'Görev ayarları',
    missionControls: 'Görev kontrolleri', missionStart: 'Görev başlangıç tarihi', missionEnd: 'Görev bitiş tarihi',
    samplingInterval: 'Örnekleme aralığı', hour: 'saat', hours: 'saat', runAnalysis: 'Analizi çalıştır',
    comparedSites: 'Karşılaştırılan alanlar', selectSiteNote: 'Araziyi ve görünürlüğü incelemek için bir alan seçin. Tüm görev tarihleri UTC kullanır.',
    landingRegion: 'İniş bölgesi', candidateSite: 'Aday alan', catalogUnavailable: 'Katalog kullanılamıyor',
    addLandingSite: 'İniş alanı ekle', latitude: 'Enlem', longitude: 'Boylam',
    selectedLandingSite: 'Seçili iniş alanı', solarIllumination: 'Güneş aydınlanması',
    earthVisibility: 'Dünya görünürlüğü', longestDarkness: 'En uzun karanlık',
    longestCommunicationGap: 'En uzun iletişim kesintisi', illuminatedHours: 'sa aydınlanma',
    lineOfSightHours: 'sa görüş hattı', awaitingEphemeris: 'Efemeris bekleniyor',
    continuousWithoutSunlight: 'Güneş ışığı olmadan geçen kesintisiz süre',
    continuousWithoutEarth: 'Dünya görünürlüğü olmadan geçen kesintisiz süre', analysisUnavailable: 'Analiz kullanılamıyor',
    retryAnalysis: 'Analizi yeniden dene', sunEarthGeometry: 'Güneş ve Dünya geometrisi', elevationTimeUtc: 'Yükseklik / zaman · UTC',
    dataProvenance: 'Veri kaynağı', noSource: 'Hesaplama kaynağı alınmadı. Hizmet yanıt verene kadar bilimsel sonuçlar boş kalır.',
    mapImagery: 'Harita görüntüleri: NASA Moon Trek / LROC / USGS', certification: 'Alan değerlendirmesi; uçuş sertifikasyonu değildir',
    landingSiteComparison: 'İniş alanı karşılaştırması', comparisonDescription: 'Aday konumlarda aydınlanma, doğrudan iletişim pencereleri ve kesinti süreleri',
    landingSite: 'İniş alanı', coordinates: 'Koordinatlar (enlem, boylam)', sunlight: 'Güneş ışığı %', earthComm: 'Dünya iletişimi %',
    maxDarkBlackout: 'En uzun karanlık kesintisi', maxCommBlackout: 'En uzun iletişim kesintisi', feasibilityScore: 'Uygunluk puanı',
    action: 'İşlem', active: 'Etkin', remove: 'Kaldır', removeSite: '{site} alanını karşılaştırmadan kaldır',
    missionTimeline: 'Görev pencereleri zaman çizelgesi', timelineDescription: 'Dolu aralıklar etkin · Koyu aralıklar etkin değil veya engelli',
    solarPower: 'Güneş enerjisi üretimi', intervalsActive: 'aralık etkin', dteLineOfSight: 'Dünya’ya doğrudan (DTE) görüş hattı',
    optimalOperations: 'En uygun operasyonlar · Güç ve iletişim', intervalsOptimal: 'aralık en uygun',
    solarPowerIntervals: 'Güneş enerjisi aralıkları', dteIntervals: 'Dünya’ya doğrudan iletişim aralıkları',
    combinedIntervals: 'Birleşik güç ve iletişim aralıkları', sunEl: 'Güneş yüks.', earthEl: 'Dünya yüks.', status: 'Durum',
    sunlit: 'Güneşli', shadow: 'Gölgede', directCommOpen: 'Doğrudan iletişim açık', blocked: 'Engelli',
    optimalWindow: 'En uygun iniş ve EVA penceresi', constrained: 'Kısıtlı',
    elevationChart: 'Yükseklik grafiği', sunEarthElevation: 'Güneş ve Dünya yüksekliği', noEphemeris: 'Efemeris verisi yok',
    chooseSitePeriod: 'Yerel ufkun üzerindeki yüksekliği incelemek için iniş alanı ve simülasyon dönemi seçip simülasyonu çalıştırın.',
    trajectoriesNote: 'Sonuçlar hazır olduğunda Güneş ve Dünya yörüngeleri burada görünür.',
    elevationVsHorizon: 'Güneş ve Dünya yüksekliği / yerel ufuk', site: 'Alan', horizonVisible: 'Ufuk 0° konumunda · 0° üzerindeki yükseklik görünür',
    sunAnglePower: 'Güneş açısı (güç)', earthAngleDte: 'Dünya açısı (DTE)', elevation: 'Yükseklik (°)',
    sunElevation: 'Güneş yüksekliği', earthElevation: 'Dünya yüksekliği', solarFluxEfficiency: 'Görünür Güneş diski',
    time: 'Zaman', horizon: 'Ufuk (0°)', minSunAngle: 'En düşük Güneş açısı', maxSunAngle: 'En yüksek Güneş açısı',
    minEarthAngle: 'En düşük Dünya açısı', maxEarthAngle: 'En yüksek Dünya açısı',
    selectLunarPoint: 'Ay yüzeyinde bir nokta seçin', tileError: 'Bazı Ay haritası döşemeleri yüklenemedi. Alan işaretçileri ve koordinat seçimi kullanılabilir.',
    selected: 'Seçili', candidate: 'Aday alan', analyzeSite: 'Bu alanı analiz et',
    chooseEndAfterStart: 'Bitiş tarihi başlangıç tarihinden sonra olmalı',
    serviceError: 'Efemeris hizmeti kullanılamıyor. Arka uç bağlantısını kontrol edip yeniden deneyin. Yerine başka veri gösterilmez.',
  },
} as const;

export type TranslationKey = keyof typeof translations.en;
const STORAGE_KEY = 'lunarsight-language';
const getInitialLanguage = (): Language => {
  if (typeof window === 'undefined') return 'en';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'en' || stored === 'tr') return stored;
  return window.navigator.language.toLowerCase().startsWith('tr') ? 'tr' : 'en';
};
let language: Language = getInitialLanguage();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); };
const getSnapshot = () => language;

export function setLanguage(next: Language): void {
  if (next === language) return;
  language = next;
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, next);
  listeners.forEach(listener => listener());
}

export function useI18n() {
  const currentLanguage = useSyncExternalStore(subscribe, getSnapshot, () => 'en' as Language);
  const t = useCallback(<K extends TranslationKey>(key: K): string => translations[currentLanguage][key], [currentLanguage]);
  return { language: currentLanguage, setLanguage, t };
}
