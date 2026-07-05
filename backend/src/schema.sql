create table if not exists clients (
  id bigserial primary key,
  dni varchar(12) unique not null,
  full_name text not null,
  birth_date date not null,
  phone varchar(20) not null,
  email text,
  password_hash text not null,
  role text not null default 'client',
  loyalty_points integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists bookings (
  id bigserial primary key,
  client_id bigint not null references clients(id),
  service_id text not null,
  specialist_id bigint,
  starts_at timestamptz not null,
  duration_minutes integer not null,
  price numeric(10,2) not null,
  payment_method text not null,
  deposit_amount numeric(10,2) not null default 0,
  status text not null default 'confirmed',
  quote_snapshot jsonb,
  created_at timestamptz not null default now()
);
