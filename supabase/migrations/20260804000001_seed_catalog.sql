-- Cube Store — seed catalog (ticket 01)
-- Idempotent: fixed ids + on conflict do nothing, safe to re-run.
-- Includes an out-of-stock Product (stock_quantity = 0, status active) and an
-- inactive Product (status inactive) so availability vs status behaviour is
-- visible in the storefront from day one.

insert into public.categories (id, name, slug) values
  ('10000000-0000-4000-8000-000000000001', 'Speed Cubes', 'speed-cubes'),
  ('10000000-0000-4000-8000-000000000002', 'Puzzles & Brain Teasers', 'puzzles'),
  ('10000000-0000-4000-8000-000000000003', 'Collectibles', 'collectibles'),
  ('10000000-0000-4000-8000-000000000004', 'Accessories', 'accessories')
on conflict (id) do nothing;

insert into public.products (
  id, category_id, name, description, price, stock_quantity, image_url, status
) values
  (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '3x3 Speed Cube',
    'The classic 3x3, factory-lubricated with a smooth corner-cutting mechanism. Great for beginners and speedcubers alike.',
    12.99, 50, 'https://picsum.photos/seed/cube-3x3/800/800', 'active'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '4x4 Master Cube',
    'Take on the 4x4 — center-piece parity, edge pairing, and a satisfying final solve. A step up for confident solvers.',
    19.99, 30, 'https://picsum.photos/seed/cube-4x4/800/800', 'active'
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    '2x2 Mini Cube',
    'A pocket-sized 2x2 that fits in any bag. Fewer pieces, same brain-bending fun — the perfect travel cube.',
    8.99, 0, 'https://picsum.photos/seed/cube-2x2/800/800', 'active'
  ),
  (
    '20000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000001',
    '5x5 Professor Cube',
    'The 5x5 brings 98 movable pieces and hours of puzzling depth. For solvers who want the full professor experience.',
    24.99, 20, 'https://picsum.photos/seed/cube-5x5/800/800', 'active'
  ),
  (
    '20000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000002',
    'Pyraminx',
    'A tetrahedral twisty puzzle with a surprisingly elegant solve. A friendly first step beyond the cube.',
    9.99, 40, 'https://picsum.photos/seed/pyraminx/800/800', 'active'
  ),
  (
    '20000000-0000-4000-8000-000000000006',
    '10000000-0000-4000-8000-000000000002',
    'Megaminx',
    'Twelve faces, fifty sides, one magnificent challenge. The dodecahedral Megaminx rewards patience and pattern sense.',
    21.99, 15, 'https://picsum.photos/seed/megaminx/800/800', 'active'
  ),
  (
    '20000000-0000-4000-8000-000000000007',
    '10000000-0000-4000-8000-000000000002',
    'Wooden Puzzle Box',
    'A beautifully crafted wooden box that only opens once you discover its hidden mechanism. Three layers of mystery.',
    34.99, 8, 'https://picsum.photos/seed/puzzle-box/800/800', 'active'
  ),
  (
    '20000000-0000-4000-8000-000000000008',
    '10000000-0000-4000-8000-000000000003',
    'Gold Collector''s Cube',
    'A limited-run 3x3 with a gold-plated finish, presented in a numbered display case. For the serious collector.',
    89.99, 5, 'https://picsum.photos/seed/gold-cube/800/800', 'active'
  ),
  (
    '20000000-0000-4000-8000-000000000009',
    '10000000-0000-4000-8000-000000000003',
    'Retro 80s Replica Cube',
    'A faithful recreation of the original 1980s cube, right down to the colour scheme and rough-turning corners.',
    49.99, 10, 'https://picsum.photos/seed/retro-cube/800/800', 'active'
  ),
  (
    '20000000-0000-4000-8000-000000000010',
    '10000000-0000-4000-8000-000000000004',
    'Cube Display Stand',
    'A minimal acrylic stand that shows off any cube at a perfect angle. Sizes fit all cubes from 2x2 to 5x5.',
    6.99, 100, 'https://picsum.photos/seed/cube-stand/800/800', 'active'
  ),
  (
    '20000000-0000-4000-8000-000000000011',
    '10000000-0000-4000-8000-000000000004',
    'Premium Cube Lubricant',
    'Silicone-based lube for fast, quiet turns. A few drops transform any sluggish cube. (Currently not for sale.)',
    4.99, 0, 'https://picsum.photos/seed/cube-lube/800/800', 'inactive'
  )
on conflict (id) do nothing;
