const STORAGE_KEY = "qr-cafe-demo-state-v1";
const ACCESS_CODES = { kitchen: "112233", admin: "009988", waiter: "123123" };
const STATUS_ORDER = [
  "NEW",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "COMPLETED",
  "CANCELLED",
];

const initialState = () => ({
  tables: [
    { id: "table-1", name: "Table 1", number: 1, active: true },
    { id: "table-2", name: "Table 2", number: 2, active: true },
    { id: "table-3", name: "Table 3", number: 3, active: true },
  ],
  categories: [
    { id: "cat-breakfast", name: "Breakfast" },
    { id: "cat-main", name: "Main Dishes" },
    { id: "cat-pizza", name: "Pizza" },
    { id: "cat-burgers", name: "Burgers" },
    { id: "cat-drinks", name: "Drinks" },
    { id: "cat-desserts", name: "Desserts" },
  ],
  menuItems: [
    {
      id: "item-burger",
      name: "Classic Burger",
      description: "Double beef, cheddar, pickles, and house sauce.",
      price: 13.5,
      categoryId: "cat-burgers",
      image:
        "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80",
      available: true,
    },
    {
      id: "item-fries",
      name: "French Fries",
      description: "Crisp fries with sea salt.",
      price: 4.5,
      categoryId: "cat-main",
      image:
        "https://images.unsplash.com/photo-1576107232684-2f9d0b5e1b2e?auto=format&fit=crop&w=900&q=80",
      available: true,
    },
    {
      id: "item-coke",
      name: "Coca Cola",
      description: "Chilled soft drink.",
      price: 2.5,
      categoryId: "cat-drinks",
      image:
        "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=900&q=80",
      available: true,
    },
    {
      id: "item-pizza",
      name: "Margherita Pizza",
      description: "Fresh tomatoes, mozzarella, and basil.",
      price: 16,
      categoryId: "cat-pizza",
      image:
        "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80",
      available: true,
    },
    {
      id: "item-latte",
      name: "Latte",
      description: "Velvety espresso with steamed milk.",
      price: 4.8,
      categoryId: "cat-breakfast",
      image:
        "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80",
      available: true,
    },
    {
      id: "item-cake",
      name: "Berry Cake",
      description: "Light sponge with vanilla cream.",
      price: 6.2,
      categoryId: "cat-desserts",
      image:
        "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=900&q=80",
      available: true,
    },
  ],
  orders: [],
  currentView: "customer",
  cart: [],
  waiterNotifications: [],
  selectedTableId: "table-1",
  currentOrderId: null,
  activeCategoryId: "cat-breakfast",
  editingTableId: null,
  editingMenuItemId: null,
  editingCategoryId: null,
  qrTableId: "table-1",
  qrSvg: "",
  customerName: "",
});

let state = loadState();
let broadcastChannel;
let toastTimer;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw);
    return { ...initialState(), ...parsed };
  } catch (error) {
    console.warn("Unable to load saved state", error);
    return initialState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (broadcastChannel) {
    broadcastChannel.postMessage({ type: "state-update", payload: state });
  }
}

function syncFromBroadcast(event) {
  if (event.data?.type === "state-update") {
    state = event.data.payload;
    render();
  }
}

function init() {
  if ("BroadcastChannel" in window) {
    broadcastChannel = new BroadcastChannel("qr-cafe-live");
    broadcastChannel.addEventListener("message", syncFromBroadcast);
  }
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY && event.newValue) {
      state = JSON.parse(event.newValue);
      render();
    }
  });
  applyTableFromUrl();
  document.querySelectorAll(".nav-pill").forEach((button) => {
    button.addEventListener("click", () => {
      setView(button.dataset.view);
    });
  });

  document.getElementById("tableSelect").addEventListener("change", (event) => {
    state.selectedTableId = event.target.value;
    state.currentView = "customer";
    saveState();
    render();
  });

  document
    .getElementById("tableForm")
    .addEventListener("submit", handleTableSubmit);
  document
    .getElementById("cancelTableEdit")
    .addEventListener("click", () => resetTableForm());
  document
    .getElementById("menuForm")
    .addEventListener("submit", handleMenuSubmit);
  document
    .getElementById("cancelMenuEdit")
    .addEventListener("click", () => resetMenuForm());
  document
    .getElementById("categoryForm")
    .addEventListener("submit", handleCategorySubmit);
  document
    .getElementById("cancelCategoryEdit")
    .addEventListener("click", () => resetCategoryForm());
  document.getElementById("generateQrBtn").addEventListener("click", () => {
    generateQrPreview();
  });
  document
    .getElementById("downloadSvgBtn")
    .addEventListener("click", downloadQrSvg);
  document
    .getElementById("downloadPngBtn")
    .addEventListener("click", downloadQrPng);
  document.getElementById("printQrBtn").addEventListener("click", printQrCode);

  render();
}

