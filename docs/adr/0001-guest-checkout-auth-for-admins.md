# Guest checkout; Auth reserved for Admins

Customers place orders without an account — the checkout form writes the `customers` row and order data directly. Supabase Auth exists in this repo solely to gate the `/admin` dashboard (via the `role: admin` claim in `app_metadata`); there is no customer account area and no "My Orders" page. Chosen over authenticated or hybrid checkout because the spec's flows (checkout form, confirmation modal, order number) describe a guest journey, and it keeps the auth surface minimal.
