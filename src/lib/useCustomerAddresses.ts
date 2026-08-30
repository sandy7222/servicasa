import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { CustomerAddress } from '../types';

type DbCustomerAddress = {
  id: string;
  label: string | null;
  address_line: string;
  neighborhood: string | null;
  city: string;
  is_default: boolean;
};

function mapAddress(row: DbCustomerAddress): CustomerAddress {
  return {
    id: row.id,
    label: row.label,
    addressLine: row.address_line,
    neighborhood: row.neighborhood,
    city: row.city,
    isDefault: row.is_default,
  };
}

export type CustomerAddressInput = {
  label?: string | null;
  addressLine: string;
  neighborhood?: string | null;
  city: string;
};

/** Único punto de CRUD sobre customer_addresses — usado tanto por
 * ServiceRequestForm.tsx (elegir/guardar al pedir un servicio) como por
 * CustomerAddressesPanel.tsx ("Mi perfil"), para no repetir el mismo tipo
 * de bug de "dos caminos que debían escribir lo mismo" ya visto antes en
 * este proyecto. RLS (customer_addresses_owner_write_or_admin) ya
 * restringe cada operación al dueño real. Ver
 * docs/adr-address-redesign.md, Fase 3. */
export function useCustomerAddresses(customerId: string | undefined) {
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!customerId) {
      setAddresses([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('customer_addresses')
      .select('id, label, address_line, neighborhood, city, is_default')
      .eq('customer_id', customerId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) {
      console.warn('[useCustomerAddresses] No se pudieron cargar las direcciones guardadas', error);
      return;
    }
    setAddresses((data ?? []).map(mapAddress));
  }, [customerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createAddress = useCallback(
    async (input: CustomerAddressInput, makeDefault: boolean): Promise<CustomerAddress | null> => {
      if (!customerId) return null;
      const isFirst = addresses.length === 0;
      const { data, error } = await supabase
        .from('customer_addresses')
        .insert({
          customer_id: customerId,
          label: input.label?.trim() || null,
          address_line: input.addressLine,
          neighborhood: input.neighborhood?.trim() || null,
          city: input.city,
          is_default: isFirst || makeDefault,
        })
        .select('id, label, address_line, neighborhood, city, is_default')
        .single();
      if (error || !data) {
        console.warn('[useCustomerAddresses] No se pudo guardar la dirección', error);
        return null;
      }
      if (makeDefault && !isFirst) {
        await supabase.from('customer_addresses').update({ is_default: false }).eq('customer_id', customerId).neq('id', data.id);
      }
      await refresh();
      return mapAddress(data as DbCustomerAddress);
    },
    [customerId, addresses.length, refresh]
  );

  const updateAddress = useCallback(
    async (id: string, input: CustomerAddressInput): Promise<boolean> => {
      const { error } = await supabase
        .from('customer_addresses')
        .update({
          label: input.label?.trim() || null,
          address_line: input.addressLine,
          neighborhood: input.neighborhood?.trim() || null,
          city: input.city,
        })
        .eq('id', id);
      if (error) {
        console.warn('[useCustomerAddresses] No se pudo actualizar la dirección', error);
        return false;
      }
      await refresh();
      return true;
    },
    [refresh]
  );

  const deleteAddress = useCallback(
    async (id: string): Promise<boolean> => {
      const { error } = await supabase.from('customer_addresses').delete().eq('id', id);
      if (error) {
        console.warn('[useCustomerAddresses] No se pudo eliminar la dirección', error);
        return false;
      }
      await refresh();
      return true;
    },
    [refresh]
  );

  const setDefaultAddress = useCallback(
    async (id: string): Promise<boolean> => {
      if (!customerId) return false;
      const { error: unsetError } = await supabase
        .from('customer_addresses')
        .update({ is_default: false })
        .eq('customer_id', customerId);
      if (unsetError) {
        console.warn('[useCustomerAddresses] No se pudo actualizar la dirección predeterminada', unsetError);
        return false;
      }
      const { error } = await supabase.from('customer_addresses').update({ is_default: true }).eq('id', id);
      if (error) {
        console.warn('[useCustomerAddresses] No se pudo marcar la dirección predeterminada', error);
        return false;
      }
      await refresh();
      return true;
    },
    [customerId, refresh]
  );

  return { addresses, loading, refresh, createAddress, updateAddress, deleteAddress, setDefaultAddress };
}