function render() {
  applyTableFromUrl();
  renderTableSelect();
  renderCategoryChips();
  renderMenuGrid();
  renderCart();
  renderKitchen();
  renderWaiter();
  renderAdmin();
  renderCustomerStatus();
  setView(state.currentView);
}

function applyTableFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const tableParam = params.get("table");
  if (!tableParam) return;

  const matchedTable = state.tables.find((table) => {
    return (
      table.id === tableParam ||
      String(table.number) === tableParam ||
      table.name.toLowerCase() === tableParam.toLowerCase()
    );
  });

  if (matchedTable) {
    state.selectedTableId = matchedTable.id;
    state.qrTableId = matchedTable.id;
  }
}

function setView(view) {
  if (view === "customer") {
    state.currentView = view;
    document.querySelectorAll(".view").forEach((section) => {
      section.classList.toggle("active", section.id === `${view}View`);
    });
    document.querySelectorAll(".nav-pill").forEach((pill) => {
      pill.classList.toggle("active", pill.dataset.view === view);
    });
    saveState();
    return;
  }

  if (view === "kitchen" || view === "admin" || view === "waiter") {
    const roleLabel =
      view === "waiter" ? "waiter" : view === "kitchen" ? "kitchen" : "admin";
    const accessCode = window.prompt(`Enter ${roleLabel} access code`);
    if (accessCode !== ACCESS_CODES[view]) {
      if (accessCode !== null) {
        showToast("Access denied. Please use the correct demo code.");
      }
      return;
    }
  }

  state.currentView = view;
  document.querySelectorAll(".view").forEach((section) => {
    section.classList.toggle("active", section.id === `${view}View`);
  });
  document.querySelectorAll(".nav-pill").forEach((pill) => {
    pill.classList.toggle("active", pill.dataset.view === view);
  });
  saveState();
}

function renderTableSelect() {
  const select = document.getElementById("tableSelect");
  const qrSelect = document.getElementById("qrTableSelect");
  const tables = state.tables.filter((table) => table.active);
  const options = tables
    .map(
      (table) =>
        `<option value="${table.id}" ${table.id === state.selectedTableId ? "selected" : ""}>${table.name}</option>`,
    )
    .join("");
  select.innerHTML = options || '<option value="">No active tables</option>';
  qrSelect.innerHTML = tables
    .map(
      (table) =>
        `<option value="${table.id}" ${table.id === state.qrTableId ? "selected" : ""}>${table.name}</option>`,
    )
    .join("");
  qrSelect.addEventListener("change", (event) => {
    state.qrTableId = event.target.value;
    saveState();
    generateQrPreview();
  });

  const selectedTable = state.tables.find(
    (table) => table.id === state.selectedTableId,
  );
  const summary = document.getElementById("tableSummary");
  if (selectedTable) {
    summary.innerHTML = `<strong>${selectedTable.name}</strong> · ${selectedTable.active ? "Available for ordering" : "Inactive"}`;
  } else {
    summary.textContent = "No active table selected.";
  }
}

function renderCategoryChips() {
  const container = document.getElementById("categoryChips");
  const categories = state.categories;
  container.innerHTML = categories
    .map(
      (category) =>
        `<button class="chip ${category.id === state.activeCategoryId ? "active" : ""}" data-category="${category.id}">${category.name}</button>`,
    )
    .join("");
  container.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      state.activeCategoryId = chip.dataset.category;
      saveState();
      renderMenuGrid();
      renderCategoryChips();
    });
  });
}

