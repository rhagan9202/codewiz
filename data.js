// Mock codebase: a generic e-commerce-ish web app
// (React frontend + Node API + a few external integrations)

const LAYERS = {
  ui:       { label: "UI",        color: "var(--cyan)",   short: "U" },
  state:    { label: "State",     color: "var(--violet)", short: "S" },
  api:      { label: "API edge",  color: "var(--green)",  short: "A" },
  service:  { label: "Service",   color: "var(--amber)",  short: "X" },
  data:     { label: "Data",      color: "var(--pink)",   short: "D" },
  external: { label: "External",  color: "#5b6577",       short: "E" },
};

const TEAMS = {
  web:      { label: "Web",       color: "var(--cyan)" },
  platform: { label: "Platform",  color: "var(--violet)" },
  payments: { label: "Payments",  color: "var(--amber)" },
  infra:    { label: "Infra",     color: "var(--green)" },
};

const DOMAINS = {
  auth:    { label: "Auth",    color: "var(--violet)" },
  catalog: { label: "Catalog", color: "var(--cyan)" },
  cart:    { label: "Cart",    color: "var(--green)" },
  orders:  { label: "Orders",  color: "var(--amber)" },
  payments:{ label: "Payments",color: "var(--pink)" },
  core:    { label: "Core",    color: "#5b6577" },
};

