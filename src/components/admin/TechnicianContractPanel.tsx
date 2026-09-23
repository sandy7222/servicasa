import React, { useEffect, useMemo, useState } from 'react';
import { FileSignature, Printer, Save, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { fetchSettings, getSettingValue, updateSetting } from '../../lib/settings';
import { buildTechnicianContractText } from '../../lib/contractDocument';
import { supabase } from '../../lib/supabase';
import { sha256Hex } from '../../lib/legalAcceptance';

/**
 * Módulo "Contratos" del Hub de Admin (charla con Sandy, 13/9): elegís un
 * técnico y se genera el Contrato de Prestación de Servicios Independientes
 * prellenado con sus datos (los mismos que ya tiene su ficha), listo para
 * imprimir con un botón. Complementa — no reemplaza — los Términos y
 * Condiciones que el técnico ya aceptó al darse de alta (ver
 * plan-terminos-y-condiciones.md); acá se arma el papel firmable. Texto
 * legal: borrador técnico, pendiente de revisión por un abogado, mismo
 * criterio que src/lib/legalTerms.ts. Ver plan-contrato-tecnico.md.
 */
export const TechnicianContractPanel: React.FC = () => {
  const { technicians, updateTechnician, showToast, currentUser } = useApp();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [commissionRate, setCommissionRate] = useState(0.17);
  const [platformName, setPlatformName] = useState('');
  const [platformCuit, setPlatformCuit] = useState('');
  const [platformNameDraft, setPlatformNameDraft] = useState('');
  const [platformCuitDraft, setPlatformCuitDraft] = useState('');
  const [savingPlatformData, setSavingPlatformData] = useState(false);

  const [dniDraft, setDniDraft] = useState('');
  const [cuitDraft, setCuitDraft] = useState('');
  const [savingTechData, setSavingTechData] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchSettings()
      .then((rows) => {
        if (cancelled) return;
        setCommissionRate(getSettingValue<number>(rows, 'platform_commission_rate'));
        const name = getSettingValue<string>(rows, 'platform_legal_name');
        const cuit = getSettingValue<string>(rows, 'platform_legal_cuit');
        setPlatformName(name);
        setPlatformCuit(cuit);
        setPlatformNameDraft(name);
        setPlatformCuitDraft(cuit);
      })
      .catch(() => {
        /* Se sigue con los defaults locales (17%, sin datos de la Plataforma) */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Al cambiar de técnico seleccionado, arrancamos el mini-form de
    // DNI/CUIT con lo que ya tenga cargado (si tiene).
    const tech = technicians.find((t) => t.id === selectedId);
    setDniDraft(tech?.dni ?? '');
    setCuitDraft(tech?.cuit ?? '');
  }, [selectedId, technicians]);

  useEffect(() => {
    const onAfterPrint = () => document.body.classList.remove('printing-contract');
    window.addEventListener('afterprint', onAfterPrint);
    return () => window.removeEventListener('afterprint', onAfterPrint);
  }, []);

  const filteredTechnicians = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return technicians;
    return technicians.filter(
      (t) => t.name.toLowerCase().includes(q) || (t.email ?? '').toLowerCase().includes(q)
    );
  }, [technicians, search]);

  const selectedTechnician = technicians.find((t) => t.id === selectedId) ?? null;

  const handleSavePlatformData = async () => {
    setSavingPlatformData(true);
    try {
      await updateSetting('platform_legal_name', platformNameDraft.trim());
      await updateSetting('platform_legal_cuit', platformCuitDraft.trim());
      setPlatformName(platformNameDraft.trim());
      setPlatformCuit(platformCuitDraft.trim());
      showToast('Datos de la Plataforma guardados', 'success');
    } catch {
      showToast('No se pudieron guardar los datos de la Plataforma', 'error');
    } finally {
      setSavingPlatformData(false);
    }
  };

  const handleSaveTechnicianData = () => {
    if (!selectedTechnician) return;
    setSavingTechData(true);
    try {
      updateTechnician(selectedTechnician.id, {
        name: selectedTechnician.name,
        specialtyIds: selectedTechnician.specialties.map((s) => s.id),
        phone: selectedTechnician.phone,
        email: selectedTechnician.email,
        zone: selectedTechnician.zone,
        province: selectedTechnician.province,
        address: selectedTechnician.address,
        rating: selectedTechnician.rating,
        dni: dniDraft.trim() || undefined,
        cuit: cuitDraft.trim() || undefined,
      });
    } finally {
      setSavingTechData(false);
    }
  };

  const handlePrint = () => {
    document.body.classList.add('printing-contract');
    window.print();
    if (selectedTechnician && contractText) {
      void sha256Hex(contractText).then((documentHash) =>
        supabase.from('technician_contracts').insert({
          technician_id: selectedTechnician.id,
          generated_by: currentUser?.id ?? null,
          document_hash: documentHash,
          document_version: new Date().toISOString().slice(0, 10),
        })
      );
    }
  };

  const contractText = selectedTechnician
    ? buildTechnicianContractText({
        technician: selectedTechnician,
        commissionRate,
        platformLegalName: platformName,
        platformLegalCuit: platformCuit,
      })
    : null;

  const missingTechData = selectedTechnician && (!selectedTechnician.dni || !selectedTechnician.cuit);

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Contrato de Prestación de Servicios</h2>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Elegí un técnico para generar su contrato con los datos que ya tiene cargados, y usá
          "Imprimir" para sacarlo en papel o guardarlo como PDF. Texto borrador, pendiente de
          revisión por un abogado antes de usarlo para firmar.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 border border-slate-200 dark:border-slate-700 space-y-2">
        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">Datos de "LA PLATAFORMA" (se cargan una sola vez)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:items-end">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Razón social / nombre</label>
            <input
              type="text"
              value={platformNameDraft}
              onChange={(e) => setPlatformNameDraft(e.target.value)}
              placeholder="Ej: Sebastián Borrego"
              className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 rounded-lg focus:bg-white"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">CUIT</label>
            <input
              type="text"
              value={platformCuitDraft}
              onChange={(e) => setPlatformCuitDraft(e.target.value)}
              placeholder="20-XXXXXXXX-X"
              className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 rounded-lg focus:bg-white"
            />
          </div>
          <button
            type="button"
            onClick={() => void handleSavePlatformData()}
            disabled={savingPlatformData}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#0F172A] hover:bg-slate-800 disabled:opacity-60 text-teal-300 text-xs font-bold rounded-lg transition-colors border border-slate-700"
          >
            <Save className="w-3.5 h-3.5" />
            Guardar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-700 space-y-2 h-fit">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar técnico…"
              className="w-full text-xs pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 rounded-lg focus:bg-white"
            />
          </div>
          <div className="max-h-96 overflow-y-auto space-y-1">
            {filteredTechnicians.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedId(t.id)}
                className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors ${
                  selectedId === t.id
                    ? 'bg-[#0F172A] text-teal-300'
                    : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900'
                }`}
              >
                <div className="font-bold">{t.name}</div>
                <div className="text-[10px] opacity-70">{t.specialty || 'Sin rubro'}</div>
              </button>
            ))}
            {filteredTechnicians.length === 0 && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 px-2 py-3">
                No hay técnicos que coincidan.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {!selectedTechnician || !contractText ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-8 border border-slate-200 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400">
              Elegí un técnico de la lista para generar su contrato.
            </div>
          ) : (
            <>
              {missingTechData && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3 space-y-2">
                  <p className="text-[11px] text-amber-900 dark:text-amber-200">
                    A {selectedTechnician.name} le falta{' '}
                    {!selectedTechnician.dni && !selectedTechnician.cuit
                      ? 'el DNI y el CUIT/monotributo'
                      : !selectedTechnician.dni
                        ? 'el DNI'
                        : 'el CUIT/monotributo'}{' '}
                    en su ficha. Completalo acá para que quede guardado y el contrato salga completo.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:items-end">
                    <div>
                      <label className="block text-[11px] font-bold text-amber-900 dark:text-amber-200 mb-1">DNI</label>
                      <input
                        type="text"
                        value={dniDraft}
                        onChange={(e) => setDniDraft(e.target.value)}
                        className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-950 border border-amber-300 dark:border-amber-800 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-amber-900 dark:text-amber-200 mb-1">
                        CUIT / monotributo
                      </label>
                      <input
                        type="text"
                        value={cuitDraft}
                        onChange={(e) => setCuitDraft(e.target.value)}
                        placeholder="20-XXXXXXXX-X"
                        className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-950 border border-amber-300 dark:border-amber-800 rounded-lg"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveTechnicianData}
                      disabled={savingTechData}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-xs font-bold rounded-lg"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Guardar
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#0F172A] hover:bg-slate-800 text-teal-300 text-xs font-bold rounded-lg transition-colors border border-slate-700 shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir contrato
                </button>
              </div>

              <div className="printable-contract bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-700 text-xs leading-relaxed text-slate-800 dark:text-slate-200 space-y-3">
                <div className="no-print flex items-center gap-2 mb-2">
                  <FileSignature className="w-4 h-4 text-teal-600" />
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Vista previa — así sale impreso
                  </span>
                </div>
                <h1 className="text-sm font-black text-center text-slate-900 dark:text-slate-100 uppercase">
                  Contrato de Prestación de Servicios Independientes
                </h1>
                {contractText.split('\n\n').map((paragraph, i) => (
                  <p key={i} className="whitespace-pre-line">
                    {paragraph}
                  </p>
                ))}
                <div className="grid grid-cols-2 gap-6 pt-10 mt-6 text-center text-[11px]">
                  <div className="border-t border-slate-400 pt-1">
                    LA PLATAFORMA{platformName ? ` — ${platformName}` : ''}
                  </div>
                  <div className="border-t border-slate-400 pt-1">EL PRESTADOR — {selectedTechnician.name}</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