function renderMenuGrid() {
  const container = document.getElementById("menuGrid");
  const items = state.menuItems.filter(
    (item) => item.categoryId === state.activeCategoryId,
  );
  if (!items.length) {
    container.innerHTML =
      '<div class="empty-state">No menu items available in this category yet.</div>';
    return;
  }

  container.innerHTML = items
    .map(
      (item) => `
    <article class="menu-card">
      <img src="${item.image || "https://placehold.co/600x400?text=Cafe+Item"}" alt="${item.name}" />
      <div class="menu-meta">
        <h4>${item.name}</h4>
        <span class="price">$${Number(item.price).toFixed(2)}</span>
      </div>
      <p class="muted">${item.description}</p>
      <div class="menu-meta">
        <span class="badge ${item.available ? "success" : "warning"}">${item.available ? "Available" : "Unavailable"}</span>
        <button class="btn btn-primary" ${item.available ? "" : "disabled"} data-add-item="${item.id}">Add to cart</button>
      </div>
    </article>
  `,
    )
    .join("");

  container.querySelectorAll("[data-add-item]").forEach((button) => {
    button.addEventListener("click", () => addToCart(button.dataset.addItem));
  });
}

function renderCart() {
  const container = document.getElementById("cartItems");
  const checkout = document.getElementById("checkoutFormContainer");
  const items = state.cart;
  if (!items.length) {
    container.innerHTML =
      '<div class="empty-state">Your cart is empty. Start by adding a few items.</div>';
    checkout.innerHTML = "";
    return;
  }

  container.innerHTML = items
    .map((entry) => {
      const item = state.menuItems.find(
        (menuItem) => menuItem.id === entry.itemId,
      );
      if (!item) return "";
      return `
      <div class="cart-item">
        <div>
          <strong>${item.name}</strong>
          <div class="muted">$${Number(item.price).toFixed(2)} each</div>
        </div>
        <div class="qty-controls">
          <button class="qty-btn" data-decrease="${entry.itemId}">−</button>
          <span>${entry.quantity}</span>
          <button class="qty-btn" data-increase="${entry.itemId}">+</button>
          <button class="btn btn-danger" data-remove="${entry.itemId}">Remove</button>
        </div>
      </div>
    `;
    })
    .join("");

  container.querySelectorAll("[data-increase]").forEach((button) => {
    button.addEventListener("click", () =>
      updateCartQuantity(button.dataset.increase, 1),
    );
  });
  container.querySelectorAll("[data-decrease]").forEach((button) => {
    button.addEventListener("click", () =>
      updateCartQuantity(button.dataset.decrease, -1),
    );
  });
  container.querySelectorAll("[data-remove]").forEach((button) => {
    button.addEventListener("click", () =>
      removeFromCart(button.dataset.remove),
    );
  });

  const subtotal = items.reduce(
    (sum, entry) => sum + entry.quantity * getMenuPrice(entry.itemId),
    0,
  );
  checkout.innerHTML = `
    <div class="status-card">
      <label>
        Customer name
        <input id="customerName" value="${state.customerName}" placeholder="Enter your name" />
      </label>
      <div class="total-row">
        <span>Total</span>
        <span>$${subtotal.toFixed(2)}</span>
      </div>
      <button class="btn btn-primary" id="placeOrderBtn" style="width:100%;margin-top:0.5rem;">Place order</button>
    </div>
  `;
  document
    .getElementById("placeOrderBtn")
    .addEventListener("click", submitOrder);
}

function addToCart(itemId) {
  const existing = state.cart.find((entry) => entry.itemId === itemId);
  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.push({ itemId, quantity: 1 });
  }
  saveState();
  renderCart();
  showToast("Item added to your cart");
}

function updateCartQuantity(itemId, delta) {
  const entry = state.cart.find((item) => item.itemId === itemId);
  if (!entry) return;
  entry.quantity += delta;
  if (entry.quantity <= 0) {
    state.cart = state.cart.filter((item) => item.itemId !== itemId);
  }
  saveState();
  renderCart();
}

function removeFromCart(itemId) {
  state.cart = state.cart.filter((entry) => entry.itemId !== itemId);
  saveState();
  renderCart();
}