// id, name, path, layer, team, domain, kind, loc, owner, health, notes, deps[], tags[], annotation
const MODULES = [
  // Frontend pages
  { id: "p_home",     name: "HomePage",     path: "web/src/pages/Home.tsx",      layer: "ui",    team: "web", domain: "catalog", kind: "page",     loc: 142, owner: "K. Tan",   health: 0.9 },
  { id: "p_pdp",      name: "ProductPage",  path: "web/src/pages/Product.tsx",   layer: "ui",    team: "web", domain: "catalog", kind: "page",     loc: 312, owner: "K. Tan",   health: 0.85 },
  { id: "p_cart",     name: "CartPage",     path: "web/src/pages/Cart.tsx",      layer: "ui",    team: "web", domain: "cart",    kind: "page",     loc: 220, owner: "M. Ok",    health: 0.65, annotation: "warn" },
  { id: "p_checkout", name: "CheckoutPage", path: "web/src/pages/Checkout.tsx",  layer: "ui",    team: "web", domain: "orders",  kind: "page",     loc: 488, owner: "M. Ok",    health: 0.5,  annotation: "warn" },
  { id: "p_login",    name: "LoginPage",    path: "web/src/pages/Login.tsx",     layer: "ui",    team: "web", domain: "auth",    kind: "page",     loc: 178, owner: "J. Vita",  health: 0.95 },

  // Frontend components
  { id: "c_button",   name: "Button",       path: "web/src/components/Button.tsx",   layer: "ui", team: "web", domain: "core",    kind: "component", loc: 64, owner: "J. Vita", health: 1.0 },
  { id: "c_modal",    name: "Modal",        path: "web/src/components/Modal.tsx",    layer: "ui", team: "web", domain: "core",    kind: "component", loc: 132, owner: "J. Vita", health: 0.9 },
  { id: "c_form",     name: "FormFields",   path: "web/src/components/Form.tsx",     layer: "ui", team: "web", domain: "core",    kind: "component", loc: 188, owner: "J. Vita", health: 0.85 },
  { id: "c_pcard",    name: "ProductCard",  path: "web/src/components/ProductCard.tsx", layer: "ui", team: "web", domain: "catalog", kind: "component", loc: 96, owner: "K. Tan", health: 0.9 },
  { id: "c_header",   name: "AppHeader",    path: "web/src/components/Header.tsx",   layer: "ui", team: "web", domain: "core",    kind: "component", loc: 110, owner: "K. Tan", health: 0.8 },

  // Hooks / state
  { id: "h_auth",     name: "useAuth",      path: "web/src/hooks/useAuth.ts",     layer: "state", team: "web", domain: "auth",  kind: "hook",  loc: 88, owner: "J. Vita", health: 0.9 },
  { id: "h_cart",     name: "useCart",      path: "web/src/hooks/useCart.ts",     layer: "state", team: "web", domain: "cart",  kind: "hook",  loc: 142, owner: "M. Ok",   health: 0.7, annotation: "dup", notes: "Overlaps with cartStore — duplicated reducer logic." },
  { id: "s_auth",     name: "authStore",    path: "web/src/store/authStore.ts",   layer: "state", team: "web", domain: "auth",  kind: "store", loc: 96, owner: "J. Vita", health: 0.85 },
  { id: "s_cart",     name: "cartStore",    path: "web/src/store/cartStore.ts",   layer: "state", team: "web", domain: "cart",  kind: "store", loc: 168, owner: "M. Ok",   health: 0.75, annotation: "dup" },

  // API client (frontend → backend bridge)
  { id: "x_apicli",   name: "apiClient",    path: "web/src/api/client.ts",        layer: "api",   team: "web", domain: "core",  kind: "client", loc: 140, owner: "K. Tan", health: 0.85 },

  // Backend routes
  { id: "r_auth",     name: "/auth",        path: "api/src/routes/auth.ts",       layer: "api",   team: "platform", domain: "auth",    kind: "route", loc: 92,  owner: "R. Idris", health: 0.9 },
  { id: "r_prod",     name: "/products",    path: "api/src/routes/products.ts",   layer: "api",   team: "platform", domain: "catalog", kind: "route", loc: 78,  owner: "R. Idris", health: 0.95 },
  { id: "r_cart",     name: "/cart",        path: "api/src/routes/cart.ts",       layer: "api",   team: "platform", domain: "cart",    kind: "route", loc: 154, owner: "R. Idris", health: 0.7, annotation: "warn" },
  { id: "r_orders",   name: "/orders",      path: "api/src/routes/orders.ts",     layer: "api",   team: "platform", domain: "orders",  kind: "route", loc: 188, owner: "R. Idris", health: 0.8 },

  // Backend services
  { id: "sv_auth",    name: "AuthService",   path: "api/src/services/AuthService.ts",    layer: "service", team: "platform", domain: "auth",     kind: "service", loc: 220, owner: "R. Idris", health: 0.85 },
  { id: "sv_prod",    name: "ProductSvc",    path: "api/src/services/ProductService.ts", layer: "service", team: "platform", domain: "catalog",  kind: "service", loc: 198, owner: "R. Idris", health: 0.9 },
  { id: "sv_cart",    name: "CartService",   path: "api/src/services/CartService.ts",    layer: "service", team: "platform", domain: "cart",     kind: "service", loc: 264, owner: "R. Idris", health: 0.55, annotation: "err", notes: "Stale-cache bug found 2 days ago." },
  { id: "sv_order",   name: "OrderService",  path: "api/src/services/OrderService.ts",   layer: "service", team: "payments", domain: "orders",   kind: "service", loc: 312, owner: "L. Bowe",  health: 0.7 },
  { id: "sv_pay",     name: "PaymentSvc",    path: "api/src/services/PaymentService.ts", layer: "service", team: "payments", domain: "payments", kind: "service", loc: 184, owner: "L. Bowe",  health: 0.9 },

  // Middleware
  { id: "m_auth",     name: "authMiddleware", path: "api/src/middleware/auth.ts",   layer: "service", team: "platform", domain: "auth",  kind: "middleware", loc: 64, owner: "R. Idris", health: 0.95 },
  { id: "m_rate",     name: "rateLimit",      path: "api/src/middleware/rate.ts",   layer: "service", team: "infra",    domain: "core",  kind: "middleware", loc: 42, owner: "S. Pak",   health: 1.0, annotation: "new" },
  { id: "m_log",      name: "logger",         path: "api/src/middleware/log.ts",    layer: "service", team: "infra",    domain: "core",  kind: "middleware", loc: 38, owner: "S. Pak",   health: 0.95 },

  // Data layer
  { id: "d_db",       name: "db (postgres)", path: "api/src/data/db.ts",          layer: "data", team: "infra", domain: "core",    kind: "client", loc: 88, owner: "S. Pak", health: 0.95 },
  { id: "d_cache",    name: "cache (redis)", path: "api/src/data/cache.ts",       layer: "data", team: "infra", domain: "core",    kind: "client", loc: 56, owner: "S. Pak", health: 0.9 },
  { id: "d_user",     name: "User (model)",  path: "api/src/models/User.ts",      layer: "data", team: "platform", domain: "auth",   kind: "model",  loc: 72, owner: "R. Idris", health: 0.9 },
  { id: "d_prod",     name: "Product",       path: "api/src/models/Product.ts",   layer: "data", team: "platform", domain: "catalog",kind: "model",  loc: 64, owner: "R. Idris", health: 0.95 },
  { id: "d_cart",     name: "CartRecord",    path: "api/src/models/Cart.ts",      layer: "data", team: "platform", domain: "cart",   kind: "model",  loc: 88, owner: "R. Idris", health: 0.7, annotation: "warn" },
  { id: "d_order",    name: "Order",         path: "api/src/models/Order.ts",     layer: "data", team: "payments", domain: "orders", kind: "model",  loc: 118, owner: "L. Bowe",  health: 0.85 },

  // External
  { id: "e_stripe",   name: "Stripe",     path: "external://stripe",  layer: "external", team: "payments", domain: "payments", kind: "external", loc: 0, owner: "vendor", health: 1.0 },
  { id: "e_pg",       name: "Postgres",   path: "external://postgres", layer: "external", team: "infra",    domain: "core",     kind: "external", loc: 0, owner: "vendor", health: 1.0 },
  { id: "e_redis",    name: "Redis",      path: "external://redis",    layer: "external", team: "infra",    domain: "core",     kind: "external", loc: 0, owner: "vendor", health: 1.0 },
  { id: "e_cdn",      name: "CDN",        path: "external://cdn",      layer: "external", team: "infra",    domain: "core",     kind: "external", loc: 0, owner: "vendor", health: 1.0 },
];

