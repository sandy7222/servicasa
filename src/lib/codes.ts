/** Human-friendly display codes for clients/technicians — separate from the
 * internal UUID, meant for phone calls, quick search, and accounting
 * references. See supabase/sql/add_customer_technician_numbers.sql. */
export const formatCustomerCode = (n: number | undefined) =>
  n ? `CLI-${String(n).padStart(4, '0')}` : null;

export const formatTechnicianCode = (n: number | undefined) =>
  n ? `TEC-${String(n).padStart(4, '0')}` : null;
