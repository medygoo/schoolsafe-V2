-- Templates système par défaut pour les notifications de sécurité QR
-- school_id NULL = template applicable à toutes les écoles

insert into public.notification_templates (school_id, event_type, channel, language, subject, body, variables, active)
values
  -- STUDENT_ENTERED
  (null, 'STUDENT_ENTERED', 'EMAIL', 'fr', 'Entrée à l''école', 'Bonjour {{parent_name}}, {{student_name}} est entré(e) à l''école à {{time}} le {{date}}.', '["parent_name", "student_name", "time", "date"]'::jsonb, true),
  (null, 'STUDENT_ENTERED', 'IN_APP', 'fr', 'Entrée enregistrée', '{{student_name}} est entré(e) à {{time}}.', '["student_name", "time"]'::jsonb, true),
  (null, 'STUDENT_ENTERED', 'PUSH', 'fr', 'Entrée', '{{student_name}} est entré(e) à l''école.', '["student_name"]'::jsonb, true),

  -- STUDENT_EXITED
  (null, 'STUDENT_EXITED', 'EMAIL', 'fr', 'Sortie de l''école', 'Bonjour {{parent_name}}, {{student_name}} est sorti(e) à {{time}} le {{date}} avec {{authorized_person_name}}.', '["parent_name", "student_name", "time", "date", "authorized_person_name"]'::jsonb, true),
  (null, 'STUDENT_EXITED', 'IN_APP', 'fr', 'Sortie enregistrée', '{{student_name}} est sorti(e) à {{time}} avec {{authorized_person_name}}.', '["student_name", "time", "authorized_person_name"]'::jsonb, true),
  (null, 'STUDENT_EXITED', 'PUSH', 'fr', 'Sortie', '{{student_name}} est sorti(e) de l''école.', '["student_name"]'::jsonb, true),

  -- UNAUTHORIZED_EXIT_ATTEMPT
  (null, 'UNAUTHORIZED_EXIT_ATTEMPT', 'EMAIL', 'fr', 'Tentative de sortie non autorisée', 'Bonjour {{parent_name}}, une tentative de sortie non autorisée a été signalée pour {{student_name}} à {{time}}.', '["parent_name", "student_name", "time"]'::jsonb, true),
  (null, 'UNAUTHORIZED_EXIT_ATTEMPT', 'IN_APP', 'fr', 'Alerte sécurité', 'Tentative de sortie non autorisée pour {{student_name}}.', '["student_name"]'::jsonb, true),
  (null, 'UNAUTHORIZED_EXIT_ATTEMPT', 'PUSH', 'fr', 'Alerte sécurité', 'Tentative de sortie non autorisée pour {{student_name}}.', '["student_name"]'::jsonb, true),

  -- LOCKDOWN_ACTIVATED
  (null, 'LOCKDOWN_ACTIVATED', 'EMAIL', 'fr', 'Mode lockdown activé', 'Le mode lockdown a été activé par {{activated_by_name}} à {{time}}. Les sorties d''élèves sont temporairement interdites.', '["activated_by_name", "time"]'::jsonb, true),
  (null, 'LOCKDOWN_ACTIVATED', 'IN_APP', 'fr', 'Lockdown', 'Mode lockdown activé à {{time}}.', '["time"]'::jsonb, true),
  (null, 'LOCKDOWN_ACTIVATED', 'PUSH', 'fr', 'Lockdown', 'Mode lockdown activé.', '[]'::jsonb, true)
on conflict (school_id, event_type, channel, language) do update set
  subject = excluded.subject,
  body = excluded.body,
  variables = excluded.variables,
  active = excluded.active;
