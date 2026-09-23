import React, { useEffect, useState } from 'react';
import { Building2, Mail, Phone } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../context/AppContext';

type Lead = {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  service_type: string | null;
  description: string;
  status: string;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  new: 'Nueva',
  contacted: 'Contactada',
  closed: 'Cerrada',
};

export const BusinessLeadsPanel: React.FC = () => {
  const { showToast } = useApp();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data, error } = await supabase
      .from('business_leads')
      .select('id, company_name, contact_name, email, phone, service_type, description, status, created_at')
      .order('created_at', { ascending: false });
    if (error) {
      showToast('No se pudieron cargar las consultas de empresas.', 'error');
      setLoading(false);
      return;
    }
    setLeads((data ?? []) as Lead[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('business_leads').update({ status }).eq('id', id);
    if (error) {
      showToast('No se pudo actualizar el estado.', 'error');
      return;
    }
    setLeads((prev) => prev.map((lead) => (lead.id === id ? { ...lead, status } : lead)));
  };

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Consultas de empresas</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">Leads del formulario B2B de la landing.</p>
      </div>
      {loading ? (
        <p className="text-xs text-slate-500">Cargando…</p>
      ) : leads.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400 rounded-xl border border-dashed border-slate-300 p-6 text-center">
          Todavía no llegó ninguna consulta de empresa.
        </p>
      ) : (
        <div className="space-y-2">
          {leads.map((lead) => (
            <article key={lead.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-teal-600" />
                    {lead.company_name}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{lead.contact_name}</p>
                </div>
                <select
                  value={lead.status}
                  onChange={(event) => void setStatus(lead.id, event.target.value)}
                  className="text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 bg-white dark:bg-slate-950"
                >
                  {Object.entries(STATUS_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300">{lead.description}</p>
              <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {lead.email}
                </span>
                {lead.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {lead.phone}
                  </span>
                )}
                {lead.service_type && <span>Rubro: {lead.service_type}</span>}
                <span>{new Date(lead.created_at).toLocaleString('es-AR')}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