// Edges. kind ∈ {imports, calls, data, http}
const EDGES = [
  // Pages → components
  ["p_home", "c_pcard", "imports"], ["p_home", "c_header", "imports"], ["p_home", "c_button", "imports"],
  ["p_pdp",  "c_pcard", "imports"], ["p_pdp",  "c_button", "imports"], ["p_pdp",  "c_header", "imports"],
  ["p_cart", "c_button", "imports"], ["p_cart", "c_modal", "imports"], ["p_cart", "c_header", "imports"],
  ["p_checkout", "c_form", "imports"], ["p_checkout", "c_button", "imports"], ["p_checkout", "c_modal", "imports"],
  ["p_login", "c_form", "imports"], ["p_login", "c_button", "imports"],

  // Pages → hooks/state
  ["p_home", "h_auth", "imports"],
  ["p_pdp",  "h_cart", "imports"], ["p_pdp", "h_auth", "imports"],
  ["p_cart", "h_cart", "imports"], ["p_cart", "s_cart", "imports"],
  ["p_checkout", "s_cart", "imports"], ["p_checkout", "s_auth", "imports"], ["p_checkout", "h_cart", "imports"],
  ["p_login", "h_auth", "imports"], ["p_login", "s_auth", "imports"],
  ["c_header", "s_auth", "imports"], ["c_header", "s_cart", "imports"],

  // Hooks ↔ stores
  ["h_auth", "s_auth", "imports"],
  ["h_cart", "s_cart", "imports"],

  // State → api client
  ["s_auth", "x_apicli", "imports"],
  ["s_cart", "x_apicli", "imports"],
  ["h_cart", "x_apicli", "imports"],

  // API client → backend (http)
  ["x_apicli", "r_auth",   "http"],
  ["x_apicli", "r_prod",   "http"],
  ["x_apicli", "r_cart",   "http"],
  ["x_apicli", "r_orders", "http"],

  // Routes → middleware
  ["r_auth",   "m_log",  "calls"], ["r_auth",   "m_rate", "calls"],
  ["r_prod",   "m_log",  "calls"], ["r_prod",   "m_rate", "calls"], ["r_prod", "m_auth", "calls"],
  ["r_cart",   "m_log",  "calls"], ["r_cart",   "m_auth", "calls"],
  ["r_orders", "m_log",  "calls"], ["r_orders", "m_auth", "calls"],

  // Routes → services
  ["r_auth",   "sv_auth",  "calls"],
  ["r_prod",   "sv_prod",  "calls"],
  ["r_cart",   "sv_cart",  "calls"],
  ["r_orders", "sv_order", "calls"],

  // Services ↔ services
  ["sv_order", "sv_pay",  "calls"],
  ["sv_order", "sv_cart", "calls"],
  ["sv_cart",  "sv_prod", "calls"],
  ["m_auth",   "sv_auth", "calls"],

  // Services → data
  ["sv_auth",  "d_user", "data"], ["sv_auth", "d_cache", "data"],
  ["sv_prod",  "d_prod", "data"], ["sv_prod", "d_cache", "data"],
  ["sv_cart",  "d_cart", "data"], ["sv_cart", "d_cache", "data"],
  ["sv_order", "d_order","data"], ["sv_order","d_user", "data"],
  ["sv_pay",   "d_order","data"],

  // Data → external
  ["d_db",    "e_pg",    "data"],
  ["d_cache", "e_redis", "data"],
  ["d_user",  "d_db",    "data"],
  ["d_prod",  "d_db",    "data"],
  ["d_cart",  "d_db",    "data"],
  ["d_order", "d_db",    "data"],
  ["sv_pay",  "e_stripe","calls"],
  ["c_pcard", "e_cdn",   "data"],
];

