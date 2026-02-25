-- How did you hear about us? (signup attribution)
alter table public.users
  add column if not exists how_did_you_hear text,
  add column if not exists how_did_you_hear_other text;
