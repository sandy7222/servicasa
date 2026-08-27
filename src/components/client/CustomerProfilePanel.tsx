import React, { useEffect, useState } from 'react';
import { Camera, Save, UserRound } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';

export const CustomerProfilePanel: React.FC = () => {
  const { currentUser, customers, setCurrentUser, showToast } = useApp();
  const customerRecord = customers.find((c) => c.id === currentUser?.customerId);
  const [name, setName] = useState(currentUser?.name ?? '');
  const [phone, setPhone] = useState(customerRecord?.phone ?? '');
  const [avatarPreview, setAvatarPreview] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentUser?.avatarUrl || !isSupabaseConfigured) return;
    void supabase.storage.from('avatars').createSignedUrl(currentUser.avatarUrl, 3600).then(({ data }) => setAvatarPreview(data?.signedUrl));
  }, [currentUser?.avatarUrl]);

  // The customer record loads asynchronously after this component mounts —
  // sync the phone field once it arrives instead of leaving it blank forever.
  useEffect(() => {
    if (customerRecord?.phone) setPhone(customerRecord.phone);
  }, [customerRecord?.phone]);

  if (!currentUser) return null;

  const uploadAvatar = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) {
      showToast('Elegí una imagen de hasta 2 MB.', 'warning'); return;
    }
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${currentUser.id}/avatar.${extension}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
    if (error) { showToast('No se pudo cargar el avatar.', 'error'); return; }
    const { data } = await supabase.storage.from('avatars').createSignedUrl(path, 3600);
    setAvatarPreview(data?.signedUrl); setCurrentUser({ ...currentUser, avatarUrl: path });
  };

  const save = async () => {
    setSaving(true);
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.from('profiles').update({ full_name: name.trim(), avatar_url: currentUser.avatarUrl ?? null }).eq('id', currentUser.id);
        if (error) throw error;
        if (currentUser.customerId) await supabase.from('customers').update({ name: name.trim(), phone: phone.trim() || undefined }).eq('id', currentUser.customerId);
      }
      setCurrentUser({ ...currentUser, name: name.trim(), avatarText: name.trim().slice(0, 2).toUpperCase() });
      showToast('Perfil actualizado.', 'success');
    } catch { showToast('No se pudo guardar el perfil.', 'error'); } finally { setSaving(false); }
  };

  return <section className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-3">
    <div className="flex items-center gap-2"><UserRound className="w-4 h-4 text-teal-600" /><div><h3 className="text-sm font-bold">Mi perfil</h3><p className="text-[11px] text-slate-500">Solo datos necesarios para identificar tu cuenta.</p></div></div>
    <div className="flex items-center gap-4"><div className="w-16 h-16 rounded-full bg-teal-50 border border-teal-200 overflow-hidden flex items-center justify-center font-bold text-teal-700">{avatarPreview ? <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" /> : currentUser.avatarText}</div><label className="cursor-pointer text-xs font-bold text-teal-700"><Camera className="inline w-4 h-4 mr-1" />Elegir avatar<input type="file" accept="image/*" className="hidden" onChange={(e) => void uploadAvatar(e.target.files?.[0])} /></label></div>
    <div className="grid sm:grid-cols-2 gap-2"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre y apellido" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" /><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono (opcional)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" /></div>
    <p className="text-xs text-slate-500">Correo: <strong>{currentUser.email}</strong></p><button onClick={() => void save()} disabled={!name.trim() || saving} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Save className="w-3.5 h-3.5" />{saving ? 'Guardando…' : 'Guardar cambios'}</button>
  </section>;
};
