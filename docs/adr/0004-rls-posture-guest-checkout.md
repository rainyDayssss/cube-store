# RLS posture: catalog public, guest writes, admin full

RLS is enabled: `categories` and `products` are SELECT-able by anon (public catalog); `customers`, `orders`, and `order_items` allow anon INSERT only (guest checkout) with no anon SELECT; Admins get full access via the `auth.jwt()` role claim. Chosen over RLS-off (open tables) and over requiring authentication to order. Consequence: anonymous users can create rows in order tables by design — the write path must be validated server-side (Server Actions), never trusted from the client.
