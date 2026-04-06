# Product Specification Document (PRD) - TestSprite Ready

## 1. Meta Information
- **Project Name**: Self-Service Coffee Kiosk (Next.js + Olsera + Midtrans)
- **Framework & Tech Stack**: Next.js 14, React, Prisma, Tailwind CSS, Midtrans Payment Gateway, Olsera POS Open API.
- **Project Type**: Fullstack Web Application (Frontend-focused testing for TestSprite)
- **Prepared For**: TestSprite End-to-End Testing

## 2. Product Overview
This application is a complete Self-Service Coffee Kiosk system containing three primary interaction surfaces:
1. **Kiosk (Customer Facing)**: A touch-friendly UI where customers browse the menu, customize their drinks, build a cart, pay via QRIS (Midtrans), and get a queue number.
2. **KDS / Kitchen Display System (Barista Facing)**: A tablet-friendly dashboard for Baristas to manage incoming orders and update their lifecycle status from pending to ready.
3. **Admin Dashboard (Management Facing)**: A backoffice view for operational staff to view sales metrics and manually trigger menu syncing with Olsera POS.

The app acts as an integration layer orchestrating data between Olsera POS (for Products/Inventory/Orders) and Midtrans (for Payments).

---

## 3. Core Testing Goals (E2E Scenarios)
When running tests via TestSprite, the following core journeys must be covered:
- **Order Flow Session**: Customer starts an ordering session from the welcome screen and can freely browse the full menu catalog.
- **Product Customization**: Customers can select a product, customize options (size, sugar, ice, toppings), and successfully add it to their session cart.
- **Cart & Checkout Resilience**: Customer can manage cart contents, enter customer info, and trigger the Midtrans Snap payment flow.
- **Queue Feedback**: Customers can observe a queue screen that updates order status when the kitchen marks the item ready.
- **Kitchen Operational Flow**: Baristas can view new orders, start preparing them, and mark them as ready.
- **Administrative Access**: Admins can securely sign in and observe read-only dashboard metrics.

---

## 4. Feature Details & Expected User Flows

### Feature 1: Welcome / Start
- **Description**: The entry point for the kiosk where customers see a welcome screen and tap to start a new session.
- **Entry Route**: `/`
- **Expected Flow**:
  1. Navigate to `/`.
  2. See welcome screen banner/button.
  3. Start an order (Click "Dine In" / "Take Away").
  4. User is redirected to `/menu`.
- **API Dependencies**: None

### Feature 2: Browse Menu & Customization
- **Description**: Customers browse categories and products fetched directly from Olsera, open product customization modals, choose their preferences, and add items to the cart.
- **Entry Route**: `/menu`
- **Expected Flow**:
  1. Navigate to `/menu`.
  2. View categories list and product grid.
  3. Click a specific product to open the customization popup.
  4. Select variations (e.g., Size, Sugar level, Ice level, Toppings).
  5. Click "Add to Cart".
  6. Navigate to `/cart` and verify the item is present with exact chosen customizations.
- **API Dependencies**:
  - `GET /api/menu`
  - `GET /api/categories`

### Feature 3: Cart Management and Checkout
- **Description**: Review chosen items, provide an identifier name, and initiate the payment via Midtrans Snap.
- **Entry Route**: `/cart` & `/checkout`
- **Expected Flow (Happy Path)**:
  1. Navigate to `/cart`.
  2. Adjust item quantity or remove items as needed.
  3. Enter customer name in the provided input.
  4. Proceed to Checkout.
  5. Initiate payment, triggering Midtrans payment flow.
  6. Complete QRIS payment.
  7. Navigate to `/success` to see the payment success and queue number.
- **Expected Flow (Validation Error)**:
  1. Navigate to `/cart`.
  2. Attempt to check out *without* entering a customer name.
  3. UI blocks progress and shows validation error.
  4. User fills name, and successfully proceeds.
- **API Dependencies**: 
  - `POST /api/payment/create`

### Feature 4: Queue Status (Customer-Facing)
- **Description**: The digital board mounted above the collection area showing real-time queue states.
- **Entry Route**: `/status`
- **Expected Flow**:
  1. Navigate to `/status`.
  2. Wait/listen for Server Sent Events (SSE).
  3. See dynamic updates when orders move from "Preparing" to "Ready".
- **API Dependencies**: 
  - `GET /api/orders/stream` (SSE/Websocket)

### Feature 5: Kitchen Display System (Barista)
- **Description**: Internal view for baristas to manage the lifecycle of paid orders.
- **Entry Route**: `/kitchen`
- **Expected Flow**:
  1. Navigate to `/kitchen`.
  2. View list of currently pending and preparing orders.
  3. Click "Start" on a pending order (moves to preparing).
  4. Click "Done" on a preparing order (moves to ready).
- **API Dependencies**: 
  - `GET /api/orders`
  - `PATCH /api/orders/[id]`

### Feature 6: Admin Login & Dashboard
- **Description**: Secure backoffice area for operations.
- **Entry Route**: `/admin` & `/admin/dashboard`
- **Expected Flow**:
  1. Navigate to `/admin`.
  2. Enter admin credentials.
  3. On success, navigate to `/admin/dashboard`.
  4. See daily sales data and sync buttons.
  5. On failure, UI shows authentication error.
- **API Dependencies**: 
  - Local Auth / Session check.
  - `GET /api/orders`

---

## 5. Known Limitations / Out of Scope for Frontend Testing
- **Midtrans Popups**: In normal operations, Midtrans uses an iframe/popup (`window.snap.pay`). In standard TestSprite Frontend UI testing, mocking the success callback or redirect might be needed unless standard sandbox accounts are provisioned.
- **Olsera API Rate Limits**: E2E testing heavily fetching the live `GET /api/menu` might run into Olsera Open API limits. Fallback mock responses are recommended.
