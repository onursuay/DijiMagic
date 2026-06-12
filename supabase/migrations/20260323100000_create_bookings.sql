CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  booking_date text NOT NULL,
  booking_time text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (status);
COMMENT ON TABLE bookings IS 'Meeting booking requests from landing page';

-- RLS: yalnız service-role erişir (uygulama service key kullanır); anon deny-all.
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
