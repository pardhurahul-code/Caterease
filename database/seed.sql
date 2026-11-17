-- CaterEase Realistic Demo Seed Data
-- Demo credentials (passwords before bcrypt hashing):
--   Customer: customer@caterease.com / Customer@123
--   Admin:    admin@caterease.com    / Admin@123
--   Staff:    staff@caterease.com    / Staff@123

INSERT INTO users (uid, email, name, phone, password_hash, role, email_verified) VALUES
  ('local_admin_1', 'admin@caterease.com', 'Aarav Mehta', '+91 98201 11001', '$2b$10$uyvrLHUlPozwvwMOhTxk4eGmiCeOExBvU25uRGSumwA22kCmQTPDy', 'ADMIN', TRUE),
  ('local_staff_1', 'staff@caterease.com', 'Chef Vikram Rao', '+91 98201 22002', '$2b$10$6uQOpXqGDkQ13p8zPheJgOElUnZK4aU1XSLUtQ6S9wB40ZpKDIU.e', 'STAFF', TRUE),
  ('local_staff_2', 'priya.staff@caterease.com', 'Priya Deshmukh', '+91 98201 22003', '$2b$10$6uQOpXqGDkQ13p8zPheJgOElUnZK4aU1XSLUtQ6S9wB40ZpKDIU.e', 'STAFF', TRUE),
  ('local_customer_1', 'customer@caterease.com', 'Ananya Sharma', '+91 98201 33001', '$2b$10$7Gk8TlHUrovjKBNYnn4bt.uzAwlEZFAKtgB352yiLTse/lzS39iCa', 'CUSTOMER', TRUE),
  ('local_customer_2', 'rohan.kapoor@example.com', 'Rohan Kapoor', '+91 98201 33002', '$2b$10$7Gk8TlHUrovjKBNYnn4bt.uzAwlEZFAKtgB352yiLTse/lzS39iCa', 'CUSTOMER', TRUE)
ON CONFLICT (email) DO NOTHING;

INSERT INTO admins (user_id, department, permissions_level)
SELECT id, 'Executive Operations', 'FULL' FROM users WHERE email = 'admin@caterease.com'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO staff (user_id, staff_code, role_title, specialization, phone, availability_status, shift_schedule)
SELECT id, 'STF-101', 'Executive Head Chef', 'Royal Banquets & Live Counters', '+91 98201 22002', 'Available', '07:00 - 19:00'
FROM users WHERE email = 'staff@caterease.com'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO staff (user_id, staff_code, role_title, specialization, phone, availability_status, shift_schedule)
SELECT id, 'STF-102', 'Events & Logistics Lead', 'Buffet Setup & Guest Hospitality', '+91 98201 22003', 'Available', '09:00 - 21:00'
FROM users WHERE email = 'priya.staff@caterease.com'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO customers (user_id, address, city, state, postal_code, loyalty_points, dietary_notes)
SELECT id, '42 Pali Hill Residency', 'Mumbai', 'Maharashtra', '400050', 480, 'Prefers low-oil vegetarian options and Jain starters'
FROM users WHERE email = 'customer@caterease.com'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO customers (user_id, address, city, state, postal_code, loyalty_points, dietary_notes)
SELECT id, '18 Indiranagar 100ft Rd', 'Bengaluru', 'Karnataka', '560038', 220, 'Mixed veg and non-veg corporate menus'
FROM users WHERE email = 'rohan.kapoor@example.com'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO customer_preferences (customer_id, preferred_cuisine, dietary_restrictions, spice_level, favorite_categories, budget_tier)
SELECT id, 'Royal North Indian & Artisanal Fusion', 'Jain-friendly options for elders', 'Medium', '["Lunch","Dinner","Desserts"]'::jsonb, 'Luxury'
FROM customers WHERE user_id = (SELECT id FROM users WHERE email = 'customer@caterease.com')
ON CONFLICT (customer_id) DO NOTHING;

