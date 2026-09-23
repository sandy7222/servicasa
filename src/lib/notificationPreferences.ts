import { supabase } from './supabase';

export type NotificationPreferences = {
  emailAssignment: boolean;
  emailQuote: boolean;
  emailPayment: boolean;
};

const DEFAULTS: NotificationPreferences = {
  emailAssignment: true,
  emailQuote: true,
  emailPayment: true,
};

export async function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('email_assignment, email_quote, email_payment')
    .maybeSingle();
  if (error || !data) return DEFAULTS;
  return {
    emailAssignment: data.email_assignment !== false,
    emailQuote: data.email_quote !== false,
    emailPayment: data.email_payment !== false,
  };
}

export async function saveNotificationPreferences(prefs: NotificationPreferences): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const profileId = sessionData.session?.user.id;
  if (!profileId) throw new Error('Sesión expirada.');
  const { error } = await supabase.from('notification_preferences').upsert({
    profile_id: profileId,
    email_assignment: prefs.emailAssignment,
    email_quote: prefs.emailQuote,
    email_payment: prefs.emailPayment,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}
