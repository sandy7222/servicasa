import React, { useEffect, useState } from 'react';
import { Camera } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { DiagnosisPhoto } from '../../types';

/** Foto adjuntada por el cliente en el asistente de diagnóstico — se ve
 * igual para el técnico asignado y para el admin, sin versión distinta por
 * rol (ver alcance acordado). El bucket diagnosis-photos es privado, así que
 * siempre se accede con una signed URL, nunca con una URL pública. */
export const DiagnosisPhotoCard: React.FC<{ photos: DiagnosisPhoto[] }> = ({ photos }) => {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      photos.map(async (photo) => {
        const { data } = await supabase.storage.from('diagnosis-photos').createSignedUrl(photo.storagePath, 3600);
        return [photo.id, data?.signedUrl] as const;
      })
    ).then((entries) => {
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const [id, url] of entries) if (url) next[id] = url;
      setSignedUrls(next);
    });
    return () => {
      cancelled = true;
    };
  }, [photos]);

  if (photos.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1">
        <Camera className="w-3 h-3" /> Foto del diagnóstico
      </h4>
      <div className="flex flex-wrap gap-2">
        {photos.map((photo) =>
          signedUrls[photo.id] ? (
            <a key={photo.id} href={signedUrls[photo.id]} target="_blank" rel="noreferrer">
              <img
                src={signedUrls[photo.id]}
                alt="Foto del diagnóstico adjuntada por el cliente"
                className="w-24 h-24 object-cover rounded-lg border border-slate-200 dark:border-slate-700 hover:opacity-90 transition-opacity"
              />
            </a>
          ) : (
            <div
              key={photo.id}
              className="w-24 h-24 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 animate-pulse"
            />
          )
        )}
      </div>
    </div>
  );
};
