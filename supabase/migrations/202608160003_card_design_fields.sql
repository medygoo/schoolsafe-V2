-- SchoolSafe V2 — Complément design des cartes par classe
-- Ajoute les champs nécessaires pour reproduire les familles, variantes et modes patrimoine.

alter table public.classes
  add column if not exists card_family text not null default 'A' check (card_family in ('A','B','C','D','E','F','G','H','I','J')),
  add column if not exists card_variant integer not null default 0 check (card_variant between 0 and 3),
  add column if not exists card_pat_style text not null default 'vignette' check (card_pat_style in ('vignette','fond','both'));

comment on column public.classes.card_family is 'Famille de design A-J (Arc-en-ciel, Océan, Pop Bento, Prestige Or, etc.)';
comment on column public.classes.card_variant is 'Index 0-3 de la variante de couleur dans la famille';
comment on column public.classes.card_pat_style is 'Mode d affichage du patrimoine : vignette, fond, ou both';
