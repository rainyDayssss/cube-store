# Immediate stock deduction with atomic re-validation

Stock is deducted inside the same transaction that creates the order (at `pending`), re-checking `stock_quantity` so a stale cart can't oversell. Cancelling an order restores stock. Chosen over reserving stock at cart-add time (complex lifecycle, no spec support) and over trusting client-side cart caps (oversell risk). Consequence: an order's stock effect is real the moment it's placed, even if it is later cancelled.
