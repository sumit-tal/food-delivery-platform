-- Driver tracking schema with PostGIS support

-- Enable PostGIS extension if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Drivers table
CREATE TABLE IF NOT EXISTS drivers (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  email VARCHAR(255) NOT NULL,
  vehicle_type VARCHAR(50) NOT NULL,
  vehicle_model VARCHAR(100) NOT NULL,
  license_plate VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'offline',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT drivers_user_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Driver locations table with geospatial indexing
CREATE TABLE IF NOT EXISTS driver_locations (
  id UUID PRIMARY KEY,
  driver_id UUID NOT NULL,
  location GEOGRAPHY(POINT, 4326) NOT NULL, -- WGS84 coordinate system
  heading FLOAT,
  speed FLOAT,
  accuracy FLOAT,
  battery_level FLOAT,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT driver_locations_driver_id_fk FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE
);

-- Create spatial index for fast geospatial queries
CREATE INDEX IF NOT EXISTS driver_locations_location_idx ON driver_locations USING GIST(location);

-- Create index on driver_id and timestamp for fast lookups of driver history
CREATE INDEX IF NOT EXISTS driver_locations_driver_id_timestamp_idx ON driver_locations(driver_id, timestamp);

-- Active deliveries table to track which drivers are currently on delivery
CREATE TABLE IF NOT EXISTS active_deliveries (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL,
  driver_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL,
  pickup_location GEOGRAPHY(POINT, 4326) NOT NULL,
  delivery_location GEOGRAPHY(POINT, 4326) NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  estimated_delivery_time TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT active_deliveries_driver_id_fk FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
  CONSTRAINT active_deliveries_order_id_fk FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Create index for looking up deliveries by order_id
CREATE INDEX IF NOT EXISTS active_deliveries_order_id_idx ON active_deliveries(order_id);

-- Create index for looking up deliveries by driver_id
CREATE INDEX IF NOT EXISTS active_deliveries_driver_id_idx ON active_deliveries(driver_id);

-- Function to update driver location and maintain history
CREATE OR REPLACE FUNCTION update_driver_location(
  p_driver_id UUID,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_heading FLOAT DEFAULT NULL,
  p_speed FLOAT DEFAULT NULL,
  p_accuracy FLOAT DEFAULT NULL,
  p_battery_level FLOAT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  location_id UUID;
BEGIN
  -- Generate a new UUID for the location record
  location_id := gen_random_uuid();
  
  -- Insert the new location
  INSERT INTO driver_locations (
    id, 
    driver_id, 
    location, 
    heading, 
    speed, 
    accuracy, 
    battery_level
  ) VALUES (
    location_id,
    p_driver_id,
    ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
    p_heading,
    p_speed,
    p_accuracy,
    p_battery_level
  );
  
  -- Update the driver's status to 'online' if they're sending location updates
  UPDATE drivers
  SET 
    status = 'online',
    updated_at = NOW()
  WHERE id = p_driver_id;
  
  RETURN location_id;
END;
$$ LANGUAGE plpgsql;

-- Function to find nearby drivers within a certain radius
CREATE OR REPLACE FUNCTION find_nearby_drivers(
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_radius_meters INTEGER DEFAULT 5000,
  p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
  driver_id UUID,
  distance_meters DOUBLE PRECISION,
  last_updated TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  WITH latest_locations AS (
    SELECT DISTINCT ON (driver_id)
      driver_id,
      location,
      timestamp
    FROM driver_locations
    WHERE timestamp > NOW() - INTERVAL '5 minutes'
    ORDER BY driver_id, timestamp DESC
  )
  SELECT 
    l.driver_id,
    ST_Distance(l.location, ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography) AS distance_meters,
    l.timestamp AS last_updated
  FROM latest_locations l
  JOIN drivers d ON d.id = l.driver_id
  WHERE 
    d.status = 'online' AND
    ST_DWithin(
      l.location,
      ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
      p_radius_meters
    )
  ORDER BY distance_meters ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
