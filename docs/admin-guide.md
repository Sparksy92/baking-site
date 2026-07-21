# our baker's Admin Guide: The Artisan Bakery

Welcome to your The Artisan Bakery admin dashboard! This guide will help you manage your products, pricing, availability, storefront settings, and customer order requests. No code, developer tools, or technical command-line actions are needed for any of these daily tasks.

---

## 🔐 Logging In
1. Navigate to your website's admin login page (e.g., `/admin/login`).
2. Enter your administrator **Username** and **Password**.
3. Click **Login**. You will be redirected to the Admin Dashboard.

---

## 🏷️ Changing a Price
Prices are managed per product option (batch size or flavor variant):
1. In the sidebar menu, click **Products**.
2. Find the product you want to edit and click on its name to open the editor.
3. Scroll down to the **Options (Variants)** section.
4. Locate the specific option (e.g., "Standard", "Dozen") and enter the new price in the **Price** field (in CAD).
5. Scroll to the top or bottom of the page and click **Save**.

---

## 🍞 Adding a Menu Item
To add a new product or baking selection:
1. Navigate to **Products** in the sidebar.
2. Click the **New Product** button in the top right.
3. Fill in the product details:
   - **Name**: The display title (e.g., *Cinnamon Rolls*).
   - **Description**: Describe your fresh-baked goods, including flavor details and standard package sizes.
   - **Category**: Select the section where this item belongs (e.g., *Baked Fresh*, *Desserts*, *Pantry*, *Home & Body*).
4. Under the new **Homestead & Baking Settings** section, configure the following:
   - **Pricing Mode**: Choose how price displays:
     - `fixed`: Displays a normal set price.
     - `starting_at`: Displays as "Starting at $X.XX" (useful for items with varying customization prices).
     - `quote_only`: Displays "Price to be confirmed" and redirects customers to request a quote.
     - `seasonal`: Displays as "Seasonal" and disables direct checkouts.
     - `unavailable`: Shows the item as unavailable for immediate ordering.
   - **Availability Status**: Sets status in the shop (`available`, `sold_out`, `preorder_only`, `weekend_only`, `seasonal`, `quote_only`, `unavailable`, `hidden`).
   - **Lead Time Days**: Enter how many days in advance you need to prepare the item (e.g., `2` for Sourdough).
   - **Special Flags**: Check `Preorder Only`, `Weekend Only`, or `Quote Only` if those apply.
   - **Allergy Notes**: Add any notes about allergens (e.g., *Contains gluten/dairy*).
   - **Pickup/Delivery Notes**: Add specific pickup requirements for this product.
5. Create at least one option under the **Options Matrix Builder** (e.g., Batch Size "Dozen", Flavour "Original") and set its price.
6. Click **Save Product**.

---

## 🚫 Hiding an Unavailable or Sold-Out Item
If you are temporarily out of an item or want to hide it completely:
1. Open the product in the **Products** editor.
2. In the **Homestead & Baking Settings** section:
   - To show it as sold out: Set **Availability Status** to `sold_out`. Customers will see a "Sold Out" badge and won't be able to buy it instantly.
   - To hide it completely from the public store: Set **Availability Status** to `hidden` (or uncheck the main **Active** checkbox).
3. Click **Save**.

---

## 📅 Marking an Item as Preorder-Only
Sourdough and special orders require advance notice:
1. Open the product editor.
2. In the **Homestead & Baking Settings** section:
   - Check the **Preorder Only** checkbox.
   - Set the **Availability Status** to `preorder_only`.
   - Enter the minimum **Lead Time Days** (e.g., `3` days).
3. In your product description, mention when preorder pickup days are.
4. Click **Save**.

---

## 💬 Marking an Item as Quote-Only
For custom desserts, large event orders, or pricing that requires alignment:
1. Open the product editor.
2. In the **Homestead & Baking Settings** section:
   - Check the **Quote Only** checkbox.
   - Set **Pricing Mode** to `quote_only`.
   - Set **Availability Status` to `quote_only`.
3. In the option section, you can set the base price to `0.00` (it will display as "Price to be confirmed").
4. Click **Save**.
5. **How it works for customers**: The "Add to Cart" button will disappear for this product. Instead, they will see a **Request Custom Quote** button that guides them to submit an order request form.

---

## 📸 Uploading Product Photos
1. Open the product editor.
2. Scroll to the **Images** section.
3. Click **Upload Image** or drag and drop your photo.
4. Set the primary image by checking the **Primary** radio option.
5. Click **Save**.

---

## 📝 Updating Pickup, Payment, & Allergy Settings
To update the instructions customers see during ordering:
1. Go to **Settings** in the sidebar.
2. Scroll down to the **Homestead Settings** section.
3. Edit the content in the respective text areas:
   - **About Content**: The story behind The Artisan Bakery.
   - **FAQ Content**: Answers to common baking questions, delivery details, etc.
   - **Pickup Instructions**: Where and when customers can pick up sourdough and baked goods.
   - **Payment Instructions**: E-transfer email details (e.g., where to send payments) or cash-on-pickup terms.
   - **Allergy Disclaimer**: General notice about cross-contamination risk or facility certifications.
   - **Preorder Instructions**: Information on how your weekly preordering schedule works.
4. Click **Save Settings** at the bottom.

---

## 📥 Viewing and Managing Order Requests
When a customer requests custom orders, preorders, or quote-only items, it lands in your inbox:
1. Click **Order Requests** in the sidebar.
2. You will see a list of requests sorted with the newest ones first. New submissions will have a pink badge indicating a `new` status.
3. Use the filter tabs at the top (`New`, `Reviewed`, `Waiting`, `Confirmed`, `Completed`, `Cancelled`) or search bar to find a request.
4. Click on a request row to open the details modal. Here you can view:
   - Customer name, email, phone, and preferred contact method.
   - Requested items list (with quantities, selected options, and customer notes per item).
   - Desired pickup/delivery date and allergy notices.
5. Under **Admin Notes**, write down notes (e.g., "Quoted $45 via email on June 14th").
6. Update the **Status** dropdown as you progress:
   - `new`: Unreviewed request.
   - `reviewed`: You have read the request.
   - `waiting_on_customer`: You have reached out with a quote/questions and are waiting for their reply.
   - `confirmed`: Order is confirmed and scheduled for baking!
   - `completed`: Sourdough/baked goods have been picked up/delivered.
   - `cancelled`: Customer cancelled or request was rejected.
7. Click **Save Changes** in the modal.

---

## ⚠️ What Not To Touch
- Do not modify keys in the **Advanced Webhooks** or **Staff** settings unless you are setting up new admin accounts.
- Do not delete categories that currently have products associated with them, as it may cause them to display uncategorized.

---

## 📞 When to Ask Support for Help
- If customers report stripe payments are not completing or webhook integration fails.
- If you need custom email template layouts modified.
- If you want to configure automated SMS notifications.

---

*(Screenshots to be added after final admin styling is complete)*
