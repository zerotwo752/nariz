create table if not exists roles (
  code varchar(20) primary key,
  name text not null,
  description text not null,
  created_at timestamptz not null default now()
);

insert into roles (code, name, description) values
  ('SA', 'Super admin', 'Acceso total al sistema, configuración y auditoría.'),
  ('OWNER', 'Dueño', 'Administra el salón, servicios, especialistas, reservas y pagos.'),
  ('USER', 'Usuario', 'Cliente final: cotiza diseños, reserva citas y consulta pagos.')
on conflict (code) do update set name = excluded.name, description = excluded.description;

create table if not exists users (
  id bigserial primary key,
  dni varchar(12) unique not null,
  full_name text not null,
  birth_date date,
  phone varchar(20),
  email text unique,
  password_hash text not null,
  role_code varchar(20) not null references roles(code) default 'USER',
  loyalty_points integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists specialists (
  id bigserial primary key,
  full_name text not null,
  phone varchar(20),
  email text,
  bio text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists services (
  id varchar(40) primary key,
  name text not null,
  description text not null,
  base_price numeric(10,2) not null,
  duration_minutes integer not null,
  category text not null default 'nails',
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists products (
  id bigserial primary key,
  sku varchar(40) unique not null,
  name text not null,
  description text,
  category text not null,
  price numeric(10,2) not null default 0,
  stock integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists payment_methods (
  id bigserial primary key,
  code varchar(30) unique not null,
  name text not null,
  provider text,
  requires_reference boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists ai_quotes (
  id bigserial primary key,
  user_id bigint references users(id),
  hints text,
  difficulty text not null,
  estimated_minutes integer not null,
  price numeric(10,2) not null,
  materials jsonb not null default '[]'::jsonb,
  requires_review boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists bookings (
  id bigserial primary key,
  user_id bigint not null references users(id),
  service_id varchar(40) not null references services(id),
  specialist_id bigint references specialists(id),
  quote_id bigint references ai_quotes(id),
  starts_at timestamptz not null,
  ends_at timestamptz,
  duration_minutes integer not null,
  price numeric(10,2) not null,
  status text not null default 'confirmed' check (status in ('pending','confirmed','completed','cancelled','no_show')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists payments (
  id bigserial primary key,
  booking_id bigint references bookings(id),
  user_id bigint not null references users(id),
  payment_method_id bigint references payment_methods(id),
  amount numeric(10,2) not null,
  currency char(3) not null default 'PEN',
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded')),
  reference text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_users_role on users(role_code);
create index if not exists idx_bookings_user on bookings(user_id);
create index if not exists idx_bookings_starts_at on bookings(starts_at);
create index if not exists idx_payments_booking on payments(booking_id);
