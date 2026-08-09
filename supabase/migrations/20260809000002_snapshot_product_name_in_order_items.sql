-- Snapshot product_id and product_name in order_items so order history is
-- preserved even after hard-deleting products.
--
-- Changes:
-- 1. Add product_name column to order_items
-- 2. Remove FK constraint on product_id (now a plain UUID snapshot)
-- 3. Update place_order to snapshot product_name
-- 4. Update order_details view to use snapshots instead of joining products

-- 1. Add product_name column
ALTER TABLE public.order_items
ADD COLUMN product_name VARCHAR(255) NOT NULL DEFAULT 'Unknown product';

-- 2. Remove FK constraint on product_id
ALTER TABLE public.order_items
DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;

-- Backfill existing rows with product names from the products table
UPDATE public.order_items oi
SET product_name = p.name
FROM public.products p
WHERE oi.product_id = p.id
  AND oi.product_name = 'Unknown product';

-- 3. Update place_order to snapshot product_name
CREATE OR REPLACE FUNCTION public.place_order(
  p_full_name TEXT,
  p_email TEXT,
  p_contact_number TEXT,
  p_delivery_address TEXT,
  p_payment_method TEXT,
  p_items JSONB,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
  v_order_id UUID;
  v_order_number TEXT;
  v_total NUMERIC(10, 2) := 0;
  v_day_counter INTEGER;
  v_attempt INTEGER;
  v_item RECORD;
  v_product public.products%ROWTYPE;
  v_issues JSONB := '[]'::JSONB;
BEGIN
  -- 1. Input validation
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'VALIDATION', 'message', 'Your cart is empty.');
  END IF;

  IF nullif(trim(p_full_name), '') IS NULL
     OR nullif(trim(p_email), '') IS NULL
     OR nullif(trim(p_contact_number), '') IS NULL
     OR nullif(trim(p_delivery_address), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'VALIDATION',
      'message', 'Name, email, contact number, and delivery address are required.');
  END IF;

  IF p_payment_method NOT IN ('cod', 'ewallet', 'bank_transfer') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'VALIDATION',
      'message', 'Choose a valid payment method.');
  END IF;

  IF p_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'VALIDATION',
      'message', 'Enter a valid email address.');
  END IF;

  IF jsonb_array_length(p_items) > 100 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'VALIDATION',
      'message', 'Too many items in the cart.');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity INT)
    GROUP BY product_id
    HAVING count(*) > 1
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'VALIDATION',
      'message', 'Your cart contains the same product more than once.');
  END IF;

  -- 2. Lock + re-validate every line BEFORE any write
  FOR v_item IN
    SELECT product_id, quantity
    FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity INT)
  LOOP
    IF v_item.product_id IS NULL OR v_item.quantity IS NULL OR v_item.quantity < 1 THEN
      RETURN jsonb_build_object('ok', false, 'code', 'VALIDATION',
        'message', 'Each cart line needs a product id and a quantity of at least 1.');
    END IF;

    SELECT * INTO v_product
    FROM public.products
    WHERE id = v_item.product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'code', 'PRODUCT_UNAVAILABLE',
        'message', 'A product in your cart is no longer available.',
        'items', jsonb_build_array(jsonb_build_object(
          'product_id', v_item.product_id,
          'name', 'Unavailable product',
          'requested', v_item.quantity
        )));
    END IF;

    IF v_product.status <> 'active' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'PRODUCT_UNAVAILABLE',
        'message', format('"%s" is no longer available.', v_product.name),
        'items', jsonb_build_array(jsonb_build_object(
          'product_id', v_product.id,
          'name', v_product.name,
          'requested', v_item.quantity
        )));
    END IF;

    IF v_product.stock_quantity < v_item.quantity THEN
      v_issues := v_issues || jsonb_build_object(
        'product_id', v_product.id,
        'name', v_product.name,
        'available', v_product.stock_quantity,
        'requested', v_item.quantity
      );
    END IF;

    v_total := v_total + v_product.price * v_item.quantity;
  END LOOP;

  IF jsonb_array_length(v_issues) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INSUFFICIENT_STOCK',
      'message', 'Some items do not have enough stock. Review the highlighted lines and try again.',
      'items', v_issues);
  END IF;

  -- 3. Customer upsert by email
  INSERT INTO public.customers (full_name, email, contact_number)
  VALUES (trim(p_full_name), lower(trim(p_email)), trim(p_contact_number))
  ON CONFLICT (email) DO UPDATE
    SET full_name = excluded.full_name,
        contact_number = excluded.contact_number
  RETURNING id INTO v_customer_id;

  -- 4. Order number: per-day counter
  FOR v_attempt IN 1..3 LOOP
    INSERT INTO public.order_number_counters (day, last_value)
    VALUES (current_date, 1)
    ON CONFLICT (day) DO UPDATE
      SET last_value = public.order_number_counters.last_value + 1
    RETURNING last_value INTO v_day_counter;

    v_order_number := 'ORD-' || to_char(current_date, 'YYYYMMDD')
      || '-' || lpad(v_day_counter::text, 4, '0');

    BEGIN
      INSERT INTO public.orders (
        order_number, customer_id, delivery_address, payment_method,
        status, total_amount, notes
      )
      VALUES (
        v_order_number, v_customer_id, trim(p_delivery_address),
        p_payment_method::public.payment_method, 'pending', v_total,
        nullif(trim(coalesce(p_notes, '')), '')
      )
      RETURNING id INTO v_order_id;

      EXIT;
    EXCEPTION
      WHEN unique_violation THEN
        v_order_number := NULL;
    END;
  END LOOP;

  IF v_order_number IS NULL THEN
    RAISE EXCEPTION 'Could not allocate a unique order number';
  END IF;

  -- 5. Order items with price AND name snapshots + stock deduction
  FOR v_item IN
    SELECT product_id, quantity
    FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity INT)
  LOOP
    SELECT * INTO v_product
    FROM public.products
    WHERE id = v_item.product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % vanished during checkout', v_item.product_id;
    END IF;

    INSERT INTO public.order_items (order_id, product_id, product_name, quantity, unit_price)
    VALUES (v_order_id, v_product.id, v_product.name, v_item.quantity, v_product.price);

    UPDATE public.products
    SET stock_quantity = stock_quantity - v_item.quantity
    WHERE id = v_product.id;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'total_amount', v_total
  );
