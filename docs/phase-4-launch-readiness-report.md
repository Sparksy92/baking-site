# Cedar & Sage Homestead: Phase 4 Launch Readiness Report

This report documents the results of the Launch-Readiness Self-Service Acceptance Tests performed on the integrated Cedar & Sage Homestead commerce system.

---

## 📋 Self-Service Test Results

| # | Test Case / Scenario | Status | Details / Observations |
|---|---|---|---|
| 1 | **Log into admin** | **PASS** | Authenticated session successfully created via `/admin/login` using credentials. Redirects to panel. |
| 2 | **Change Cinnamon Rolls from quote_only to starting_at** | **PASS** | Changed Pricing Mode to `starting_at` in the Product Form editor. |
| 3 | **Change one option price** | **PASS** | Updated the "Dozen / Cream Cheese Icing" option price to `$28.00` in the option matrix builder. |
| 4 | **Save product** | **PASS** | Clicking save updates the record in PostgreSQL without errors. |
| 5 | **Reload admin edit page & confirm values persist** | **PASS** | Refreshed the editor view; settings load from database showing `starting_at` mode and the new `$28.00` price. |
| 6 | **View public product page & confirm price display updates** | **PASS** | Public product page at `/product/cinnamon-rolls` shows the correct option pricing and starting price. |
| 7 | **Mark Cheesecake as quote_only** | **PASS** | Configured `cheesecakes` with pricing mode `quote_only`, availability status `quote_only`, and `is_quote_only` flag checked. |
| 8 | **Confirm public product page shows request CTA, not checkout** | **PASS** | The "Add to Cart" button is replaced with the **Request Custom Quote** button pointing to `/custom-orders`. |
| 9 | **Attempt backend checkout for Cheesecake & confirm 400 rejection** | **PASS** | Server-side checkout endpoint `/api/checkout` blocks transaction and returns `400 Bad Request` with detail message: *contains items that cannot be checked out instantly.* |
| 10 | **Submit a public order request** | **PASS** | Submitted request for 1 batch of Sourdough, Cinnamon Rolls, and custom notes via `POST /api/order-requests`. Returns `201 Created`. |
| 11 | **Confirm request appears in admin** | **PASS** | Inbox dashboard at `/admin/order-requests` receives and displays the new request under the "New" tab with a notification badge on the sidebar. |
| 12 | **Change status to reviewed** | **PASS** | Opened details modal and updated status dropdown value to `reviewed`. |
| 13 | **Add admin notes** | **PASS** | Added note: *"Emailed customer on June 14th to confirm date and vanilla icing preference."* |
| 14 | **Save and refresh** | **PASS** | Modal successfully patches settings via `/api/admin/order-requests/{id}` and updates local state. |
| 15 | **Confirm notes and status persist** | **PASS** | Reloaded page; request displays under the "Reviewed" tab with the saved admin notes intact. |
| 16 | **Update pickup/payment instructions in settings** | **PASS** | Navigated to `/admin/settings`, updated instructions textareas, and saved. |
| 17 | **Confirm public page reflects the change** | **PASS** | The updated settings load dynamically on `/order-info` and `/faq` without requiring code builds. |
| 18 | **Confirm `/oven-fund` loads** | **PASS** | Oven Fund MVP page compiles and displays the goal progress bar and donation instructions. |
| 19 | **Confirm homepage category links work** | **PASS** | Diorama 3D objects and fallback cards correctly navigate to filtered shop routes (e.g. `/shop?category=baked-fresh`). |
| 20 | **Confirm mobile homepage works** | **PASS** | Verified that rotation swipes, bottom sheets, close buttons, and responsive layouts function on mobile viewports. |

---

## 🚀 Readiness Verdict
The Cedar & Sage Homestead platform is **Launch Ready** for the self-service storefront and administration panel. Kirstin has full capabilities to manage catalog items, toggle pricing and preorder flags, configure shop instructions, and process custom quotes without technical assistance.

---

## 🔧 Default Branch Status
The repository default branch has been successfully updated from `feature/cedar-sage-phase-1-plan` to `main`, and a `staging` branch has been created to act as the staging/deployment review branch before production.

