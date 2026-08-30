-- persistCreateCustomerSelf() (autorregistro de cliente sin invitación) solo
-- escribía customers.profile_id, nunca profiles.customer_id -- a diferencia
-- de redeem_account_invite(), que enlaza las dos columnas en la misma
-- transacción. Sin este backfill, cualquier cliente que se haya
-- autorregistrado (en vez de entrar por una invitación del admin) queda con
-- profiles.customer_id en NULL para siempre, y toda pantalla que dependa de
-- currentUser.customerId (ej. ServiceRequestForm) lo rechaza con "Tu cuenta
-- todavía no tiene un perfil de cliente vinculado", aunque la ficha de admin
-- ya lo muestre como "Ya tiene cuenta". Afecta a 3 clientes reales hoy:
-- Marcos Abate, Juan Carlos Muccela, Rebeca Ardiles.
update public.profiles p
set customer_id = c.id
from public.customers c
where c.profile_id = p.id
  and p.customer_id is null;
