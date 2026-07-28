-- Seed seguro para arranques normales: no borra datos existentes.
-- Solo asegura catálogos base mínimos y crea las cuentas iniciales si aún no existen.

insert into categories (name, description) values
  ('Uñas', 'Manicure, acrílicas, soft gel y nail art.'),
  ('Maquillaje', 'Maquillaje social, novias y eventos.'),
  ('Peinados', 'Ondas, laceados, recogidos y peinados para eventos.'),
  ('Otros', 'Pedidos personalizados para cotizar con IA cuando no están en el catálogo.')
on conflict (name) do nothing;

insert into users (dni, full_name, birth_date, phone, email, password_hash, plain_password, role_code, loyalty_points, is_active) values
  ('SA', 'Súper Admin', '1990-01-01', null, 'sa@nailbeauty.test', '3dd6b9265ff18f31dc30df59304b0ca7:9d59321d7c731240826349888eb92566f4a83899bbe6d70b1a29d14defc2f92f3fdbf0e8023ac764ae431d36c05f8873588d4279931005ab63518287bcdb2a03', 'SA', 'SA', 0, true),
  ('Dueña', 'Dueña', '1991-02-02', null, 'duena@nailbeauty.test', 'e814cd0cd92da886068bc3cec0dcdbe2:f9a427f3bf7807c070ceb459ff810eb1caa7e59b9bc8ca511760c4a1ab79ec9db9d6e29ba39d768ed27df00516051c7957e4195364e7f820b6c56855d8e2e93d', 'Dueña', 'OWNER', 0, true),
  ('Cliente', 'Cliente', '1995-05-31', null, 'cliente@nailbeauty.test', '7efef3fb2ec47bd2bb0d79f58a0312a6:2aaabb2503cb9657bc2f97197ef292b393603fb581ba0c469b432c1d0ae180a3d503549a82bddf20af6310ecb10de4401bdd7faa48ff9028a669bb3596ecf5fd', 'Cliente', 'USER', 0, true)
on conflict (dni) do nothing;

insert into payment_methods (code, name, provider, requires_reference) values
  ('cash', 'Efectivo', null, false),
  ('card', 'Tarjeta débito/crédito', 'POS', true),
  ('yape', 'Yape', 'BCP', true),
  ('plin', 'Plin', 'Interbank/BBVA/Scotiabank', true),
  ('transfer', 'Transferencia bancaria', 'Banco', true)
on conflict (code) do nothing;
