insert into categories (name, description) values
  ('Uñas', 'Manicure, acrílicas, soft gel y nail art.'),
  ('Maquillaje', 'Maquillaje social, novias y eventos.'),
  ('Peinados', 'Ondas, laceados, recogidos y peinados para eventos.')
on conflict (name) do update set description=excluded.description;

insert into users (dni, full_name, birth_date, phone, email, password_hash, plain_password, role_code, loyalty_points) values
  ('00000001', 'Súper Admin Nail Beauty', '1990-01-01', '+51900000001', 'sa@nailbeauty.test', '6d96c29a8d84eaa042032a4a23fa5b55:1222b0dba444529d5e481139efc5a49f3bdda11556bc642d6172d046cea692f75ffd3fa1f349a30ae1e31e620a6a9bc2b1c0fdda411a07cf2dc64d2a13c4d094', 'Admin123!', 'SA', 0),
  ('00000002', 'Dueña Nail Beauty', '1991-02-02', '+51900000002', 'duena@nailbeauty.test', '95696b174cf84c0a63cb11d9c1974d6d:d70bcef1f5992ef081ef407d62e3d341a35e2891049c1f7ecfbc415165ec58b5c690dea5c8d8dbf49596344ad2029add04e3d7f66afd9ecc63658e7f64ad9066', 'Duena123!', 'OWNER', 0),
  ('00000003', 'Andrea Cliente', '1995-05-31', '+51900000003', 'andrea@nailbeauty.test', '113f91ab98609ec4e95079bbee8aeb59:3e6a81906c744d5dda9e14c795b0b59daca6efe38025d6c35c2948edd4dc19d3454aa9f2930eb38cc452fa8b79ccacce0460e9f1a5f62fe544aedf965f2401c6', 'Andrea123!', 'USER', 250),
  ('90000001', 'Valeria Torres', '1996-03-10', '+51911111111', 'valeria@nailbeauty.test', '113f91ab98609ec4e95079bbee8aeb59:3e6a81906c744d5dda9e14c795b0b59daca6efe38025d6c35c2948edd4dc19d3454aa9f2930eb38cc452fa8b79ccacce0460e9f1a5f62fe544aedf965f2401c6', 'Andrea123!', 'WORKER', 0),
  ('90000002', 'Daniela Ruiz', '1997-07-21', '+51922222222', 'daniela@nailbeauty.test', '113f91ab98609ec4e95079bbee8aeb59:3e6a81906c744d5dda9e14c795b0b59daca6efe38025d6c35c2948edd4dc19d3454aa9f2930eb38cc452fa8b79ccacce0460e9f1a5f62fe544aedf965f2401c6', 'Andrea123!', 'WORKER', 0)
on conflict (dni) do update set plain_password=excluded.plain_password, role_code=excluded.role_code;

insert into specialists (user_id, full_name, phone, email, bio, work_start, work_end)
select u.id, u.full_name, u.phone, u.email, case when u.dni='90000001' then 'Especialista en manicure gel, acrílicas y nail art.' else 'Especialista en maquillaje social y peinados.' end, case when u.dni='90000001' then '13:00'::time else '09:00'::time end, case when u.dni='90000001' then '20:00'::time else '18:00'::time end
from users u where u.dni in ('90000001','90000002')
on conflict (user_id) do update set full_name=excluded.full_name, phone=excluded.phone, email=excluded.email;

insert into services (id, name, description, base_price, duration_minutes, category, category_id, image_url)
select seed.id, seed.name, seed.description, seed.price, seed.duration, c.name, c.id, seed.image
from (values
  ('basic', 'Manicure básica', 'Limpieza, limado, cutícula e hidratación.', 40::numeric, 45, 'Uñas', null),
  ('acrylic', 'Acrílicas naturales', 'Extensión acrílica con acabado natural.', 80::numeric, 100, 'Uñas', null),
  ('makeup', 'Maquillaje social', 'Maquillaje para eventos con preparación de piel.', 50::numeric, 60, 'Maquillaje', null),
  ('waves', 'Peinado con ondas', 'Ondas definidas o suaves para eventos.', 45::numeric, 50, 'Peinados', null)
) as seed(id,name,description,price,duration,category,image)
join categories c on c.name=seed.category
on conflict (id) do update set name=excluded.name, description=excluded.description, base_price=excluded.base_price, duration_minutes=excluded.duration_minutes, category=excluded.category, category_id=excluded.category_id;

insert into specialist_categories (specialist_id, category_id)
select s.id, c.id from specialists s join users u on u.id=s.user_id join categories c on (u.dni='90000001' and c.name='Uñas') or (u.dni='90000002' and c.name in ('Maquillaje','Peinados'))
on conflict do nothing;

insert into products (sku, name, description, category, price, stock) values
  ('POLISH-NUDE-01', 'Esmalte nude premium', 'Esmalte de larga duración para acabados naturales.', 'esmaltes', 28, 20),
  ('CUTICLE-OIL-01', 'Aceite de cutícula', 'Hidratación para cuidado posterior al servicio.', 'cuidado', 22, 15)
on conflict (sku) do update set stock=excluded.stock, price=excluded.price;

insert into payment_methods (code, name, provider, requires_reference) values
  ('cash', 'Efectivo', null, false),
  ('card', 'Tarjeta débito/crédito', 'POS', true),
  ('yape', 'Yape', 'BCP', true),
  ('plin', 'Plin', 'Interbank/BBVA/Scotiabank', true),
  ('transfer', 'Transferencia bancaria', 'Banco', true)
on conflict (code) do update set name=excluded.name, provider=excluded.provider, requires_reference=excluded.requires_reference;
