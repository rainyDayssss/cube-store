-- Allow bidirectional status transitions: forward AND backward in the
-- lifecycle, but no skipping. Cancel still allowed from any non-terminal state.
--
-- Lifecycle: pending <-> confirmed <-> preparing <-> shipped <-> completed
-- Terminal: completed, cancelled cannot change.
-- Cancel: allowed from any non-terminal state, restores stock.

CREATE OR REPLACE FUNCTION public.transition_order_status(
  p_order_id UUID,
  p_new_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_item RECORD;
  v_from_index INT;
  v_to_index INT;
  v_lifecycle TEXT[] := ARRAY['pending', 'confirmed', 'preparing', 'shipped', 'completed'];
BEGIN
  -- Admin-only
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Admins only.');
  END IF;

  -- Row-lock the Order
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'That order no longer exists.');
  END IF;

  IF p_new_status NOT IN ('pending', 'confirmed', 'preparing', 'shipped', 'completed', 'cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Unknown order status.');
  END IF;

  IF p_new_status = v_order.status::TEXT THEN
    RETURN jsonb_build_object('ok', false, 'message',
      format('Order is already %s.', v_order.status));
  END IF;

  -- Terminal states cannot change
  IF v_order.status IN ('completed', 'cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'message',
      format('%s orders cannot be changed.', initcap(v_order.status::TEXT)));
  END IF;

  -- Cancel is always allowed from non-terminal states
  IF p_new_status <> 'cancelled' THEN
    -- Find positions in lifecycle
    v_from_index := array_position(v_lifecycle, v_order.status::TEXT);
    v_to_index := array_position(v_lifecycle, p_new_status);

    -- Must be exactly one step forward OR one step backward (no skipping)
    IF v_to_index IS NULL OR ABS(v_to_index - v_from_index) <> 1 THEN
      RETURN jsonb_build_object('ok', false, 'message',
        format('Cannot move an order from %s directly to %s.',
          v_order.status, p_new_status));
    END IF;
  END IF;

  -- Cancel restores stock
  IF p_new_status = 'cancelled' THEN
    FOR v_item IN
      SELECT product_id, quantity
      FROM public.order_items
      WHERE order_id = v_order.id
        AND product_id IS NOT NULL
    LOOP
      UPDATE public.products
      SET stock_quantity = stock_quantity + v_item.quantity
      WHERE id = v_item.product_id;
    END LOOP;
  END IF;

  UPDATE public.orders
  SET status = p_new_status::public.order_status
  WHERE id = v_order.id;

  RETURN jsonb_build_object('ok', true, 'status', p_new_status);
END;
$$;

REVOKE ALL ON FUNCTION public.transition_order_status(UUID, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.transition_order_status(UUID, TEXT) TO authenticated;
