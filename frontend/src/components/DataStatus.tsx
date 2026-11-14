import React, { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { API_BASE } from '../services/config';

export const DataStatus: React.FC = () => {
  const { language } = useI18n();
  const tr = language === 'tr';
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE}/data/status`, { signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error('Dataset status unavailable');
      return response.json();
    }).then(setStatus).catch(error => { if (error.name !== 'AbortError') setFailed(true); });
    return () => controller.abort();
  }, []);
  return <section className="dataset-status"><h3>{tr ? 'Veri bağlantısı' : 'Dataset connection'}</h3><p role="status">{failed ? (tr ? 'Backend veri durumu alınamadı. Gerçek veri bağlantısı doğrulanmadı.' : 'Backend dataset status unavailable. Real data connection not verified.') : status ? (tr ? 'Backend veri envanteri alındı. Ayrıntılar aşağıda.' : 'Backend dataset inventory received. Details below.') : (tr ? 'Veri envanteri kontrol ediliyor.' : 'Checking dataset inventory.')}</p>{status && <details><summary>{tr ? 'Kaynak ve kapsam ayrıntıları' : 'Source and coverage details'}</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12 }}>{JSON.stringify(status, null, 2)}</pre></details>}</section>;
};