END;
$$;

-- 4. Update order_details view to use snapshot instead of joining products
DROP VIEW IF EXISTS public.order_details;

CREATE VIEW public.order_details
WITH (security_invoker = true) AS
SELECT
  o.id,
  o.order_number,
  o.status,
  o.total_amount,
  o.notes,
  o.created_at,
  o.delivery_address,
  o.payment_method,
  c.full_name AS customer_name,
  c.email AS customer_email,
  c.contact_number AS customer_contact_number,
  coalesce(items.items, '[]'::jsonb) AS items
FROM public.orders o
LEFT JOIN public.customers c ON c.id = o.customer_id
LEFT JOIN (
  SELECT
    oi.order_id,
    jsonb_agg(
      jsonb_build_object(
        'id', oi.id,
        'product_id', oi.product_id,
        'product_name', oi.product_name,
        'image_url', p.image_url,
        'quantity', oi.quantity,
        'unit_price', oi.unit_price
      ) ORDER BY oi.created_at, oi.id
    ) AS items
  FROM public.order_items oi
  LEFT JOIN public.products p ON p.id = oi.product_id
  GROUP BY oi.order_id
) items ON items.order_id = o.id;

-- Re-apply grants
REVOKE ALL ON public.order_details FROM public;
GRANT SELECT ON public.order_details TO authenticated;

-- Re-apply grants for place_order
REVOKE ALL ON FUNCTION public.place_order(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.place_order(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT) TO anon, authenticated;
