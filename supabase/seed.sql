-- SchoolSafe F1 local/staging seed. Synthetic data only; never production data.

insert into public.school (id, code, name)
values ('10000000-0000-0000-0000-000000000001', 'TEST-SCHOOL', 'SchoolSafe Test School')
on conflict (id) do nothing;

insert into public.school_settings (school_id, max_offline_hours)
values ('10000000-0000-0000-0000-000000000001', 24)
on conflict (school_id) do nothing;

insert into public.roles (id, code, label) values
  ('20000000-0000-0000-0000-000000000001', 'admin', 'Administrateur'),
  ('20000000-0000-0000-0000-000000000002', 'school_head', 'Direction'),
  ('20000000-0000-0000-0000-000000000003', 'pedagogy', 'Direction pédagogique'),
  ('20000000-0000-0000-0000-000000000004', 'teacher', 'Enseignant'),
  ('20000000-0000-0000-0000-000000000005', 'cashier', 'Caisse'),
  ('20000000-0000-0000-0000-000000000006', 'guard', 'Gardien'),
  ('20000000-0000-0000-0000-000000000007', 'parent', 'Parent')
on conflict (id) do nothing;

insert into public.permissions (id, code, description) values
  ('30000000-0000-0000-0000-000000000001', 'session.bootstrap', 'Charger le contexte de session'),
  ('30000000-0000-0000-0000-000000000002', 'school.class.read', 'Lire les classes autorisées'),
  ('30000000-0000-0000-0000-000000000003', 'school.student.read', 'Lire les élèves autorisés'),
  ('30000000-0000-0000-0000-000000000004', 'school.guardian.read', 'Lire les tuteurs autorisés'),
  ('30000000-0000-0000-0000-000000000005', 'school.guardian.manage', 'Gérer les tuteurs autorisés'),
  ('30000000-0000-0000-0000-000000000006', 'security.pickup.read', 'Lire les sorties autorisées'),
  ('30000000-0000-0000-0000-000000000007', 'security.pickup.manage', 'Gérer les sorties autorisées'),
  ('30000000-0000-0000-0000-000000000008', 'finance.status.read', 'Lire le statut financier autorisé'),
  ('30000000-0000-0000-0000-000000000009', 'sync.submit', 'Soumettre des opérations synchronisées'),
  ('30000000-0000-0000-0000-000000000010', 'file.upload', 'Téléverser un fichier autorisé'),
  ('30000000-0000-0000-0000-000000000011', 'file.download', 'Télécharger un fichier autorisé'),
  ('30000000-0000-0000-0000-000000000012', 'notification.subscribe', 'Gérer un abonnement de notification')
on conflict (id) do nothing;