function submitOrder() {
  const customerName = document.getElementById("customerName").value.trim();
  if (!customerName) {
    showToast("Please enter your name before placing the order.");
    return;
  }
  if (!state.cart.length) {
    showToast("Your cart is empty.");
    return;
  }
  const selectedTable = state.tables.find(
    (table) => table.id === state.selectedTableId,
  );
  if (!selectedTable || !selectedTable.active) {
    showToast("This table is unavailable.");
    return;
  }

  const items = state.cart.map((entry) => {
    const menuItem = state.menuItems.find((item) => item.id === entry.itemId);
    return {
      id: `${entry.itemId}-${Date.now()}-${entry.quantity}`,
      menuItemId: entry.itemId,
      name: menuItem.name,
      quantity: entry.quantity,
      unitPrice: Number(menuItem.price),
    };
  });

  const order = {
    id: `ORD-${String(state.orders.length + 1001).padStart(4, "0")}`,
    tableId: selectedTable.id,
    tableNumber: selectedTable.number,
    customerName,
    items,
    total: items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    status: "NEW",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  state.orders.unshift(order);
  state.cart = [];
  state.customerName = customerName;
  state.currentOrderId = order.id;
  saveState();
  render();
  showToast(`Order ${order.id} sent to the kitchen.`);
}

function getMenuPrice(itemId) {
  const item = state.menuItems.find((menuItem) => menuItem.id === itemId);
  return item ? Number(item.price) : 0;
}

function renderCustomerStatus() {
  const container = document.getElementById("customerStatus");
  const currentOrder = state.orders.find(
    (order) => order.id === state.currentOrderId,
  );
  if (!currentOrder) {
    container.innerHTML = "";
    return;
  }

  const statusClass = currentOrder.status.toLowerCase();
  container.innerHTML = `
    <div class="status-card">
      <div class="inline-actions" style="margin-bottom:0.6rem;">
        <span class="status-badge ${statusClass}">${currentOrder.status}</span>
        <span class="pill">Order ${currentOrder.id}</span>
      </div>
      <p><strong>Table ${currentOrder.tableNumber}</strong> · ${currentOrder.customerName}</p>
      <p class="muted">Your order is now ${currentOrder.status.toLowerCase()}.</p>
    </div>
  `;
}

function renderKitchen() {
  const container = document.getElementById("kitchenBoard");
  const grouped = STATUS_ORDER.reduce((acc, status) => {
    acc[status] = state.orders.filter((order) => order.status === status);
    return acc;
  }, {});

  container.innerHTML = STATUS_ORDER.map(
    (status) => `
    <section class="kitchen-column">
      <h4>${status}</h4>
      ${
        grouped[status].length
          ? grouped[status]
              .map(
                (order) => `
        <article class="order-card-item">
          <div class="inline-actions" style="margin-bottom:0.4rem;">
            <span class="status-badge ${status.toLowerCase()}">${order.status}</span>
            <span class="pill">${order.id}</span>
          </div>
          <p><strong>Table ${order.tableNumber}</strong> · ${order.customerName}</p>
          <p class="muted">${formatTime(order.createdAt)}</p>
          <ul>
            ${order.items.map((entry) => `<li>${entry.quantity} × ${entry.name}</li>`).join("")}
          </ul>
          <p class="total-row">Total <span>$${order.total.toFixed(2)}</span></p>
          <div class="inline-actions" style="margin-top:0.6rem;">
            ${status === "NEW" ? `<button class="btn btn-primary" data-order-action="${order.id}" data-action="ACCEPTED">Accept Order</button>` : ""}
            ${status === "ACCEPTED" ? `<button class="btn btn-primary" data-order-action="${order.id}" data-action="PREPARING">Start Preparing</button>` : ""}
            ${status === "PREPARING" ? `<button class="btn btn-primary" data-order-action="${order.id}" data-action="READY">Mark Ready</button>` : ""}
            ${status === "READY" ? `<button class="btn btn-primary" data-order-action="${order.id}" data-action="COMPLETED">Complete Order</button>` : ""}
          </div>
        </article>
      `,
              )
              .join("")
          : '<div class="empty-state">No orders here.</div>'
      }
    </section>
  `,
  ).join("");

  container.querySelectorAll("[data-order-action]").forEach((button) => {
    button.addEventListener("click", () => {
      updateOrderStatus(button.dataset.orderAction, button.dataset.action);
    });
  });
}

function updateOrderStatus(orderId, status) {
  const order = state.orders.find((entry) => entry.id === orderId);
  if (!order) return;
  const previousStatus = order.status;
  order.status = status;
  order.updatedAt = new Date().toISOString();

  if (previousStatus !== "COMPLETED" && status === "COMPLETED") {
    state.waiterNotifications.unshift({
      id: `${order.id}-${Date.now()}`,
      orderId: order.id,
      tableNumber: order.tableNumber,
      customerName: order.customerName,
      items: order.items,
      total: order.total,
      message: `Deliver order ${order.id} to Table ${order.tableNumber}`,
      createdAt: new Date().toISOString(),
    });
  }

  saveState();
  render();
  showToast(`Order ${order.id} marked ${status}.`);
}

function renderWaiter() {
  const container = document.getElementById("waiterBoard");
  const notifications = state.waiterNotifications;

  if (!notifications.length) {
    container.innerHTML =
      '<div class="empty-state">No delivery requests yet.</div>';
    return;
  }

  container.innerHTML = notifications
    .map(
      (notification) => `
      <article class="order-card-item">
        <div class="inline-actions" style="margin-bottom:0.4rem;">
          <span class="status-badge ready">Ready</span>
          <span class="pill">${notification.orderId}</span>
        </div>
        <p><strong>Table ${notification.tableNumber}</strong> · ${notification.customerName}</p>
        <p class="muted">${formatTime(notification.createdAt)}</p>
        <p>${notification.message}</p>
        <ul>
          ${notification.items.map((entry) => `<li>${entry.quantity} × ${entry.name}</li>`).join("")}
        </ul>
        <p class="total-row">Total <span>$${notification.total.toFixed(2)}</span></p>
        <button class="btn btn-primary" data-deliver="${notification.id}">Mark Delivered</button>
      </article>
    `,
    )
    .join("");

  container.querySelectorAll("[data-deliver]").forEach((button) => {
    button.addEventListener("click", () =>
      removeWaiterNotification(button.dataset.deliver),
    );
  });
}

function removeWaiterNotification(notificationId) {
  state.waiterNotifications = state.waiterNotifications.filter(
    (entry) => entry.id !== notificationId,
  );
  saveState();
  renderWaiter();
  showToast("Delivery request cleared.");
}

function renderAdmin() {
  renderTableList();
  renderCategoryList();
  renderMenuAdminList();
  renderMenuCategoryOptions();
  renderQrTableSelect();
}

function renderTableList() {
  const container = document.getElementById("tableList");
  container.innerHTML = state.tables
    .map(
      (table) => `
    <div class="table-row">
      <div class="menu-meta">
        <strong>${table.name}</strong>
        <span class="badge ${table.active ? "success" : "warning"}">${table.active ? "Active" : "Inactive"}</span>
      </div>
      <p class="muted">Number ${table.number}</p>
      <div class="inline-actions" style="margin-top:0.6rem;">
        <button class="btn btn-secondary" data-edit-table="${table.id}">Edit</button>
        <button class="btn btn-danger" data-delete-table="${table.id}">Delete</button>
      </div>
    </div>
  `,
    )
    .join("");

  container.querySelectorAll("[data-edit-table]").forEach((button) => {
    button.addEventListener("click", () => editTable(button.dataset.editTable));
  });
  container.querySelectorAll("[data-delete-table]").forEach((button) => {
    button.addEventListener("click", () =>
      deleteTable(button.dataset.deleteTable),
    );
  });
}

function handleTableSubmit(event) {
  event.preventDefault();
  const id = document.getElementById("tableId").value;
  const table = {
    id: id || `table-${Date.now()}`,
    name: document.getElementById("tableName").value.trim(),
    number: Number(document.getElementById("tableNumber").value),
    active: document.getElementById("tableActive").checked,
  };
  if (!table.name || !table.number) return;
  if (id) {
    const existing = state.tables.find((entry) => entry.id === id);
    Object.assign(existing, table);
  } else {
    state.tables.push(table);
  }
  state.editingTableId = null;
  saveState();
  render();
  resetTableForm();
  showToast("Table saved.");
}

function editTable(tableId) {
  const table = state.tables.find((entry) => entry.id === tableId);
  if (!table) return;
  document.getElementById("tableId").value = table.id;
  document.getElementById("tableName").value = table.name;
  document.getElementById("tableNumber").value = table.number;
  document.getElementById("tableActive").checked = table.active;
  state.editingTableId = table.id;
}

function deleteTable(tableId) {
  state.tables = state.tables.filter((table) => table.id !== tableId);
  if (state.selectedTableId === tableId) {
    state.selectedTableId = state.tables[0]?.id || null;
  }
  if (state.qrTableId === tableId) {
    state.qrTableId = state.tables[0]?.id || null;
  }
  saveState();
  render();
  showToast("Table removed.");
}

function resetTableForm() {
  document.getElementById("tableForm").reset();
  document.getElementById("tableId").value = "";
  document.getElementById("tableActive").checked = true;
  state.editingTableId = null;
}

function renderCategoryList() {
  const container = document.getElementById("categoryList");
  container.innerHTML = state.categories
    .map(
      (category) => `
    <div class="category-row">
      <div class="menu-meta">
        <strong>${category.name}</strong>
      </div>
      <div class="inline-actions" style="margin-top:0.6rem;">
        <button class="btn btn-secondary" data-edit-category="${category.id}">Edit</button>
        <button class="btn btn-danger" data-delete-category="${category.id}">Delete</button>
      </div>
    </div>
  `,
    )
    .join("");

  container.querySelectorAll("[data-edit-category]").forEach((button) => {
    button.addEventListener("click", () =>
      editCategory(button.dataset.editCategory),
    );
  });
  container.querySelectorAll("[data-delete-category]").forEach((button) => {
    button.addEventListener("click", () =>
      deleteCategory(button.dataset.deleteCategory),
    );
  });
}

function handleCategorySubmit(event) {
  event.preventDefault();
  const categoryId = document.getElementById("categoryId").value;
  const name = document.getElementById("categoryName").value.trim();
  if (!name) return;
  if (categoryId) {
    const category = state.categories.find((entry) => entry.id === categoryId);
    category.name = name;
  } else {
    state.categories.push({ id: `cat-${Date.now()}`, name });
  }
  saveState();
  render();
  resetCategoryForm();
  showToast("Category saved.");
}

function editCategory(categoryId) {
  const category = state.categories.find((entry) => entry.id === categoryId);
  if (!category) return;
  document.getElementById("categoryId").value = category.id;
  document.getElementById("categoryName").value = category.name;
}

function deleteCategory(categoryId) {
  state.categories = state.categories.filter(
    (category) => category.id !== categoryId,
  );
  state.menuItems = state.menuItems.filter(
    (item) => item.categoryId !== categoryId,
  );
  saveState();
  render();
  showToast("Category removed.");
}

function resetCategoryForm() {
  document.getElementById("categoryForm").reset();
  document.getElementById("categoryId").value = "";
}

function renderMenuAdminList() {
  const container = document.getElementById("menuAdminList");
  container.innerHTML = state.menuItems
    .map(
      (item) => `
    <div class="table-row">
      <div class="menu-meta">
        <strong>${item.name}</strong>
        <span class="badge ${item.available ? "success" : "warning"}">${item.available ? "Available" : "Unavailable"}</span>
      </div>
      <p class="muted">${getCategoryName(item.categoryId)} · $${Number(item.price).toFixed(2)}</p>
      <div class="inline-actions" style="margin-top:0.6rem;">
        <button class="btn btn-secondary" data-edit-menu="${item.id}">Edit</button>
        <button class="btn btn-danger" data-delete-menu="${item.id}">Delete</button>
      </div>
    </div>
  `,
    )
    .join("");

  container.querySelectorAll("[data-edit-menu]").forEach((button) => {
    button.addEventListener("click", () =>
      editMenuItem(button.dataset.editMenu),
    );
  });
  container.querySelectorAll("[data-delete-menu]").forEach((button) => {
    button.addEventListener("click", () =>
      deleteMenuItem(button.dataset.deleteMenu),
    );
  });
}

function renderMenuCategoryOptions() {
  const select = document.getElementById("menuCategory");
  select.innerHTML = state.categories
    .map(
      (category) => `<option value="${category.id}">${category.name}</option>`,
    )
    .join("");
}

function handleMenuSubmit(event) {
  event.preventDefault();
  const menuItemId = document.getElementById("menuItemId").value;
  const item = {
    id: menuItemId || `item-${Date.now()}`,
    name: document.getElementById("menuName").value.trim(),
    description: document.getElementById("menuDescription").value.trim(),
    price: Number(document.getElementById("menuPrice").value),
    categoryId: document.getElementById("menuCategory").value,
    image:
      document.getElementById("menuImage").value.trim() ||
      "https://placehold.co/600x400?text=Menu+Item",
    available: document.getElementById("menuAvailable").checked,
  };
  if (!item.name || !item.categoryId) return;
  if (menuItemId) {
    const existing = state.menuItems.find((entry) => entry.id === menuItemId);
    Object.assign(existing, item);
  } else {
    state.menuItems.push(item);
  }
  saveState();
  render();
  resetMenuForm();
  showToast("Menu item saved.");
}

function editMenuItem(itemId) {
  const item = state.menuItems.find((entry) => entry.id === itemId);
  if (!item) return;
  document.getElementById("menuItemId").value = item.id;
  document.getElementById("menuName").value = item.name;
  document.getElementById("menuDescription").value = item.description;
  document.getElementById("menuPrice").value = item.price;
  document.getElementById("menuCategory").value = item.categoryId;
  document.getElementById("menuImage").value = item.image;
  document.getElementById("menuAvailable").checked = item.available;
}

function deleteMenuItem(itemId) {
  state.menuItems = state.menuItems.filter((item) => item.id !== itemId);
  saveState();
  render();
  showToast("Menu item removed.");
}

function resetMenuForm() {
  document.getElementById("menuForm").reset();
  document.getElementById("menuItemId").value = "";
  document.getElementById("menuAvailable").checked = true;
}

function getCategoryName(categoryId) {
  return (
    state.categories.find((category) => category.id === categoryId)?.name ||
    "Uncategorized"
  );
}

function renderQrTableSelect() {
  const select = document.getElementById("qrTableSelect");
  select.innerHTML = state.tables
    .map(
      (table) =>
        `<option value="${table.id}" ${table.id === state.qrTableId ? "selected" : ""}>${table.name}</option>`,
    )
    .join("");
}

async function generateQrPreview() {
  const selectedTable = state.tables.find(
    (table) => table.id === state.qrTableId,
  );
  if (!selectedTable) return "";

  const payloadUrl = `${window.location.origin}${window.location.pathname}?table=${encodeURIComponent(selectedTable.id)}`;

  try {
    const svgMarkup = await createQrSvg(payloadUrl, selectedTable.name);
    state.qrSvg = svgMarkup;
    document.getElementById("qrPreview").innerHTML = `
      <div>
        ${svgMarkup}
        <div class="qr-label">Scan to open the customer ordering page for ${selectedTable.name}</div>
      </div>
    `;
    return svgMarkup;
  } catch (error) {
    console.warn("QR generation failed", error);
    const fallback = `<div class="empty-state">QR generator unavailable. Please refresh and try again.</div>`;
    document.getElementById("qrPreview").innerHTML = fallback;
    return "";
  }
}

async function createQrSvg(payloadUrl, label) {
  if (!window.QRCode) {
    throw new Error("QRCode library not available");
  }

  const svgMarkup = await window.QRCode.toString(payloadUrl, {
    type: "svg",
    width: 260,
    margin: 2,
    color: { dark: "#111827", light: "#ffffff" },
  });

  return `
    <div style="display:grid;gap:0.4rem;justify-items:center;">
      ${svgMarkup}
      <div style="font-size:0.9rem;color:#64748b;text-align:center;">${label}</div>
    </div>
  `;
}

async function downloadQrSvg() {
  const svgMarkup = state.qrSvg || (await generateQrPreview());
  const blob = new Blob([svgMarkup], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `table-qr-${state.qrTableId}.svg`;
  link.click();
  URL.revokeObjectURL(url);
}

async function downloadQrPng() {
  const selectedTable = state.tables.find(
    (table) => table.id === state.qrTableId,
  );
  const payloadUrl = `${window.location.origin}${window.location.pathname}?table=${encodeURIComponent(selectedTable?.id || state.qrTableId)}`;
  const dataUrl = await window.QRCode.toDataURL(payloadUrl, {
    width: 800,
    margin: 2,
    color: { dark: "#111827", light: "#ffffff" },
  });
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `table-qr-${state.qrTableId}.png`;
  link.click();
}

async function printQrCode() {
  const selectedTable = state.tables.find(
    (table) => table.id === state.qrTableId,
  );
  const printWindow = window.open("", "_blank", "width=700,height=900");
  if (!printWindow) return;
  const qrMarkup = state.qrSvg || (await generateQrPreview());
  printWindow.document.write(`
    <html>
      <head><title>QR Code ${selectedTable?.name || ""}</title></head>
      <body style="font-family:Arial,sans-serif;text-align:center;padding:2rem;">
        <h2>North Star Cafe</h2>
        <h3>${selectedTable?.name || "Table"}</h3>
        <p>Scan to order</p>
        <div>${qrMarkup}</div>
        <p>Scan this code to view our menu and place your order.</p>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function formatTime(isoString) {
  return new Date(isoString).toLocaleString([], {
    hour: "numeric",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  });
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

document.addEventListener("DOMContentLoaded", init);