// Functional flows: user actions → call paths
const FLOWS = [
  {
    id: "f_buy",
    name: "Customer purchases item",
    desc: "Add to cart → checkout → payment → confirmation",
    health: "warn",
    steps: [
      { mod: "p_pdp",     action: "User taps 'Add to cart'",        note: "useCart.add(productId)" },
      { mod: "h_cart",    action: "Optimistic update + dispatch",   note: "cartStore.dispatch(ADD_ITEM)" },
      { mod: "s_cart",    action: "Persist via api.post('/cart')",  note: "fetch /cart  · 250ms p95" },
      { mod: "x_apicli",  action: "POST /cart/items",                note: "Bearer token attached" },
      { mod: "r_cart",    action: "authMiddleware → CartService",   note: "" },
      { mod: "sv_cart",   action: "Validate stock + write CartRecord", note: "stale-cache bug here", warn: true },
      { mod: "d_cart",    action: "UPSERT carts table",              note: "1 row affected" },
      { mod: "p_checkout",action: "User clicks 'Place order'",       note: "form.submit()" },
      { mod: "r_orders",  action: "POST /orders",                    note: "" },
      { mod: "sv_order",  action: "Create order, charge payment",    note: "calls PaymentService" },
      { mod: "sv_pay",    action: "Stripe.charges.create()",         note: "external" },
      { mod: "e_stripe",  action: "Returns charge token",            note: "" },
      { mod: "d_order",   action: "INSERT orders, status=paid",      note: "" },
    ],
  },
  {
    id: "f_login",
    name: "User signs in",
    desc: "Login form → token → session",
    health: "ok",
    steps: [
      { mod: "p_login",  action: "User submits email + password" },
      { mod: "h_auth",   action: "useAuth.signIn(creds)" },
      { mod: "x_apicli", action: "POST /auth/login" },
      { mod: "r_auth",   action: "Route → AuthService" },
      { mod: "sv_auth",  action: "Verify password (bcrypt)" },
      { mod: "d_user",   action: "SELECT user WHERE email" },
      { mod: "d_cache",  action: "Cache JWT for 5 min" },
      { mod: "s_auth",   action: "Persist token, hydrate user" },
      { mod: "p_home",   action: "Redirect to home" },
    ],
  },
  {
    id: "f_browse",
    name: "Browse catalog",
    desc: "Open home → product list → details",
    health: "ok",
    steps: [
      { mod: "p_home",   action: "Mount HomePage" },
      { mod: "x_apicli", action: "GET /products?featured=1" },
      { mod: "r_prod",   action: "Route → ProductService" },
      { mod: "sv_prod",  action: "Fetch from cache or DB" },
      { mod: "d_cache",  action: "Cache hit (78%)" },
      { mod: "c_pcard",  action: "Render product cards" },
      { mod: "e_cdn",    action: "Load product images" },
    ],
  },
];

