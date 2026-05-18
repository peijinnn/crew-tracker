-- Run this in your Supabase SQL editor to set up the database

-- Users table (admin + staff)
create table users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text unique,
  password_hash text not null,
  role text not null default 'staff', -- 'admin' or 'staff'
  hourly_rate numeric(8,2) default 0,
  home_area text,
  bank_details text,
  created_at timestamptz default now()
);

-- Events
create table events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  venue text not null,
  venue_lat numeric(10,7),
  venue_lng numeric(10,7),
  event_date date not null,
  start_time time,
  end_time time,
  created_by uuid references users(id),
  created_at timestamptz default now()
);

-- Event assignments (which staff is assigned to which event)
create table event_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  role text default 'Crew',
  unique(event_id, user_id)
);

-- Work sessions (check-in / check-out)
create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  event_id uuid references events(id),
  check_in timestamptz not null,
  check_in_lat numeric(10,7),
  check_in_lng numeric(10,7),
  check_in_address text,
  check_out timestamptz,
  check_out_lat numeric(10,7),
  check_out_lng numeric(10,7),
  hours numeric(5,2),
  role text default 'Crew',
  created_at timestamptz default now()
);

-- Claims (meal, transport, parking, other)
create table claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  event_id uuid references events(id),
  session_id uuid references sessions(id),
  type text not null, -- 'meal', 'transport', 'parking', 'other'
  description text,
  amount numeric(8,2) not null,
  distance_km numeric(6,2), -- for transport
  from_location text,
  to_location text,
  status text default 'pending', -- 'pending', 'approved', 'paid', 'rejected'
  receipt_note text,
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table users enable row level security;
alter table events enable row level security;
alter table sessions enable row level security;
alter table claims enable row level security;
alter table event_assignments enable row level security;

-- Policies: service_role (used by API) bypasses RLS automatically
-- For anon/authenticated access we keep things locked; all access is via API routes with JWT

-- Insert a default admin user (password: admin123 — CHANGE THIS after setup)
-- bcrypt hash of "admin123"
insert into users (name, email, password_hash, role) values
  ('Admin', 'admin@yourcompany.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');
