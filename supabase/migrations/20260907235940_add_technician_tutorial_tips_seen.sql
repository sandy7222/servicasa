-- Tracks which in-app "tutorial" tips (the game-style guide character that
-- coaches a technician through an order's lifecycle — new assignment,
-- travel, arrival/diagnosis, quote sent, work started, checklist complete)
-- have already been shown, so they appear once per technician and never
-- nag again. Stored server-side (not localStorage) so it follows the
-- technician across devices/browsers. Self-updatable: the existing
-- technicians_update_own_professional_profile policy already lets a
-- technician update their own row, and lock_technician_admin_fields() only
-- protects admin-controlled columns (validation_status, is_enabled, rating,
-- counts) — this new column is untouched by that trigger.
alter table public.technicians
  add column tutorial_tips_seen text[] not null default '{}';
