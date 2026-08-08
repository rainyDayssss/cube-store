# Price snapshots on orders

`order_items.unit_price` and `orders.total_amount` are denormalized copies of the product price at purchase time, so later price changes never rewrite order history. Chosen over computing totals live from `products.price`, which would silently change what past orders display. Order and order_items rows are immutable after creation.
