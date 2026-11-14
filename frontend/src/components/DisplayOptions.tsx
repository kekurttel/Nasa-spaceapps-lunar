import React, { useId } from 'react';
import './DisplayOptions.css';

export type DisplayPreset = 'survey' | 'landscape' | 'physical';
export type DisplayLayer = 'lrocBrightness' | 'lolaSkyline' | 'yaleStars';
export type DisplayAid = 'liftShadows' | 'fineGroundTexture' | 'azimuthElevationGrid' | 'rangeRings';

export interface DisplayOptionLabels {
  title: string;
  presets: string;
  layers: string;
  aids: string;
  presetNames: Record<DisplayPreset, string>;
  layerNames: Record<DisplayLayer, string>;
  aidNames: Record<DisplayAid, string>;
}

export interface DisplayOptionsProps {
  preset: DisplayPreset;
  onPresetChange: (preset: DisplayPreset) => void;
  layers: Record<DisplayLayer, boolean>;
  onLayerChange: (layer: DisplayLayer, enabled: boolean) => void;
  aids: Record<DisplayAid, boolean>;
  onAidChange: (aid: DisplayAid, enabled: boolean) => void;
  language?: 'en' | 'tr';
  availableLayers?: Partial<Record<DisplayLayer, boolean>>;
  availableAids?: Partial<Record<DisplayAid, boolean>>;
  labels?: Partial<Omit<DisplayOptionLabels, 'presetNames' | 'layerNames' | 'aidNames'>> & {
    presetNames?: Partial<Record<DisplayPreset, string>>;
    layerNames?: Partial<Record<DisplayLayer, string>>;
    aidNames?: Partial<Record<DisplayAid, string>>;
  };
  className?: string;
}

const defaultLabels: DisplayOptionLabels = {
  title: 'Display options',
  presets: 'View preset',
  layers: 'Measured layers',
  aids: 'Display aids',
  presetNames: { survey: 'Survey', landscape: 'Landscape', physical: 'Physical' },
  layerNames: {
    lrocBrightness: 'LROC surface brightness',
    lolaSkyline: 'Measured LOLA skyline',
    yaleStars: 'Yale stars',
  },
  aidNames: {
    liftShadows: 'Lift shadows',
    fineGroundTexture: 'Synthetic surface detail',
    azimuthElevationGrid: 'Latitude/longitude grid',
    rangeRings: 'Angular rings · 15° / 30°',
  },
};

const layerKeys: DisplayLayer[] = ['lrocBrightness', 'lolaSkyline', 'yaleStars'];
const aidKeys: DisplayAid[] = ['liftShadows', 'fineGroundTexture', 'azimuthElevationGrid', 'rangeRings'];
const presetKeys: DisplayPreset[] = ['survey', 'landscape', 'physical'];

export const DisplayOptions: React.FC<DisplayOptionsProps> = ({
  preset, onPresetChange, layers, onLayerChange, aids, onAidChange, labels, className = '',
  language = 'en', availableLayers = {}, availableAids = {},
}) => {
  const titleId = useId();
  const base: DisplayOptionLabels = language === 'tr' ? {
    title: 'Görünüm seçenekleri', presets: 'Görünüm', layers: 'Ölçülmüş katmanlar', aids: 'Görsel yardımcılar',
    presetNames: { survey: 'İnceleme', landscape: 'Manzara', physical: 'Fiziksel' },
    layerNames: { lrocBrightness: 'LROC yüzey parlaklığı', lolaSkyline: 'Ölçülmüş LOLA ufku', yaleStars: 'Yale yıldızları' },
    aidNames: { liftShadows: 'Gölgeleri aydınlat', fineGroundTexture: 'Sentetik yüzey ayrıntısı', azimuthElevationGrid: 'Enlem/boylam ızgarası', rangeRings: 'Açısal halkalar · 15° / 30°' },
  } : defaultLabels;
  const unavailable = language === 'tr' ? 'Kullanılamıyor' : 'Unavailable';
  const text: DisplayOptionLabels = {
    ...base,
    ...labels,
    presetNames: { ...base.presetNames, ...labels?.presetNames },
    layerNames: { ...base.layerNames, ...labels?.layerNames },
    aidNames: { ...base.aidNames, ...labels?.aidNames,
      azimuthElevationGrid: base.aidNames.azimuthElevationGrid,
      fineGroundTexture: base.aidNames.fineGroundTexture,
      rangeRings: base.aidNames.rangeRings },
  };

  return (
    <section className={`display-options ${className}`.trim()} aria-labelledby={titleId}>
      <h2 id={titleId} className="display-options__title">{text.title}</h2>
      <fieldset className="display-options__group">
        <legend>{text.presets}</legend>
        <div className="display-options__presets">
          {presetKeys.map((key) => (
            <button key={key} type="button" className="display-options__preset"
              aria-pressed={preset === key} onClick={() => onPresetChange(key)}>
              {text.presetNames[key]}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="display-options__group">
        <legend>{text.layers}</legend>
        <div className="display-options__checks">
          {layerKeys.map((key) => (
            <label className="display-options__check" key={key}>
              <input type="checkbox" disabled={!availableLayers[key]} checked={!!availableLayers[key] && layers[key]} onChange={(event) => onLayerChange(key, event.target.checked)} />
              <span>{text.layerNames[key]}{!availableLayers[key] && <small> · {unavailable}</small>}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="display-options__group">
        <legend>{text.aids}</legend>
        <div className="display-options__checks">
          {aidKeys.map((key) => (
            <label className="display-options__check" key={key}>
              <input type="checkbox" disabled={!availableAids[key]} checked={!!availableAids[key] && aids[key]} onChange={(event) => onAidChange(key, event.target.checked)} />
              <span>{text.aidNames[key]}{!availableAids[key] && <small> · {unavailable}</small>}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </section>
  );
};

export default DisplayOptions;
