import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, LocateFixed, MapPinned, Save } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { geocodeWorkZoneLocality } from '../../lib/technicianWorkZone';

// Ver plan-zona-trabajo-agenda.md: radio entre 5 y 60km (constraint de base
// technicians_work_zone_radius_km_check), default sugerido 15km. Referencia
// real: Glew-Capital son 34km, y con 60km ya nadie configuraría trabajar más
// lejos — sería un despropósito viajar tanto.
const MIN_RADIUS_KM = 5;
const MAX_RADIUS_KM = 60;
const DEFAULT_RADIUS_KM = 15;
const ARGENTINA_CENTER: [number, number] = [-38.4161, -63.6167];
// Nivel de zoom al llegar a una localidad: lo suficientemente cerca como
// para reconocerla a simple vista (nombres de barrio/localidad visibles),
// no un panorama de todo el partido/región.
const TOWN_ZOOM = 13;

// divIcon en vez del ícono default de Leaflet: el marker.png/shadow.png por
// defecto no se resuelve con Vite salvo que se reconfiguren las URLs a mano
// (problema clásico de Leaflet + bundlers). Un divIcon no necesita ningún
// asset externo.
const centerIcon = L.divIcon({
  className: '',
  html: '<div style="width:18px;height:18px;border-radius:9999px;background:#0d9488;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.45);"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

type Point = { lat: number; lng: number };

/**
 * Módulo "Zona de trabajo" del técnico: declara el centro (mapa Leaflet +
 * OpenStreetMap, sin cuenta ni API key) y el radio de cobertura que el
 * administrador usa para ordenar técnicos por distancia al asignar un
 * trabajo (ver plan-zona-trabajo-agenda.md, Fase 2 y 5). Guarda directo en
 * technicians.work_zone_* con un select/update acotado a esas columnas,
 * igual patrón que ProfessionalProfile.tsx y AvailabilityView.tsx — nunca
 * vía AppContext/supabaseMutations.
 */
export const WorkZone: React.FC = () => {
  const { currentUser, technicians, showToast, refreshRemoteData, navigate } = useApp();
  const tech = technicians.find((t) => t.id === currentUser?.technicianId);

  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [center, setCenter] = useState<Point | null>(null);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [loaded, setLoaded] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  // true justo después de geocodificar una localidad nueva — le dice al
  // efecto de sincronización de abajo que tiene que centrar Y acercar el
  // mapa ahí (a diferencia de un click o un arrastre del marcador, donde el
  // mapa ya está mostrando el lugar correcto y no hace falta moverlo).
  const justLocatedRef = useRef(false);

  useEffect(() => {
    const load = async () => {
      if (!tech) return;
      const { data, error } = await supabase
        .from('technicians')
        .select('work_zone_lat, work_zone_lng, work_zone_radius_km, work_zone_city, work_zone_province')
        .eq('id', tech.id)
        .single();
      if (error) {
        showToast('No pudimos cargar tu zona de trabajo.', 'error');
        setLoaded(true);
        return;
      }
      if (data?.work_zone_city) setCity(data.work_zone_city);
      if (data?.work_zone_province) setProvince(data.work_zone_province);
      if (data?.work_zone_radius_km != null) setRadiusKm(Number(data.work_zone_radius_km));
      if (data?.work_zone_lat != null && data?.work_zone_lng != null) {
        setCenter({ lat: Number(data.work_zone_lat), lng: Number(data.work_zone_lng) });
      }
      setLoaded(true);
    };
    void load();
  }, [tech?.id]);

  // Crea el mapa una sola vez, recién cuando ya sabemos si hay (o no) un
  // centro guardado — así no arranca centrado en Argentina entera para
  // después saltar a la localidad guardada apenas termina de cargar.
  useEffect(() => {
    if (!loaded || !mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: center ? [center.lat, center.lng] : ARGENTINA_CENTER,
      zoom: center ? TOWN_ZOOM : 4,
      scrollWheelZoom: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    map.on('click', (e: L.LeafletMouseEvent) => setCenter({ lat: e.latlng.lat, lng: e.latlng.lng }));
    mapRef.current = map;
  }, [loaded]);

  // Sincroniza el marcador arrastrable + el círculo de radio con el estado:
  // se dispara al geocodificar, al hacer click en el mapa, al arrastrar el
  // marcador, o al mover el slider de radio.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !center) return;
    const latlng: L.LatLngExpression = [center.lat, center.lng];

    if (!markerRef.current) {
      const marker = L.marker(latlng, { icon: centerIcon, draggable: true }).addTo(map);
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        setCenter({ lat: pos.lat, lng: pos.lng });
      });
      markerRef.current = marker;
    } else {
      markerRef.current.setLatLng(latlng);
    }

    if (!circleRef.current) {
      circleRef.current = L.circle(latlng, {
        radius: radiusKm * 1000,
        color: '#0d9488',
        fillColor: '#0d9488',
        fillOpacity: 0.15,
        weight: 2,
      }).addTo(map);
    } else {
      circleRef.current.setLatLng(latlng);
      circleRef.current.setRadius(radiusKm * 1000);
    }

    if (justLocatedRef.current) {
      // Búsqueda nueva (o la primera carga con centro guardado): siempre
      // saltamos ahí con zoom de localidad, sin importar dónde estaba el
      // mapa antes — si no, buscar una ciudad lejana mientras el mapa está
      // en otra parte dejaría el punto fuera de la vista.
      map.setView(latlng, TOWN_ZOOM);
      justLocatedRef.current = false;
    } else if (map.getZoom() < 6) {
      // Primera vez que aparece un centro y el mapa seguía en la vista de
      // Argentina entera (ej: click directo en el mapa sin geocodificar
      // antes).
      map.setView(latlng, TOWN_ZOOM);
    }
  }, [center, radiusKm]);

  const handleLocate = async () => {
    if (city.trim().length < 2 || province.trim().length < 2) {
      showToast('Indicá localidad y provincia.', 'warning');
      return;
    }
    setLocating(true);
    try {
      const point = await geocodeWorkZoneLocality(city.trim(), province.trim());
      if (!point) {
        showToast(
          'No pudimos ubicar esa localidad. Probá con otro nombre, o hacé click en el mapa para marcar el centro a mano.',
          'warning'
        );
        return;
      }
      justLocatedRef.current = true;
      setCenter(point);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No pudimos ubicar esa localidad.', 'error');
    } finally {
      setLocating(false);
    }
  };

  const handleSave = async () => {
    if (!tech || !center) {
      showToast('Ubicá primero el centro de tu zona en el mapa.', 'warning');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('technicians')
        .update({
          work_zone_lat: center.lat,
          work_zone_lng: center.lng,
          work_zone_radius_km: radiusKm,
          work_zone_city: city.trim() || null,
          work_zone_province: province.trim() || null,
        })
        .eq('id', tech.id);
      if (error) throw error;
      showToast('Zona de trabajo guardada.', 'success');
      await refreshRemoteData();
    } catch {
      showToast('No se pudo guardar la zona de trabajo.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!tech) return null;

  return (
    <main className="min-h-screen bg-slate-100/70 dark:bg-slate-900/80 pb-12">
      <div className="bg-[#0F172A] text-white border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-5">
          <div className="flex gap-3 items-center justify-between">
            <div className="flex gap-3 items-center">
              <div className="w-10 h-10 rounded-xl bg-teal-500/15 text-teal-300 flex items-center justify-center">
                <MapPinned className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-bold">Zona de trabajo</h1>
                <p className="text-xs text-slate-400">
                  Declará el centro y el radio donde querés recibir trabajos. El administrador lo usa para asignarte por cercanía.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/technician')}
              aria-label="Volver a la Terminal de Campo"
              className="shrink-0 rounded-lg border border-slate-700 p-2 text-slate-200 hover:border-teal-500 hover:text-teal-300"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <h2 className="text-sm font-bold">Localidad</h2>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Escribí tu localidad base y tocá "Ubicar" — después podés ajustar el centro arrastrando el punto en el mapa, o
            haciendo click en otro lugar.
          </p>
          <div className="mt-3 grid sm:grid-cols-[1fr_140px_auto] gap-2">
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-sm"
              placeholder="Localidad (ej: Glew)"
            />
            <input
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-sm"
              placeholder="Provincia"
            />
            <button
              onClick={() => void handleLocate()}
              disabled={locating}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-teal-300 disabled:opacity-60"
            >
              <LocateFixed className="w-3.5 h-3.5" /> {locating ? 'Ubicando…' : 'Ubicar'}
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold">Radio de cobertura</h2>
            <span className="text-sm font-bold text-teal-700 dark:text-teal-400">{radiusKm} km</span>
          </div>
          <input
            type="range"
            min={MIN_RADIUS_KM}
            max={MAX_RADIUS_KM}
            step={1}
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            className="mt-3 w-full"
          />
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Entre {MIN_RADIUS_KM} y {MAX_RADIUS_KM} km — más allá deja de ser razonable viajar para un trabajo.
          </p>
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
          <div ref={mapContainerRef} className="w-full h-[360px]" />
          {!center && (
            <p className="p-3 text-[11px] text-slate-500 dark:text-slate-400">
              Todavía no hay un centro elegido — usá "Ubicar" arriba o hacé click en cualquier punto del mapa.
            </p>
          )}
        </section>

        <button
          onClick={() => void handleSave()}
          disabled={saving || !center}
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"
        >
          <Save className="w-3.5 h-3.5" /> {saving ? 'Guardando…' : 'Guardar zona de trabajo'}
        </button>
      </div>
    </main>
  );
};
