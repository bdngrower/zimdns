-- Fix RLS policy for device visibility
-- Ensures super_admin and tecnico roles can see all devices of any client they are viewing.

CREATE OR REPLACE FUNCTION accessible_client_ids()
RETURNS SETOF UUID LANGUAGE sql STABLE AS $$
  -- 1. Super Admin and Tecnico see all clients
  SELECT id FROM clients WHERE (
    SELECT role FROM profiles WHERE id = auth.uid()
  ) IN ('super_admin', 'tecnico')
  UNION
  -- 2. Technical owner of the client
  SELECT id FROM clients WHERE technical_id = auth.uid()
  UNION
  -- 3. Users directly associated with the client
  SELECT client_id FROM client_users WHERE user_id = auth.uid()
$$;
