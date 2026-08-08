-- Add payment_method to order_summaries view so the orders list table can
-- display it without a separate join.
--
-- DROP + CREATE because CREATE OR REPLACE cannot reorder columns (the new
-- payment_method column must sit before created_at).
DROP VIEW IF EXISTS public.order_summaries;

CREATE VIEW public.order_summaries
WITH (security_invoker = true) AS
SELECT
  o.id,
  o.order_number,
  o.status,
  o.total_amount,
  o.payment_method,
  o.created_at,
  o.customer_id,
  c.full_name AS customer_name,
  c.email AS customer_email,
  coalesce(oi.items_count, 0) AS items_count
FROM public.orders o
LEFT JOIN public.customers c ON c.id = o.customer_id
LEFT JOIN (
  SELECT order_id, sum(quantity)::int AS items_count
  FROM public.order_items
  GROUP BY order_id
) oi ON oi.order_id = o.id;

-- Re-apply grants (dropping the view revoked them).
GRANT SELECT ON public.order_summaries TO authenticated;
