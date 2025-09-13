-- SwiftEats Orders: High-Performance Schema with Transaction Isolation (PostgreSQL)
-- Generated: 2025-09-13

-- Ensure UUID extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1) Orders: Core table with sharding strategy
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id),
  transaction_id VARCHAR(36) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'created',
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  subtotal_cents INTEGER NOT NULL,
  tax_cents INTEGER NOT NULL,
  delivery_fee_cents INTEGER NOT NULL,
  tip_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  delivery_address TEXT,
  delivery_instructions TEXT,
  estimated_delivery_minutes INTEGER,
  driver_id UUID,
  metadata JSONB,
  shard_key INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for high-performance queries
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON orders (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_transaction_id ON orders (transaction_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at);
CREATE INDEX IF NOT EXISTS idx_orders_shard_key ON orders (shard_key);

-- 2) Order Items: Line items for each order
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  quantity INTEGER NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  total_price_cents INTEGER NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  customizations JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);

-- 3) Order History: Append-only log for order status changes
CREATE TABLE IF NOT EXISTS order_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL,
  note TEXT,
  actor_id UUID,
  actor_type VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_history_order_id ON order_history (order_id);
CREATE INDEX IF NOT EXISTS idx_order_history_created_at ON order_history (created_at);

-- 4) Order Transactions: For idempotency and atomicity
CREATE TABLE IF NOT EXISTS order_transactions (
  id VARCHAR(36) PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  request_payload JSONB NOT NULL,
  response_payload JSONB,
  attempts INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_transactions_order_id ON order_transactions (order_id);

-- 5) Connection Pool Configuration
-- Add this to your PostgreSQL configuration:
-- max_connections = 200
-- shared_buffers = 1GB
-- work_mem = 16MB
-- maintenance_work_mem = 256MB
-- effective_cache_size = 3GB
-- max_worker_processes = 8
-- max_parallel_workers_per_gather = 4
-- max_parallel_workers = 8

-- 6) Sharding Function: Distribute orders across shards based on order ID
CREATE OR REPLACE FUNCTION get_shard_key(order_uuid UUID) RETURNS INTEGER AS $$
BEGIN
  -- Simple hash function to distribute orders across 16 shards (0-15)
  RETURN (('x' || substring(order_uuid::text, 1, 8))::bit(32)::int % 16);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 7) Transaction Isolation Helper Functions
-- Function to create an order with proper transaction isolation
CREATE OR REPLACE FUNCTION create_order_atomic(
  p_user_id UUID,
  p_restaurant_id UUID,
  p_transaction_id VARCHAR(36),
  p_subtotal_cents INTEGER,
  p_tax_cents INTEGER,
  p_delivery_fee_cents INTEGER,
  p_tip_cents INTEGER,
  p_total_cents INTEGER,
  p_currency CHAR(3),
  p_delivery_address TEXT,
  p_delivery_instructions TEXT,
  p_items JSONB
) RETURNS UUID AS $$
DECLARE
  v_order_id UUID;
  v_item JSONB;
  v_shard_key INTEGER;
BEGIN
  -- Generate new order ID
  SELECT uuid_generate_v4() INTO v_order_id;
  
  -- Calculate shard key
  SELECT get_shard_key(v_order_id) INTO v_shard_key;
  
  -- Insert order with SERIALIZABLE isolation
  INSERT INTO orders (
    id, user_id, restaurant_id, transaction_id, 
    subtotal_cents, tax_cents, delivery_fee_cents, tip_cents, total_cents,
    currency, delivery_address, delivery_instructions, shard_key
  ) VALUES (
    v_order_id, p_user_id, p_restaurant_id, p_transaction_id,
    p_subtotal_cents, p_tax_cents, p_delivery_fee_cents, p_tip_cents, p_total_cents,
    p_currency, p_delivery_address, p_delivery_instructions, v_shard_key
  );
  
  -- Insert order history entry
  INSERT INTO order_history (order_id, status, note)
  VALUES (v_order_id, 'created', 'Order created');
  
  -- Insert order items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO order_items (
      order_id, menu_item_id, name, description, 
      quantity, unit_price_cents, total_price_cents, currency, customizations
    ) VALUES (
      v_order_id,
      (v_item->>'menuItemId')::UUID,
      v_item->>'name',
      v_item->>'description',
      (v_item->>'quantity')::INTEGER,
      (v_item->>'unitPriceCents')::INTEGER,
      (v_item->>'totalPriceCents')::INTEGER,
      p_currency,
      (v_item->'customizations')
    );
  END LOOP;
  
  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql;

-- 8) Idempotency Check Function
CREATE OR REPLACE FUNCTION check_transaction_idempotency(
  p_transaction_id VARCHAR(36),
  p_request_payload JSONB
) RETURNS TABLE(exists BOOLEAN, order_id UUID) AS $$
DECLARE
  v_exists BOOLEAN;
  v_order_id UUID;
BEGIN
  SELECT EXISTS(SELECT 1 FROM order_transactions WHERE id = p_transaction_id) INTO v_exists;
  
  IF v_exists THEN
    SELECT order_id FROM order_transactions WHERE id = p_transaction_id INTO v_order_id;
  ELSE
    -- Record the transaction attempt
    INSERT INTO order_transactions (id, request_payload, status)
    VALUES (p_transaction_id, p_request_payload, 'pending');
  END IF;
  
  RETURN QUERY SELECT v_exists, v_order_id;
END;
$$ LANGUAGE plpgsql;

-- Usage example for atomic order creation with idempotency:
-- 1) BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
-- 2) SELECT * FROM check_transaction_idempotency($transaction_id, $request_payload);
-- 3) IF NOT exists THEN CALL create_order_atomic(...);
-- 4) UPDATE order_transactions SET status = 'completed', order_id = $new_order_id WHERE id = $transaction_id;
-- 5) COMMIT;
