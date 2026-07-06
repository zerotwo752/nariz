insert into users (dni, full_name, birth_date, phone, email, password_hash, role_code, loyalty_points) values
  ('00000001', 'Súper Admin Nail Beauty', '1990-01-01', '+51900000001', 'sa@nailbeauty.test', '6d96c29a8d84eaa042032a4a23fa5b55:1222b0dba444529d5e481139efc5a49f3bdda11556bc642d6172d046cea692f75ffd3fa1f349a30ae1e31e620a6a9bc2b1c0fdda411a07cf2dc64d2a13c4d094', 'SA', 0),
  ('00000002', 'Dueña Nail Beauty', '1991-02-02', '+51900000002', 'duena@nailbeauty.test', '95696b174cf84c0a63cb11d9c1974d6d:d70bcef1f5992ef081ef407d62e3d341a35e2891049c1f7ecfbc415165ec58b5c690dea5c8d8dbf49596344ad2029add04e3d7f66afd9ecc63658e7f64ad9066', 'OWNER', 0),
  ('00000003', 'Andrea Cliente', '1995-05-31', '+51900000003', 'andrea@nailbeauty.test', '113f91ab98609ec4e95079bbee8aeb59:3e6a81906c744d5dda9e14c795b0b59daca6efe38025d6c35c2948edd4dc19d3454aa9f2930eb38cc452fa8b79ccacce0460e9f1a5f62fe544aedf965f2401c6', 'USER', 250)
on conflict (dni) do nothing;

insert into specialists (full_name, phone, email, bio)
select full_name, phone, email, bio
from (values
  ('Valeria Torres', '+51911111111', 'valeria@nailbeauty.test', 'Especialista en manicure gel y pedicure spa.'),
  ('Daniela Ruiz', '+51922222222', 'daniela@nailbeauty.test', 'Especialista en acrílicas y nail art.')
) as seed(full_name, phone, email, bio)
where not exists (select 1 from specialists where specialists.email = seed.email);

insert into services (id, name, description, base_price, duration_minutes, category, image_url) values
  ('basic', 'Manicure básica', 'Limpieza, limado, cutícula e hidratación.', 40, 45, 'manicure', null),
  ('spa', 'Manicure spa', 'Experiencia relajante con exfoliación y masaje.', 65, 70, 'manicure', null),
  ('gel', 'Gel permanente', 'Color de larga duración y brillo premium.', 60, 75, 'manicure', null),
  ('acrylic', 'Acrílicas', 'Extensión resistente con acabado personalizado.', 80, 110, 'uñas', null),
  ('softgel', 'Soft Gel', 'Extensiones ligeras, flexibles y modernas.', 60, 90, 'uñas', null),
  ('nailart', 'Nail Art', 'Decoración artística, relieves, piedras y efectos.', 30, 50, 'decoración', null)
on conflict (id) do update set name=excluded.name, description=excluded.description, base_price=excluded.base_price, duration_minutes=excluded.duration_minutes;

insert into products (sku, name, description, category, price, stock) values
  ('POLISH-NUDE-01', 'Esmalte nude premium', 'Esmalte de larga duración para acabados naturales.', 'esmaltes', 28, 20),
  ('CUTICLE-OIL-01', 'Aceite de cutícula', 'Hidratación para cuidado posterior al servicio.', 'cuidado', 22, 15),
  ('PRESS-ON-ART-01', 'Set press-on nail art', 'Uñas postizas decoradas listas para usar.', 'press-on', 55, 8)
on conflict (sku) do update set stock=excluded.stock, price=excluded.price;

insert into payment_methods (code, name, provider, requires_reference) values
  ('cash', 'Efectivo', null, false),
  ('card', 'Tarjeta débito/crédito', 'POS', true),
  ('yape', 'Yape', 'BCP', true),
  ('plin', 'Plin', 'Interbank/BBVA/Scotiabank', true),
  ('transfer', 'Transferencia bancaria', 'Banco', true)
on conflict (code) do update set name=excluded.name, provider=excluded.provider, requires_reference=excluded.requires_reference;
