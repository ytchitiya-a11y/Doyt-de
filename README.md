# Instant Delivery Backend (MVP) — Prayagraj

Node.js + Express + PostgreSQL + Firebase Authentication

## 1. Setup

```bash
cd backend
npm install
cp .env.example .env   # fill in your real DB + Firebase credentials
```

### PostgreSQL setup
```bash
createdb instant_delivery
psql -d instant_delivery -f sql/schema.sql
psql -d instant_delivery -f sql/seed.sql   # adds Chola Bhatura, Phulki Chaat etc. for testing
```

### Firebase setup
1. Firebase Console → Create Project → Enable Authentication (Phone or Email/Password)
2. Project Settings → Service Accounts → Generate New Private Key → download JSON
3. Copy `project_id`, `private_key`, `client_email` into `.env`

### Cloudinary setup (Product Images)
1. Sign up free at https://cloudinary.com
2. Dashboard pe `Cloud Name`, `API Key`, `API Secret` milega
3. In teeno ko `.env` mein daalo
4. Images automatically `instant-delivery/products` folder mein organize hoti hain, aur upload ke time 800x800 tak resize ho jaati hain (bandwidth save karne ke liye)

### Razorpay setup (Payments)
1. Sign up free at https://dashboard.razorpay.com (Test Mode mein turant kaam kar sakte ho, KYC ke bina)
2. Settings → API Keys → Generate Test Key → `Key ID` aur `Key Secret` copy karo `.env` mein
3. (Optional but recommended) Settings → Webhooks → Add Webhook:
   - URL: `https://your-domain.com/api/payments/webhook`
   - Events: `payment.captured`
   - Webhook secret wahi `.env` ke `RAZORPAY_WEBHOOK_SECRET` mein daalo
4. Test payments ke liye Razorpay ke test cards use karo (docs mein milte hain) — real paisa nahi katega Test Mode mein

### Run
```bash
npm run dev     # nodemon, auto-restart
# or
npm start
```

Server runs on `http://localhost:5000`

---

## 2. Complete Flow (as requested)

```
FRONTEND (Customer)                BACKEND (Node+Express)              DELIVERY PARTNER APP           ADMIN DASHBOARD
--------------------                ---------------------              ---------------------           ---------------
1. Firebase Login  ──────────────►  Verify token (Firebase Admin)
                                     Create/find user in PostgreSQL

2. Browse menu     ──────────────►  GET /api/products
   (chola bhatura, chaat, grocery)

3. Place order      ──────────────► POST /api/orders
                                     - saves order + order_items
                                     - finds available delivery partner
                                     - assigns order to partner
                                     - emits socket "new_order" ────────► Order shows up on
                                                                          delivery app screen

                                                                    4. Partner taps ACCEPT
                                                                       POST /api/delivery/orders/:id/accept
                                     ◄───────────────────────────────── status = 'accepted'
5. Live tracking screen ◄────────── socket "order_status_update"
   updates automatically                                                       │
                                                                                ▼
                                                                    5. Partner taps PICKED UP
                                     ◄───────────────────────────────── status = 'picked_up'
6. Tracking updates ◄────────────── socket update
   (+ live lat/lng if sent)                                                    │
                                                                                ▼
                                                                    6. Partner taps DELIVERED
                                     ◄───────────────────────────────── status = 'delivered'
                                     - partner freed to 'available'
7. Order marked complete ◄───────── socket update

                                     Every step also emits to admin_room ──────────────────────────► Admin sees
                                                                                                        live order feed
```

**Key rule followed**: Frontend and Delivery App never talk to each other directly.
Backend is the single source of truth — it receives every action, updates PostgreSQL,
then pushes the result to whoever needs to see it (customer / partner / admin) via Socket.io.

---

## 3. API Reference

| Module | Method | Route | Who calls it |
|---|---|---|---|
| Auth | POST | `/api/auth/customer/sync` | Frontend, after Firebase login |
| Auth | POST | `/api/auth/delivery/sync` | Delivery App, after Firebase login |
| Products | GET | `/api/products` | Frontend (menu) |
| Orders | POST | `/api/orders` | Frontend (place order) |
| Orders | GET | `/api/orders` | Frontend (order history) |
| Orders | GET | `/api/orders/:id` | Frontend (live tracking) |
| Delivery | GET | `/api/delivery/orders` | Delivery App (assigned orders / "received" screen) |
| Delivery | POST | `/api/delivery/orders/:id/accept` | Delivery App |
| Delivery | POST | `/api/delivery/orders/:id/picked-up` | Delivery App |
| Delivery | POST | `/api/delivery/orders/:id/delivered` | Delivery App |
| Delivery | POST | `/api/delivery/location` | Delivery App (live GPS ping) |
| Delivery | POST | `/api/delivery/availability` | Delivery App (online/offline toggle) |
| Admin | GET | `/api/admin/orders` | Admin Dashboard |
| Admin | GET | `/api/admin/stats` | Admin Dashboard (homepage cards) |
| Admin | POST | `/api/admin/products` | Admin Dashboard (add menu item, **multipart/form-data** with `image` file) |
| Admin | PUT | `/api/admin/products/:id` | Admin Dashboard (edit item, `image` optional) |
| Admin | GET | `/api/admin/delivery-partners` | Admin Dashboard |
| Payments | POST | `/api/payments/create-order` | Frontend (before opening Razorpay checkout) |
| Payments | POST | `/api/payments/verify` | Frontend (after Razorpay checkout succeeds) |
| Payments | POST | `/api/payments/webhook` | Razorpay servers directly (no auth, signature-verified) |