// Data flows — focused on data lifecycle: where data originates,
// what payload shape it has at each step, where it transforms
const DATA_FLOWS = [
  {
    id: "df_cart_item",
    name: "CartItem lifecycle",
    desc: "How a CartItem flows from UI → store → API → DB",
    health: "warn",
    steps: [
      { mod: "p_pdp", action: "Build payload from product",
        payload: { productId: "p_42", quantity: 1 },
        contract: "CartItem (partial)",
        note: "missing priceSnapshot" , warn: true },
      { mod: "h_cart", action: "Hook augments with timestamp",
        payload: { productId: "p_42", quantity: 1, addedAt: "2026-05-10T…" },
        contract: "CartItem (still partial)",
        note: "still no priceSnapshot — drift risk", warn: true },
      { mod: "x_apicli", action: "POST /cart/items",
        payload: "Body: { productId, quantity, addedAt }",
        contract: "CartItem", note: "" },
      { mod: "r_cart", action: "Validates body via Zod schema",
        payload: "Adds: priceSnapshot from live ProductService",
        contract: "CartItem (full)", note: "server fills the gap" },
      { mod: "sv_cart", action: "Persist record",
        payload: "{ ...cartItem, userId, cartId }",
        contract: "CartRecord", note: "augmented with cart context" },
      { mod: "d_cart", action: "UPSERT row",
        payload: "INSERT INTO cart_items (...)",
        contract: "DB row", note: "" },
    ],
  },
  {
    id: "df_session",
    name: "Session token",
    desc: "JWT issuance and propagation",
    health: "ok",
    steps: [
      { mod: "sv_auth", action: "Sign token with HMAC",
        payload: { userId: "u_4f2", scopes: ["read","write"], exp: 1718000000 },
        contract: "Session" },
      { mod: "d_cache", action: "Cache token TTL=300s",
        payload: "redis SET sess:<token>",
        contract: "Session" },
      { mod: "x_apicli", action: "Attach Bearer to all requests",
        payload: "Authorization: Bearer <jwt>",
        contract: "Session.token (string)" },
      { mod: "m_auth", action: "Verify + parse",
        payload: "{ userId, scopes }",
        contract: "Session" },
    ],
  },
  {
    id: "df_money",
    name: "Money / pricing",
    desc: "How prices propagate from DB to UI",
    health: "warn",
    steps: [
      { mod: "d_prod", action: "Stored as integer cents + currency",
        payload: { amount_cents: 1299, currency: "USD" },
        contract: "DB schema" },
      { mod: "sv_prod", action: "Wrap into Money object",
        payload: { amount: 12.99, currency: "USD" },
        contract: "Money" },
      { mod: "x_apicli", action: "JSON-serialize",
        payload: '{ "amount": 12.99, "currency": "USD" }',
        contract: "Money" },
      { mod: "c_pcard", action: "Reads price.toFixed(2)",
        payload: "expects: number  ·  receives: Money",
        contract: "Money", note: "Type mismatch — ProductCard treats price as number", warn: true },
      { mod: "p_cart", action: "Hard-codes '$' prefix",
        payload: "ignores currency field",
        contract: "Money", note: "Won't render EUR correctly", warn: true },
    ],
  },
];

