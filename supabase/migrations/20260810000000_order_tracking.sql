-- Order tracking (ticket 14): a SECURITY DEFINER function that lets
-- anonymous customers look up their order status by order number + email.
-- The email verification prevents casual snooping of order data.

create or replace function public.track_order(p_order_number text, p_email text)
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'order_number', o.order_number,
    'status', o.status,
    'total_amount', o.total_amount,
    'payment_method', o.payment_method,
    'delivery_address', o.delivery_address,
    'created_at', o.created_at,
    'customer_name', c.full_name,
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'product_name', coalesce(p.name, 'Deleted product'),
        'image_url', p.image_url,
        'quantity', oi.quantity,
        'unit_price', oi.unit_price
      ) order by oi.created_at), '[]'::jsonb)
      from order_items oi
      left join products p on p.id = oi.product_id
      where oi.order_id = o.id
    )
  ) into result
  from orders o
  join customers c on c.id = o.customer_id
  where o.order_number = p_order_number
    and lower(c.email) = lower(p_email);

  return result;
end;
$$;

-- Allow anonymous (guest) customers to call this function.
grant execute on function public.track_order(text, text) to anon;
grant execute on function public.track_order(text, text) to authenticated;
