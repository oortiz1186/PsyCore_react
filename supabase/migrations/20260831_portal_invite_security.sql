alter table public.patient_portal_invites
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid references public.profiles(id) on delete set null;

create unique index if not exists uq_patient_portal_invites_token_hash
  on public.patient_portal_invites(token_hash);

create index if not exists idx_patient_portal_invites_patient_active
  on public.patient_portal_invites(patient_id, expires_at desc)
  where revoked_at is null;