All routes except `/api/products` need header:
```
Authorization: Bearer <firebase_id_token>
```

---

## 4. Socket.io Events

**Client emits (right after connecting):**
```js
socket.emit('join_room', { role: 'customer', id: userId });
socket.emit('join_room', { role: 'delivery_partner', id: partnerId });
socket.emit('join_room', { role: 'admin' });
```

**Server emits:**
- `new_order` → to delivery partner (order received screen)
- `order_status_update` → to customer (live tracking screen)
- `new_order_placed`, `order_status_changed` → to admin (live feed)

---

## 5. Testing WITHOUT any frontend built yet

Import `postman_collection.json` into Postman. It has every request pre-built
(customer sync → place order → delivery accept/pickup/delivered → admin stats).
You only need real Firebase ID tokens (get one by calling Firebase client SDK
`signInWithEmailAndPassword` or phone OTP from a tiny test script, then paste
into the collection variables `customerToken` / `deliveryToken` / `adminToken`).

**Note on admins**: unlike customer/delivery, there's no self-signup route for admins
on purpose (security). To create your first admin for testing, insert manually:
```sql
INSERT INTO admins (firebase_uid, name, email) VALUES ('<firebase_uid_from_console>', 'Admin', 'admin@test.com');
```

## 6. Product Image Upload Flow (Cloudinary)

```
Admin Dashboard "Add Product" form
→ Fields: name, category, price, stock (text) + image (file)
→ Sent as multipart/form-data to POST /api/admin/products
→ Backend (multer) receives image in memory
→ Backend uploads buffer to Cloudinary → gets hosted image URL
→ Backend saves that URL in products.image_url
→ Customer frontend GET /api/products → gets image_url → <img src={image_url} />
```

**Frontend form example (Admin Dashboard, plain fetch):**
```js
const formData = new FormData();
formData.append('name', 'Chola Bhatura');
formData.append('category', 'food');
formData.append('price', 60);
formData.append('stock', 50);
formData.append('image', fileInputElement.files[0]); // the actual file

await fetch(`${baseUrl}/admin/products`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${adminToken}` }, // don't set Content-Type manually, browser sets it with boundary
  body: formData,
});
```

No changes needed on the Customer frontend — it just reads `product.image_url` like any normal image link.

## 7. Razorpay Payment Flow

```
Customer places order → POST /api/orders (as before, payment_status = 'pending')
    ↓
Frontend calls POST /api/payments/create-order { order_id }
    → Backend creates a Razorpay order for the EXACT amount from our DB
    → Returns { razorpayOrderId, amount, currency, keyId }
    ↓
Frontend opens Razorpay Checkout popup (razorpay-checkout.js) using that data
    ↓
Customer pays → Razorpay returns { razorpay_order_id, razorpay_payment_id, razorpay_signature }
    ↓
Frontend calls POST /api/payments/verify with those 3 values + order_id
    → Backend recomputes the signature using RAZORPAY_KEY_SECRET and compares
    → If it matches: orders.payment_status = 'paid'
    ↓
(Safety net) Razorpay also calls POST /api/payments/webhook directly on payment.captured,
so payment_status still gets marked 'paid' even if the customer closes the tab right after paying.
```

**Frontend integration snippet (Customer Checkout page):**
```html
<!-- add once in index.html -->
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```
```js
const { data } = await api.post('/payments/create-order', { order_id: order.id });

const rzp = new window.Razorpay({
  key: data.keyId,
  amount: data.amount,
  currency: data.currency,
  order_id: data.razorpayOrderId,
  name: 'Thela Express',
  handler: async (response) => {
    await api.post('/payments/verify', {
      razorpay_order_id: response.razorpay_order_id,
      razorpay_payment_id: response.razorpay_payment_id,
      razorpay_signature: response.razorpay_signature,
      order_id: order.id,
    });
    navigate(`/track/${order.id}`);
  },
});
rzp.open();
```

## 8. How this connects to each future frontend (no backend changes needed later)

| Frontend | Talks to | Auth | Real-time |
|---|---|---|---|
| Customer Website/App | `/api/products`, `/api/orders` | Firebase (customer role) | listens for `order_status_update` |
| Delivery Partner App | `/api/delivery/*` | Firebase (delivery role) | listens for `new_order` |
| Admin Dashboard | `/api/admin/*` | Firebase (admin role) | listens for `new_order_placed`, `order_status_changed` |

Whichever framework you build each frontend in (React, plain HTML+JS, Flutter, etc.),
they all just need:
1. Firebase client SDK for login → get ID token
2. Axios/fetch calls to `{{baseUrl}}` with `Authorization: Bearer <token>` header
3. `socket.io-client` connected to the same server, emitting `join_room` after login

Set the 3 frontend URLs in `.env` → `ALLOWED_ORIGINS` once each frontend has a dev URL,
so CORS doesn't block them.

## 9. Next Steps (once MVP is tested)
- Replace `findAvailablePartner` with real distance-based sorting (PostGIS)
- Add order cancellation (by customer, before "accepted")
- Add push notifications (FCM) alongside sockets for background alerts
- Add admin ability to manually create/deactivate delivery partner & admin accounts
