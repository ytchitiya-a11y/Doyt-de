-- =========================================
-- INSTANT DELIVERY SYSTEM - MVP DATABASE SCHEMA
-- =========================================

-- 1. USERS (Customers)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    firebase_uid VARCHAR(128) UNIQUE NOT NULL,
    name VARCHAR(100),
    phone VARCHAR(15),
    email VARCHAR(150),
    address TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. DELIVERY PARTNERS
CREATE TABLE IF NOT EXISTS delivery_partners (
    id SERIAL PRIMARY KEY,
    firebase_uid VARCHAR(128) UNIQUE NOT NULL,
    name VARCHAR(100),
    phone VARCHAR(15),
    vehicle_type VARCHAR(50) DEFAULT 'bike',
    status VARCHAR(20) DEFAULT 'offline', -- offline, available, busy
    current_lat DECIMAL(10, 6),
    current_lng DECIMAL(10, 6),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. ADMINS
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    firebase_uid VARCHAR(128) UNIQUE NOT NULL,
    name VARCHAR(100),
    email VARCHAR(150),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. PRODUCTS (Chola Bhatura, Chaat, Grocery items etc.)
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50), -- food, grocery
    price DECIMAL(10, 2) NOT NULL,
    image_url TEXT,
    is_available BOOLEAN DEFAULT true,
    stock INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5. ORDERS
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    delivery_partner_id INT REFERENCES delivery_partners(id),
    status VARCHAR(20) DEFAULT 'pending',
    -- pending -> accepted -> picked_up -> delivered / cancelled
    total_amount DECIMAL(10, 2) NOT NULL,
    delivery_address TEXT NOT NULL,
    payment_method VARCHAR(20) DEFAULT 'cod', -- cod, upi, razorpay
    payment_status VARCHAR(20) DEFAULT 'pending', -- pending, paid, failed
    razorpay_order_id VARCHAR(100),
    razorpay_payment_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 6. ORDER ITEMS (products inside an order)
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id),
    quantity INT NOT NULL DEFAULT 1,
    price DECIMAL(10, 2) NOT NULL
);

-- 7. ORDER REJECTIONS (tracks which partners rejected which order, so we don't reassign to them again)
CREATE TABLE IF NOT EXISTS order_rejections (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id) ON DELETE CASCADE,
    delivery_partner_id INT REFERENCES delivery_partners(id),
    rejected_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_status ON delivery_partners(status);