INSERT INTO catering_services (name, slug, description, service_type, base_price, min_guests, max_guests, image_url) VALUES
  ('Royal Full-Service Banquet', 'royal-full-service', 'Complete culinary team, brushed brass chafing stations, uniformed servers, and crockery.', 'Full-Service', 5000.00, 50, 1500, '/src/assets/images/hero_catering_banquet_1794926254985.jpg'),
  ('Executive Corporate Buffet', 'executive-buffet', 'Punctual office setup with zero-mess chafing trays, biodegradable or ceramic serviceware.', 'Buffet', 2500.00, 20, 500, '/src/assets/images/dish_artisan_appetizers_1794926255909.jpg'),
  ('Artisanal Live Culinary Counters', 'live-counters', 'Interactive tandoor, chaat, pasta, and artisanal dessert stations crafted live on site.', 'Live Counters', 7500.00, 60, 1200, '/src/assets/images/dish_royal_biryani_1794926255654.jpg')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO food_categories (name, slug, description, display_order, image_url) VALUES
  ('Breakfast', 'breakfast', 'Artisanal morning spreads, South Indian tiffin, and fresh bakery classics.', 1, '/src/assets/images/dish_artisan_appetizers_1794926255909.jpg'),
  ('Lunch', 'lunch', 'Balanced midday corporate thalis, biryanis, and seasonal curries.', 2, '/src/assets/images/dish_royal_biryani_1794926255654.jpg'),
  ('Dinner', 'dinner', 'Grand evening banquet mains, slow-cooked gravies, and tandoori breads.', 3, '/src/assets/images/hero_catering_banquet_1794926254985.jpg'),
  ('Snacks', 'snacks', 'Cocktail-ready skewers, tartlets, chaat bites, and crispy savories.', 4, '/src/assets/images/dish_artisan_appetizers_1794926255909.jpg'),
  ('Desserts', 'desserts', 'Saffron milk sweets, dark chocolate tarts, and plated fusion verrines.', 5, '/src/assets/images/dish_gourmet_desserts_1794926256998.jpg'),
  ('Beverages', 'beverages', 'Botanical coolers, cold-pressed juices, masala chai, and artisanal coffee.', 6, '/src/assets/images/dish_gourmet_desserts_1794926256998.jpg')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO food_items (category_id, name, slug, description, price, unit, dietary_type, is_gluten_free, is_available, ingredients, allergens, prep_time_mins, calories, image_url, is_featured) VALUES
  ((SELECT id FROM food_categories WHERE slug='breakfast'), 'Saffron Poha & Millet Upma Platter', 'saffron-poha-millet-upma', 'Fluffy flattened rice and roasted foxtail millet tempered with curry leaves, cashews, and pomegranate.', 220.00, 'per plate', 'Vegan', TRUE, TRUE, 'Poha, Foxtail millet, Mustard seeds, Cashews, Curry leaves, Pomegranate', 'Tree Nuts', 30, 290, '/src/assets/images/dish_artisan_appetizers_1794926255909.jpg', FALSE),
  ((SELECT id FROM food_categories WHERE slug='breakfast'), 'Artisan Idli Vada & Filter Coffee Bar', 'artisan-idli-vada', 'Steamed jasmine-soft mini idlis, crisp medu vada, trio of chutneys, and brass-brewed filter coffee.', 260.00, 'per plate', 'Jain', TRUE, TRUE, 'Rice batter, Urad dal, Coconut, Roasted chana, Coffee chicory', 'None', 35, 310, '/src/assets/images/dish_artisan_appetizers_1794926255909.jpg', TRUE),
  ((SELECT id FROM food_categories WHERE slug='lunch'), 'Awadhi Saffron Veg Dum Biryani', 'awadhi-veg-dum-biryani', 'Aged basmati slow-cooked under pastry seal with saffron milk, roasted jackfruit, caramelized onions, and burhani raita.', 380.00, 'per plate', 'Veg', TRUE, TRUE, 'Aged Basmati, Saffron, Whole Garam Masala, Mint, Yogurt, Cashews', 'Dairy, Tree Nuts', 55, 480, '/src/assets/images/dish_royal_biryani_1794926255654.jpg', TRUE),
  ((SELECT id FROM food_categories WHERE slug='lunch'), 'Hyderabadi Royal Chicken Dum Biryani', 'hyderabadi-chicken-biryani', 'Succulent marinated chicken layered with saffron basmati, fried shallots, mint, and roasted mirchi ka salan.', 460.00, 'per plate', 'Non-Veg', TRUE, TRUE, 'Chicken, Aged Basmati, Saffron, Ghee, Mint, Peanut Sesame Salan', 'Dairy, Peanuts, Sesame', 60, 560, '/src/assets/images/dish_royal_biryani_1794926255654.jpg', TRUE),
  ((SELECT id FROM food_categories WHERE slug='dinner'), 'Smoked Dal Bukhara & Truffle Naan', 'smoked-dal-bukhara', '24-hour slow-simmered black lentils finished with organic butter, tomato puree, and blistered garlic naan.', 340.00, 'per plate', 'Veg', FALSE, TRUE, 'Black Urad Lentils, Tomato, Cultured Butter, Cream, Refined Flour', 'Dairy, Gluten', 75, 440, '/src/assets/images/hero_catering_banquet_1794926254985.jpg', TRUE),
  ((SELECT id FROM food_categories WHERE slug='dinner'), 'Jain Paneer Lababdar & Jeera Pulao', 'jain-paneer-lababdar', 'No-onion, no-garlic rich cashew-tomato gravy with malai paneer cubes and fragrant cumin rice.', 360.00, 'per plate', 'Jain', TRUE, TRUE, 'Malai Paneer, Tomato, Cashew paste, Cardamom, Basmati Rice', 'Dairy, Tree Nuts', 40, 430, '/src/assets/images/hero_catering_banquet_1794926254985.jpg', FALSE),
  ((SELECT id FROM food_categories WHERE slug='dinner'), 'Malabar Pepper Roast Lamb', 'malabar-pepper-lamb', 'Tender boneless lamb seared with crushed Tellicherry black pepper, shallots, curry leaves, and flaky parotta.', 540.00, 'per plate', 'Non-Veg', FALSE, TRUE, 'Boneless Lamb, Tellicherry Pepper, Coconut oil, Shallots, Curry leaves', 'Gluten', 65, 590, '/src/assets/images/hero_catering_banquet_1794926254985.jpg', FALSE),
  ((SELECT id FROM food_categories WHERE slug='snacks'), 'Charred Paneer Tikka & Herb Tartlets', 'charred-paneer-tikka-platter', 'Tandoor-charred cottage cheese skewers paired with wild mushroom phyllo tartlets and emerald mint chutney.', 290.00, 'per plate', 'Veg', FALSE, TRUE, 'Paneer, Bell peppers, Mint, Coriander, Phyllo pastry, Wild mushrooms', 'Dairy, Gluten', 35, 310, '/src/assets/images/dish_artisan_appetizers_1794926255909.jpg', TRUE),
  ((SELECT id FROM food_categories WHERE slug='snacks'), 'Crispy Lotus Stem & Avocado Canapes', 'crispy-lotus-avocado-canapes', 'Sweet-spicy glazed lotus stem crisps and whipped avocado tartlets topped with microgreens.', 310.00, 'per plate', 'Vegan', TRUE, TRUE, 'Lotus stem, Avocado, Chili glaze, Sesame, Microgreens', 'Sesame', 25, 240, '/src/assets/images/dish_artisan_appetizers_1794926255909.jpg', FALSE),
  ((SELECT id FROM food_categories WHERE slug='desserts'), 'Saffron Pistachio Rasmalai & Choco Tarts', 'saffron-rasmalai-choco-tarts', 'Chilled saffron-cardamom milk dumplings served alongside 70% dark chocolate ganache tartlets and mango verrines.', 240.00, 'per plate', 'Veg', FALSE, TRUE, 'Milk solids, Kashmiri Saffron, Pistachios, 70% Dark Chocolate, Alphonso Mango', 'Dairy, Tree Nuts, Gluten', 45, 340, '/src/assets/images/dish_gourmet_desserts_1794926256998.jpg', TRUE),
  ((SELECT id FROM food_categories WHERE slug='desserts'), 'Vegan Coconut Mango Panna Cotta', 'vegan-coconut-mango-panna-cotta', 'Silky coconut cream verrine layered with fresh Alphonso mango coulis and toasted pistachio crumble.', 220.00, 'per plate', 'Vegan', TRUE, TRUE, 'Coconut milk, Alphonso Mango, Agar-agar, Pistachio, Mint', 'Tree Nuts', 30, 220, '/src/assets/images/dish_gourmet_desserts_1794926256998.jpg', FALSE),
  ((SELECT id FROM food_categories WHERE slug='beverages'), 'Rose & Vetiver Botanical Cooler Bar', 'rose-vetiver-cooler-bar', 'Chilled organic rose petal sharbat, kokum fizz, and mint-cucumber elixirs served in crystal dispensers.', 150.00, 'per glass', 'Vegan', TRUE, TRUE, 'Damask Rosewater, Kokum, Vetiver root, Mint, Sparkling water', 'None', 15, 95, '/src/assets/images/dish_gourmet_desserts_1794926256998.jpg', FALSE)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO catering_packages (service_id, name, slug, event_type, description, price_per_person, min_guests, max_guests, included_items_json, customization_options_json, image_url, is_available, is_featured) VALUES
  ((SELECT id FROM catering_services WHERE slug='royal-full-service'), 'Royal Heritage Wedding Feast', 'royal-heritage-wedding', 'Wedding', 'Five-course celebratory banquet with live chaat & tandoor stations, Awadhi biryani, dual mains, and artisanal dessert showcase.', 1450.00, 100, 1500, '["4 Welcome Appetizers","2 Live Culinary Counters","Awadhi Dum Biryani","3 Signature Mains & Breads","3 Artisanal Desserts","Botanical Beverage Bar"]'::jsonb, '["100% Jain Counter","Vegan & Gluten-Free Table","Late-Night Chai Station"]'::jsonb, '/src/assets/images/hero_catering_banquet_1794926254985.jpg', TRUE, TRUE),
  ((SELECT id FROM catering_services WHERE slug='executive-buffet'), 'Executive Summit & Corporate Gala', 'executive-corporate-gala', 'Corporate', 'Streamlined buffet designed for conferences, board retreats, and product launches with punctual zero-clutter service.', 850.00, 30, 600, '["2 Gourmet Starters","Herb Biryani or Pulao","2 Main Courses & Breads","Fresh Garden Salad Bar","2 Plated Desserts","Artisanal Coffee & Tea"]'::jsonb, '["Individual Bento Boxes","All-Vegan Executive Option","Branded Menu Cards"]'::jsonb, '/src/assets/images/dish_artisan_appetizers_1794926255909.jpg', TRUE, TRUE),
  ((SELECT id FROM catering_services WHERE slug='royal-full-service'), 'Signature Birthday Soiree', 'signature-birthday-soiree', 'Birthday', 'Crowd-pleasing starters, sliders, dum biryani, and interactive dessert verrines tailored for milestone celebrations.', 720.00, 25, 300, '["3 Cocktail Starters","1 Pasta or Noodle Bar","Signature Dum Biryani","2 Crowd-Favorite Mains","2 Desserts & Mocktails"]'::jsonb, '["Kids Friendly Corner","Custom Theme Cake Pairing","Live Waffle Counter"]'::jsonb, '/src/assets/images/dish_gourmet_desserts_1794926256998.jpg', TRUE, TRUE),
  ((SELECT id FROM catering_services WHERE slug='live-counters'), 'Enchanted Engagement Reception', 'enchanted-engagement', 'Engagement', 'Refined evening reception menu with passed hors d oeuvres, saffron mains, and fine porcelain dessert displays.', 1180.00, 60, 800, '["Passed Hors d Oeuvres","Live Tandoor Grill","2 Signature Mains","Saffron Biryani","Artisanal Dessert Trio","Welcome Mocktails"]'::jsonb, '["Passed Champagne-style Zero-Proof Elixirs","Separate Jain Kitchen Prep"]'::jsonb, '/src/assets/images/hero_catering_banquet_1794926254985.jpg', TRUE, FALSE),
  ((SELECT id FROM catering_services WHERE slug='royal-full-service'), 'Griha Pravesh Housewarming Feast', 'housewarming-feast', 'Housewarming', 'Traditional sattvic and Jain-compliant festive lunch served with brassware warmth and comforting sweets.', 680.00, 25, 250, '["2 Traditional Starters","Festive Dal & Paneer","Saffron Pulao & Pooris","Saffron Rasmalai","Masala Buttermilk"]'::jsonb, '["No-Onion No-Garlic Sattvic Prep","Banana Leaf Service"]'::jsonb, '/src/assets/images/dish_royal_biryani_1794926255654.jpg', TRUE, FALSE),
  ((SELECT id FROM catering_services WHERE slug='live-counters'), 'Grand Festive Celebration Spread', 'festive-celebration-spread', 'Festival', 'Vibrant Diwali, Eid, or Navratri banquet featuring regional delicacies, mithai platters, and spiced beverages.', 920.00, 40, 1000, '["3 Festive Starters","Live Chaat Station","2 Regional Mains","Royal Dum Biryani","Mithai & Rasmalai Counter"]'::jsonb, '["Fasting (Vrat) Menu Addition","Gift Mithai Boxes"]'::jsonb, '/src/assets/images/dish_gourmet_desserts_1794926256998.jpg', TRUE, FALSE),
  ((SELECT id FROM catering_services WHERE slug='royal-full-service'), 'Intimate Family Gathering Menu', 'family-gathering-menu', 'Family Function', 'Warm homestyle luxury dishes for anniversaries, baby showers, and family reunions.', 640.00, 20, 150, '["2 Starters","2 Homestyle Mains","Dal & Assorted Breads","Jeera Rice","Gulab Jamun & Ice Cream"]'::jsonb, '["Senior-Friendly Mild Spice","Packed Leftover Containers"]'::jsonb, '/src/assets/images/dish_royal_biryani_1794926255654.jpg', TRUE, FALSE),
  ((SELECT id FROM catering_services WHERE slug='live-counters'), 'Bespoke Custom Event Curation', 'bespoke-custom-event', 'Custom', 'Flexible culinary blueprint customizable dish-by-dish with AI quantity planning and chef consultation.', 990.00, 25, 1200, '["Custom Starter Selection","Choice of 3 Mains","Choice of Rice & Breads","2 Custom Desserts","Full Service Hospitality"]'::jsonb, '["Dietary Split Customization","Multi-Day Event Discount"]'::jsonb, '/src/assets/images/hero_catering_banquet_1794926254985.jpg', TRUE, FALSE)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO coupons (code, description, discount_type, discount_value, min_order_value, max_discount, start_date, expiry_date, usage_limit, per_customer_limit, used_count, is_active) VALUES
  ('CELEBRATE15', '15% off celebrations above ₹10,000 (up to ₹5,000 discount)', 'PERCENTAGE', 15.00, 10000.00, 5000.00, '2026-01-01 00:00:00', '2027-12-31 23:59:59', 200, 2, 12, TRUE),
  ('WELCOME500', 'Flat ₹500 off your first catering booking above ₹4,000', 'FIXED', 500.00, 4000.00, 500.00, '2026-01-01 00:00:00', '2027-12-31 23:59:59', 500, 1, 24, TRUE),
  ('CORPORATE10', '10% corporate event savings up to ₹8,000', 'PERCENTAGE', 10.00, 15000.00, 8000.00, '2026-01-01 00:00:00', '2027-12-31 23:59:59', 150, 5, 7, TRUE),
  ('FESTIVE20', '20% festive special up to ₹4,000', 'PERCENTAGE', 20.00, 12000.00, 4000.00, '2026-01-01 00:00:00', '2027-12-31 23:59:59', 100, 1, 5, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO suppliers (name, contact_person, email, phone, address, category, rating) VALUES
  ('Deccan Heritage Grains & Spices', 'Suresh Kulkarni', 'orders@deccangrains.in', '+91 98111 40001', 'APMC Market, Navi Mumbai', 'Grains & Spices', 4.85),
  ('Sahyadri Fresh Farms & Dairy', 'Meera Nair', 'supply@sahyadrifarms.in', '+91 98111 40002', 'Pune-Mumbai Highway Agro Hub', 'Dairy & Produce', 4.70),
  ('Royal Saffron & Dry Fruits Co.', 'Imran Qureshi', 'sales@royalsaffron.in', '+91 98111 40003', 'Crawford Market, Mumbai', 'Dry Fruits & Saffron', 4.90),
  ('EcoServe Hospitality Packaging', 'Karan Malhotra', 'b2b@ecoserve.in', '+91 98111 40004', 'Bhiwandi Logistics Park', 'Packaging & Supplies', 4.60)
ON CONFLICT DO NOTHING;

INSERT INTO inventory (ingredient_name, category, quantity, unit, min_stock_level, supplier_id, purchase_price, expiry_date) VALUES
  ('Aged Basmati Rice (Extra Long)', 'Grains', 185.00, 'kg', 50.00, 1, 145.00, '2027-06-30'),
  ('Kashmiri Mongra Saffron', 'Spices', 1.20, 'kg', 1.50, 3, 28000.00, '2027-03-15'),
  ('Fresh Malai Paneer', 'Dairy', 14.00, 'kg', 20.00, 2, 390.00, '2026-11-21'),
  ('Whole Cashews (W240)', 'Dry Fruits', 34.00, 'kg', 12.00, 3, 880.00, '2027-04-10'),
  ('Cultured Pure Desi Ghee', 'Dairy', 48.00, 'liters', 15.00, 2, 680.00, '2027-02-28'),
  ('Black Urad Lentils', 'Grains', 90.00, 'kg', 25.00, 1, 130.00, '2027-08-15'),
  ('Alphonso Mango Pulp (Aseptic)', 'Fruits', 28.00, 'kg', 15.00, 2, 320.00, '2026-12-30'),
  ('Tellicherry Black Peppercorns', 'Spices', 16.00, 'kg', 8.00, 1, 720.00, '2027-09-01'),
  ('70% Belgian Dark Chocolate', 'Bakery & Desserts', 9.00, 'kg', 10.00, 3, 1150.00, '2027-01-20'),
  ('Biodegradable Bagasse Plates', 'Packaging', 2400.00, 'pcs', 800.00, 4, 4.50, '2029-01-01')
ON CONFLICT DO NOTHING;

-- Sample Bookings across multiple months for realistic dashboards & Recharts analytics
INSERT INTO bookings (
  booking_code, customer_id, package_id, event_name, event_type, event_date, event_time,
  event_location, guest_count, dietary_requirements, special_instructions,
  contact_name, contact_phone, contact_email, budget, delivery_requirements,
  status, subtotal, tax_amount, delivery_charge, discount_amount, total_amount, paid_amount, payment_status, coupon_code, qr_token, created_at
) VALUES
  (
    'CE-2026-1001',
    (SELECT id FROM customers WHERE user_id = (SELECT id FROM users WHERE email='customer@caterease.com')),
    (SELECT id FROM catering_packages WHERE slug='royal-heritage-wedding'),
    'Sharma-Verma Sangeet Gala', 'Wedding', '2026-08-18', '19:30',
    'Taj Lands End Ballroom, Bandra West, Mumbai', 220, 'Separate Jain counter required for 40 elders', 'Gold chafing dishes with live chaat setup at 7 PM sharp.',
    'Ananya Sharma', '+91 98201 33001', 'customer@caterease.com', 340000.00, 'Full Service Setup',
    'Completed', 319000.00, 15700.00, 0.00, 5000.00, 329700.00, 329700.00, 'Paid', 'CELEBRATE15', 'qr-ce-1001-verified-token', '2026-08-01 10:00:00'
  ),
  (
    'CE-2026-1002',
    (SELECT id FROM customers WHERE user_id = (SELECT id FROM users WHERE email='rohan.kapoor@example.com')),
    (SELECT id FROM catering_packages WHERE slug='executive-corporate-gala'),
    'FinTech Leadership Offsite', 'Corporate', '2026-09-24', '12:30',
    'WeWork Galaxy Atrium, Residency Road, Bengaluru', 120, '25 Vegan bowls, nut-free dessert labels', 'Set up buffet line 45 mins prior to keynote.',
    'Rohan Kapoor', '+91 98201 33002', 'rohan.kapoor@example.com', 120000.00, 'Full Service Setup',
    'Completed', 102000.00, 4700.00, 0.00, 8000.00, 98700.00, 98700.00, 'Paid', 'CORPORATE10', 'qr-ce-1002-verified-token', '2026-09-10 11:30:00'
  ),
  (
    'CE-2026-1003',
    (SELECT id FROM customers WHERE user_id = (SELECT id FROM users WHERE email='customer@caterease.com')),
    (SELECT id FROM catering_packages WHERE slug='signature-birthday-soiree'),
    'Aarush 1st Birthday Brunch', 'Birthday', '2026-10-14', '11:30',
    'Blue Sea Lawns, Worli, Mumbai', 85, 'Mild spice for children, eggless desserts', 'Provide 15 high-chair friendly snack platters.',
    'Ananya Sharma', '+91 98201 33001', 'customer@caterease.com', 70000.00, 'Full Service Setup',
    'Completed', 61200.00, 3035.00, 0.00, 500.00, 63735.00, 63735.00, 'Paid', 'WELCOME500', 'qr-ce-1003-verified-token', '2026-10-02 09:15:00'
  ),
  (
    'CE-2026-1004',
    (SELECT id FROM customers WHERE user_id = (SELECT id FROM users WHERE email='customer@caterease.com')),
    (SELECT id FROM catering_packages WHERE slug='enchanted-engagement'),
    'Meera & Dev Engagement Dinner', 'Engagement', '2026-11-22', '19:00',
    'Four Seasons Terrace, Worli, Mumbai', 150, '40% Vegetarian, 60% Non-Veg, Gluten-Free labels', 'Coordinate lighting with floral planner at 5 PM.',
    'Ananya Sharma', '+91 98201 33001', 'customer@caterease.com', 190000.00, 'Full Service Setup',
    'Confirmed', 177000.00, 8600.00, 0.00, 5000.00, 180600.00, 54180.00, 'Partial', 'CELEBRATE15', 'qr-ce-1004-verified-token', '2026-11-05 14:20:00'
  ),
  (
    'CE-2026-1005',
    (SELECT id FROM customers WHERE user_id = (SELECT id FROM users WHERE email='rohan.kapoor@example.com')),
    (SELECT id FROM catering_packages WHERE slug='festive-celebration-spread'),
    'Annual Product Launch & Mixer', 'Festival', '2026-11-20', '18:00',
    'ITC Gardenia Courtyard, Bengaluru', 180, 'Jain & Vegan grazing station needed', 'Chilled botanical coolers on welcome tray.',
    'Rohan Kapoor', '+91 98201 33002', 'rohan.kapoor@example.com', 185000.00, 'Full Service Setup',
    'Preparing', 165600.00, 8080.00, 0.00, 4000.00, 169680.00, 85000.00, 'Partial', 'FESTIVE20', 'qr-ce-1005-verified-token', '2026-11-08 16:45:00'
  ),
  (
    'CE-2026-1006',
    (SELECT id FROM customers WHERE user_id = (SELECT id FROM users WHERE email='customer@caterease.com')),
    (SELECT id FROM catering_packages WHERE slug='housewarming-feast'),
    'Bandra Penthouse Griha Pravesh', 'Housewarming', '2026-12-06', '12:00',
    'Skyline Crest 14B, Bandra West, Mumbai', 60, 'Pure Vegetarian Sattvic (No Onion, No Garlic)', 'Brassware serving bowls preferred for lunch.',
    'Ananya Sharma', '+91 98201 33001', 'customer@caterease.com', 48000.00, 'Full Service Setup',
    'Pending', 40800.00, 2040.00, 0.00, 0.00, 42840.00, 0.00, 'Unpaid', NULL, 'qr-ce-1006-verified-token', '2026-11-15 10:10:00'
  )
ON CONFLICT (booking_code) DO NOTHING;

INSERT INTO booking_timeline (booking_id, status, note, updated_by_role)
SELECT id, status, 'Event milestone logged in CaterEase system.', 'ADMIN'
FROM bookings
WHERE id NOT IN (SELECT DISTINCT booking_id FROM booking_timeline);

INSERT INTO events (booking_id, title, event_date, start_time, end_time, venue, guest_count, status, lead_staff_id, notes)
SELECT
  b.id,
  b.event_name,
  b.event_date,
  b.event_time,
  '23:00',
  b.event_location,
  b.guest_count,
  CASE WHEN b.status = 'Completed' THEN 'Completed' ELSE 'Scheduled' END,
  (SELECT id FROM staff WHERE staff_code = 'STF-101'),
  b.special_instructions
FROM bookings b
ON CONFLICT (booking_id) DO NOTHING;

INSERT INTO payments (booking_id, customer_id, amount, payment_type, method, status, transaction_id, is_demo, paid_at) VALUES
  ((SELECT id FROM bookings WHERE booking_code='CE-2026-1001'), (SELECT customer_id FROM bookings WHERE booking_code='CE-2026-1001'), 329700.00, 'FULL', 'UPI', 'PAID', 'TXN-CE-2026-8801', TRUE, '2026-08-05 14:15:00'),
  ((SELECT id FROM bookings WHERE booking_code='CE-2026-1002'), (SELECT customer_id FROM bookings WHERE booking_code='CE-2026-1002'), 98700.00, 'FULL', 'CREDIT_CARD', 'PAID', 'TXN-CE-2026-8802', TRUE, '2026-09-12 09:40:00'),
  ((SELECT id FROM bookings WHERE booking_code='CE-2026-1003'), (SELECT customer_id FROM bookings WHERE booking_code='CE-2026-1003'), 63735.00, 'FULL', 'UPI', 'PAID', 'TXN-CE-2026-8803', TRUE, '2026-10-04 16:00:00'),
  ((SELECT id FROM bookings WHERE booking_code='CE-2026-1004'), (SELECT customer_id FROM bookings WHERE booking_code='CE-2026-1004'), 54180.00, 'ADVANCE', 'RAZORPAY', 'PAID', 'TXN-CE-2026-8804', TRUE, '2026-11-06 11:20:00'),
  ((SELECT id FROM bookings WHERE booking_code='CE-2026-1005'), (SELECT customer_id FROM bookings WHERE booking_code='CE-2026-1005'), 85000.00, 'ADVANCE', 'DEBIT_CARD', 'PAID', 'TXN-CE-2026-8805', TRUE, '2026-11-09 18:10:00')
ON CONFLICT (transaction_id) DO NOTHING;

INSERT INTO invoices (invoice_number, booking_id, payment_id, subtotal, tax_amount, delivery_charge, discount_amount, total_amount, status)
SELECT
  'INV-' || REPLACE(b.booking_code, 'CE-', ''),
  b.id,
  p.id,
  b.subtotal,
  b.tax_amount,
  b.delivery_charge,
  b.discount_amount,
  b.total_amount,
  CASE WHEN b.payment_status = 'Paid' THEN 'Paid' ELSE 'Partial' END
FROM bookings b
JOIN payments p ON p.booking_id = b.id
ON CONFLICT (invoice_number) DO NOTHING;

INSERT INTO staff_assignments (booking_id, staff_id, assigned_role, task_summary, prep_status, delivery_status, notes) VALUES
  ((SELECT id FROM bookings WHERE booking_code='CE-2026-1004'), (SELECT id FROM staff WHERE staff_code='STF-101'), 'Executive Head Chef', 'Prepare 150-guest engagement banquet mains, live tandoor marinades, and gluten-free platter labels.', 'PENDING', 'PENDING', 'Confirm final spice profile 48h prior.'),
  ((SELECT id FROM bookings WHERE booking_code='CE-2026-1005'), (SELECT id FROM staff WHERE staff_code='STF-101'), 'Executive Head Chef', 'Lead prep for 180-guest festive spread: live chaat counters, Awadhi biryani, and vegan grazing station.', 'PREPARING', 'PENDING', 'Dry spices & saffron allocated from cold store.'),
  ((SELECT id FROM bookings WHERE booking_code='CE-2026-1005'), (SELECT id FROM staff WHERE staff_code='STF-102'), 'Events & Logistics Lead', 'Coordinate brass chafing setup, botanical cooler dispensers, and service team dispatch.', 'PREPARING', 'PENDING', '2 vans scheduled for 15:30 arrival.'),
  ((SELECT id FROM bookings WHERE booking_code='CE-2026-1003'), (SELECT id FROM staff WHERE staff_code='STF-101'), 'Executive Head Chef', 'Completed Aarush 1st Birthday Brunch catering.', 'COMPLETED', 'DELIVERED', 'Zero leftover waste; rave guest feedback.')
ON CONFLICT (booking_id, staff_id) DO NOTHING;

INSERT INTO reviews (booking_id, customer_id, rating, title, comment, is_approved, ai_sentiment) VALUES
  ((SELECT id FROM bookings WHERE booking_code='CE-2026-1001'), (SELECT customer_id FROM bookings WHERE booking_code='CE-2026-1001'), 5, 'Unforgettable Sangeet Hospitality', 'The saffron biryani and separate Jain station won over every single elder in our family. Service staff were immaculate and warm.', TRUE, 'Positive'),
  ((SELECT id FROM bookings WHERE booking_code='CE-2026-1002'), (SELECT customer_id FROM bookings WHERE booking_code='CE-2026-1002'), 5, 'Zero-Friction Corporate Setup', 'CaterEase arrived 45 minutes early, labeled all vegan and allergen-free dishes clearly, and cleared up silently after our keynote.', TRUE, 'Positive'),
  ((SELECT id FROM bookings WHERE booking_code='CE-2026-1003'), (SELECT customer_id FROM bookings WHERE booking_code='CE-2026-1003'), 4, 'Delicious Brunch & Kids Corner', 'Loved the live waffle bar and mild-spice dishes for kids. Would have loved slightly faster coffee refills during the peak hour.', TRUE, 'Positive')
ON CONFLICT (booking_id) DO NOTHING;

INSERT INTO notifications (user_id, title, message, type, is_read, link_url) VALUES
  ((SELECT id FROM users WHERE email='customer@caterease.com'), 'Booking Confirmed: CE-2026-1004', 'Your Meera & Dev Engagement Dinner for 150 guests has been confirmed. Advance payment received.', 'BOOKING', FALSE, '/dashboard/customer/bookings'),
  ((SELECT id FROM users WHERE email='customer@caterease.com'), 'Welcome to CaterEase Loyalty', 'You earned 480 hospitality points from your recent celebrations.', 'SYSTEM', TRUE, '/dashboard/customer'),
  ((SELECT id FROM users WHERE email='admin@caterease.com'), 'Low Stock Alert: Kashmiri Saffron & Paneer', '2 ingredients are below minimum stock thresholds. Review inventory replenishment.', 'INVENTORY', FALSE, '/dashboard/admin/inventory'),
  ((SELECT id FROM users WHERE email='admin@caterease.com'), 'New Pending Booking CE-2026-1006', 'Ananya Sharma requested Griha Pravesh Housewarming Feast for 60 guests on Dec 6.', 'BOOKING', FALSE, '/dashboard/admin/bookings'),
  ((SELECT id FROM users WHERE email='staff@caterease.com'), 'Assignment Active: CE-2026-1005', 'You are assigned as Executive Head Chef for Annual Product Launch & Mixer (180 guests).', 'STAFF', FALSE, '/dashboard/staff')
ON CONFLICT DO NOTHING;

INSERT INTO support_tickets (ticket_number, customer_id, booking_id, category, subject, description, status, priority) VALUES
  ('TKT-2026-401', (SELECT id FROM customers WHERE user_id = (SELECT id FROM users WHERE email='customer@caterease.com')), (SELECT id FROM bookings WHERE booking_code='CE-2026-1004'), 'Menu Customization', 'Add 15 Gluten-Free Dessert Portions', 'Can we swap 15 chocolate tarts for the vegan coconut mango panna cotta on our Engagement menu?', 'In Progress', 'Medium')
ON CONFLICT (ticket_number) DO NOTHING;

INSERT INTO support_messages (ticket_id, sender_user_id, sender_role, message)
SELECT id, (SELECT id FROM users WHERE email='customer@caterease.com'), 'CUSTOMER', 'Can we swap 15 chocolate tarts for the vegan coconut mango panna cotta on our Engagement menu?'
FROM support_tickets WHERE ticket_number = 'TKT-2026-401'
AND NOT EXISTS (SELECT 1 FROM support_messages WHERE ticket_id = support_tickets.id);

INSERT INTO business_settings (key, value) VALUES
  ('business_name', 'CaterEase Culinary & Events'),
  ('tagline', 'Smart Catering. Seamless Celebrations.'),
  ('tax_rate_percent', '5'),
  ('delivery_fee', '1200'),
  ('free_delivery_threshold', '15000'),
  ('support_email', 'concierge@caterease.com'),
  ('support_phone', '+91 22 4890 2200'),
  ('hq_address', 'Level 4, Culinary Guild House, Bandra Kurla Complex, Mumbai 400051')
ON CONFLICT (key) DO NOTHING;