// Contracts (interfaces) — used to compare callers vs responses
const CONTRACTS = [
  {
    id: "User",
    name: "User",
    domain: "auth",
    fields: [
      { name: "id",        type: "string",   required: true },
      { name: "email",     type: "string",   required: true },
      { name: "name",      type: "string",   required: false },
      { name: "createdAt", type: "ISODate",  required: true },
      { name: "role",      type: "'admin'|'user'", required: true },
      { name: "avatarUrl", type: "string?",  required: false },
    ],
    producers: ["sv_auth", "d_user"],
    consumers: ["s_auth", "h_auth", "c_header", "p_checkout", "sv_order"],
    issues: [
      { kind: "missing",  field: "avatarUrl", consumer: "sv_order", producer: "sv_auth",
        note: "OrderService reads user.avatarUrl but it isn't always set.",
        expected: { name: "avatarUrl", type: "string", required: true, source: "OrderService.ts:64", snippet: "const url = user.avatarUrl;" },
        actual:   { name: "avatarUrl", type: "string?", required: false, source: "AuthService.ts:118", snippet: "return { ...user, avatarUrl: user.avatarUrl ?? undefined };" } },
      { kind: "shape",    field: "role",      consumer: "c_header", producer: "sv_auth",
        note: "Header treats role as string, ignores 'admin'.",
        expected: { name: "role", type: "string", required: true, source: "Header.tsx:42", snippet: "<span>{user.role}</span>" },
        actual:   { name: "role", type: "'admin'|'user'", required: true, source: "AuthService.ts:91", snippet: "role: row.is_admin ? 'admin' : 'user'," } },
    ],
    related: ["Session", "Order"],
  },
  {
    id: "Session",
    name: "Session",
    domain: "auth",
    fields: [
      { name: "token",   type: "string", required: true },
      { name: "userId",  type: "string", required: true },
      { name: "expires", type: "ISODate", required: true },
      { name: "scopes",  type: "string[]", required: false },
    ],
    producers: ["sv_auth"],
    consumers: ["m_auth", "x_apicli", "s_auth"],
    issues: [],
    related: ["User"],
  },
  {
    id: "Product",
    name: "Product",
    domain: "catalog",
    fields: [
      { name: "id",         type: "string", required: true },
      { name: "title",      type: "string", required: true },
      { name: "price",      type: "Money",  required: true },
      { name: "stock",      type: "number", required: true },
      { name: "imageUrl",   type: "string", required: false },
      { name: "tags",       type: "string[]", required: false },
    ],
    producers: ["sv_prod", "d_prod"],
    consumers: ["c_pcard", "p_home", "p_pdp", "sv_cart"],
    issues: [
      { kind: "shape", field: "price", consumer: "c_pcard", producer: "sv_prod",
        note: "ProductCard expects price: number, but service returns Money { amount, currency }.",
        expected: { name: "price", type: "number", required: true, source: "ProductCard.tsx:28",
          snippet: "<span>${product.price.toFixed(2)}</span>" },
        actual:   { name: "price", type: "Money", required: true, source: "ProductService.ts:71",
          snippet: "return { ...row, price: { amount, currency: 'USD' } };" } },
    ],
    related: ["CartItem", "OrderLine"],
  },
  {
    id: "CartItem",
    name: "CartItem",
    domain: "cart",
    fields: [
      { name: "productId", type: "string", required: true },
      { name: "quantity",  type: "number", required: true },
      { name: "priceSnapshot", type: "Money", required: true },
      { name: "addedAt",   type: "ISODate", required: true },
    ],
    producers: ["sv_cart", "d_cart"],
    consumers: ["s_cart", "h_cart", "p_cart", "p_checkout", "sv_order"],
    issues: [
      { kind: "missing", field: "priceSnapshot", consumer: "h_cart", producer: "sv_cart",
        note: "useCart constructs items without priceSnapshot — falls back to live price (drift risk).",
        expected: { name: "priceSnapshot", type: "Money", required: true, source: "CartService.ts:88",
          snippet: "db.cart.insert({ ...item, priceSnapshot: product.price })" },
        actual:   { name: "priceSnapshot", type: "undefined", required: false, source: "useCart.ts:34",
          snippet: "dispatch({ type:'ADD', item: { productId, quantity } }); // no priceSnapshot" } },
    ],
    related: ["Product", "Order"],
  },
  {
    id: "Order",
    name: "Order",
    domain: "orders",
    fields: [
      { name: "id",       type: "string", required: true },
      { name: "userId",   type: "string", required: true },
      { name: "lines",    type: "OrderLine[]", required: true },
      { name: "status",   type: "'pending'|'paid'|'shipped'|'cancelled'", required: true },
      { name: "total",    type: "Money", required: true },
      { name: "paymentRef", type: "string", required: false },
      { name: "createdAt", type: "ISODate", required: true },
    ],
    producers: ["sv_order", "d_order"],
    consumers: ["sv_pay", "p_checkout"],
    issues: [],
    related: ["User", "OrderLine"],
  },
  {
    id: "OrderLine",
    name: "OrderLine",
    domain: "orders",
    fields: [
      { name: "productId", type: "string", required: true },
      { name: "quantity",  type: "number", required: true },
      { name: "unitPrice", type: "Money",  required: true },
    ],
    producers: ["sv_order"],
    consumers: ["sv_pay", "d_order"],
    issues: [],
    related: ["Order", "Product"],
  },
  {
    id: "Money",
    name: "Money",
    domain: "core",
    fields: [
      { name: "amount",   type: "number", required: true },
      { name: "currency", type: "'USD'|'EUR'", required: true },
    ],
    producers: ["sv_prod", "sv_order", "sv_pay"],
    consumers: ["c_pcard", "p_cart", "p_checkout", "sv_cart"],
    issues: [
      { kind: "shape", field: "currency", consumer: "p_cart", producer: "sv_prod",
        note: "CartPage hard-codes '$' instead of formatting via currency.",
        expected: { name: "currency", type: "'USD'|'EUR'", required: true, source: "Cart.tsx:71",
          snippet: "<span>{formatMoney(item.priceSnapshot)}</span>" },
        actual:   { name: "currency", type: "hard-coded '$'", required: false, source: "Cart.tsx:71",
          snippet: "<span>${item.priceSnapshot.amount}</span>" } },
    ],
    related: ["Product", "Order"],
  },
];

window.__DATA__ = {
  LAYERS, TEAMS, DOMAINS,
  modules: MODULES,
  edges: EDGES.map(([s, t, k]) => ({ source: s, target: t, kind: k })),
  flows: FLOWS,
  dataFlows: DATA_FLOWS,
  contracts: CONTRACTS,
};
