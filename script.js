// ДАННЫЕ КАТАЛОГА 
const brandCatalog = {
    'HAIR SEKTA': { categories: [{ id: 'all', label: 'Все товары' }, { id: 'new', label: 'Новинки' }], products: [] },
    'IMPRESSION PROFESSIONAL': { categories: [{ id: 'all', label: 'Все товары' }, { id: 'new', label: 'Новинки' }], products: [] },
    'MALECULA': { categories: [{ id: 'all', label: 'Все товары' }, { id: 'new', label: 'Новинки' }], products: [] },
    'ЧИСТОВЬЕ': { categories: [{ id: 'all', label: 'Все товары' }, { id: 'new', label: 'Новинки' }], products: [] }
};

const STORAGE_KEY = 'vitbeauty_products';
const CATEGORIES_KEY = 'vitbeauty_categories_v2';
const CART_KEY = 'vitbeauty_cart';
const ORDERS_KEY = 'vitbeauty_orders_history';
const ORDERS_PANEL_KEY = 'vitbeauty_orders_v2';
const NOTIFICATIONS_KEY = 'vitbeauty_notifications';
const DATA_VERSION = '3.2';

let cart = JSON.parse(localStorage.getItem(CART_KEY)) || [];
let activeBrand = null;
let currentCategory = 'all';
let currentModalProduct = null;

// ========== УВЕДОМЛЕНИЯ ==========
function getNotifications() {
    try { return JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || '[]'); }
    catch(e) { return []; }
}
function saveNotifications(notifs) { localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifs)); }
function addNotification(text, type) {
    const notifs = getNotifications();
    notifs.unshift({ id: Date.now().toString(), text: text, type: type || 'info', date: new Date().toLocaleString('ru-RU'), read: false });
    saveNotifications(notifs);
    updateNotifCount();
}
function updateNotifCount() {
    const notifs = getNotifications();
    const unread = notifs.filter(function(n) { return !n.read; }).length;
    const countEl = document.getElementById('notifCountHeader');
    if (countEl) {
        if (unread > 0) { countEl.textContent = unread; countEl.style.display = 'flex'; }
        else { countEl.style.display = 'none'; }
    }
}
function toggleNotifications() {
    const panel = document.getElementById('notifPanel');
    const overlay = document.getElementById('notifOverlay');
    if (!panel || !overlay) return;
    panel.classList.toggle('open');
    overlay.classList.toggle('active');
    if (panel.classList.contains('open')) renderNotifications();
}
function renderNotifications() {
    const container = document.getElementById('notifItemsList');
    if (!container) return;
    const notifs = getNotifications();
    if (!notifs.length) { container.innerHTML = '<p class="cart-empty">Уведомлений нет</p>'; return; }
    container.innerHTML = notifs.map(function(n) {
        const icon = n.type === 'order' ? '📝' : n.type === 'delivery' ? '🚚' : n.type === 'done' ? '✅' : n.type === 'cancel' ? '❌' : '🔔';
        return '<div class="notification-item ' + (n.read ? '' : 'unread') + '">' +
            '<div class="notif-icon">' + icon + '</div>' +
            '<div class="notif-content">' +
            '<div class="notif-text">' + n.text + '</div>' +
            '<div class="notif-date">' + n.date + '</div></div>' +
            '<div class="notif-actions">' +
            (!n.read ? '<button class="notif-btn" onclick="markNotifRead(\'' + n.id + '\')" title="Прочитано">✓</button>' : '') +
            '<button class="notif-btn delete" onclick="deleteNotif(\'' + n.id + '\')" title="Удалить">✕</button>' +
            '</div></div>';
    }).join('');
    updateNotifCount();
}
function markNotifRead(id) {
    const notifs = getNotifications();
    const n = notifs.find(function(x) { return x.id === id; });
    if (n) { n.read = true; saveNotifications(notifs); renderNotifications(); }
}
function deleteNotif(id) {
    let notifs = getNotifications();
    notifs = notifs.filter(function(x) { return x.id !== id; });
    saveNotifications(notifs);
    renderNotifications();
}
function loadNotificationsFromServer() {
    fetch('https://vitbeauty-server.onrender.com/notifications')
        .then(function(r) { return r.json(); })
        .then(function(serverNotifs) {
            if (serverNotifs && serverNotifs.length) {
                const localNotifs = getNotifications();
                serverNotifs.forEach(function(sn) {
                    const exists = localNotifs.find(function(ln) { return ln.id === sn.id; });
                    if (!exists) localNotifs.unshift(sn);
                });
                saveNotifications(localNotifs);
                updateNotifCount();
            }
        })
        .catch(function() {});
}

// ========== КОРЗИНА ==========
function saveCart() { localStorage.setItem(CART_KEY, JSON.stringify(cart)); updateCartUI(); }
function addToCart(productName, price, img, brand) {
    const existing = cart.find(function(item) { return item.name === productName && item.brand === brand; });
    if (existing) existing.qty++;
    else cart.push({ name: productName, price: price, img: img, brand: brand, qty: 1 });
    saveCart();
    showToast('✅ Добавлено в корзину');
}
function addToCartFromModal() {
    if (currentModalProduct) {
        addToCart(currentModalProduct.name, document.getElementById('modalProductPrice').textContent, document.getElementById('modalProductImg').src, currentModalProduct.brand);
        closeModal();
    }
}
function removeFromCart(index) { cart.splice(index, 1); saveCart(); }
function changeQty(index, delta) {
    cart[index].qty += delta;
    if (cart[index].qty <= 0) cart.splice(index, 1);
    saveCart();
}
function getCartTotal() {
    let total = 0;
    cart.forEach(function(item) {
        const cp = item.price.replace(/[^0-9,.]/g, '').replace(',', '.');
        total += (parseFloat(cp) || 0) * item.qty;
    });
    return Math.round(total * 100) / 100;
}
function updateCartUI() {
    const count = cart.reduce(function(s, i) { return s + i.qty; }, 0);
    const countEl = document.getElementById('cartCount');
    if (countEl) countEl.textContent = count;
    const itemsContainer = document.getElementById('cartItems');
    const footerEl = document.getElementById('cartFooter');
    if (cart.length === 0) {
        itemsContainer.innerHTML = '<p class="cart-empty">Корзина пуста</p>';
        footerEl.style.display = 'none';
    } else {
        itemsContainer.innerHTML = cart.map(function(item, i) {
            return '<div class="cart-item">' +
                '<img src="' + item.img + '" onerror="this.src=\'https://i.ibb.co/p7YgvT8/images.jpg\'">' +
                '<div class="cart-item-info"><div class="cart-item-name">' + item.name + '</div>' +
                '<div class="cart-item-price">' + item.price + '</div></div>' +
                '<div class="cart-item-qty">' +
                '<button onclick="changeQty(' + i + ',-1)">−</button>' +
                '<span>' + item.qty + '</span>' +
                '<button onclick="changeQty(' + i + ',1)">+</button></div>' +
                '<button class="cart-item-remove" onclick="removeFromCart(' + i + ')">🗑️</button></div>';
        }).join('');
        footerEl.style.display = 'block';
        document.getElementById('cartTotal').textContent = getCartTotal().toFixed(2) + ' BYN';
    }
}
function toggleCart() {
    document.getElementById('cartPanel').classList.toggle('open');
    document.getElementById('cartOverlay').classList.toggle('active');
}
function switchCartTab(tabName) {
    document.getElementById('tabCart').classList.toggle('active', tabName === 'cart');
    document.getElementById('tabOrders').classList.toggle('active', tabName === 'orders');
    document.getElementById('cartItems').style.display = tabName === 'cart' ? 'block' : 'none';
    document.getElementById('ordersList').style.display = tabName === 'orders' ? 'block' : 'none';
    document.getElementById('cartFooter').style.display = tabName === 'cart' && cart.length > 0 ? 'block' : 'none';
    if (tabName === 'orders') renderOrders();
}
function renderOrders() {
    const container = document.getElementById('ordersList');
    fetch('https://vitbeauty-server.onrender.com/orders')
        .then(function(r) { return r.json(); })
        .then(function(serverOrders) {
            const localOrders = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]');
            if (serverOrders && serverOrders.length) {
                serverOrders.forEach(function(so) {
                    const local = localOrders.find(function(lo) { return lo.number === so.number; });
                    if (local && local.status !== so.status) {
                        const statusMsgs = {
                            accepted: '📦 Ваш заказ #' + so.number + ' принят!',
                            delivery: '🚚 Ваш заказ #' + so.number + ' передан в доставку!',
                            done: '✅ Ваш заказ #' + so.number + ' завершён!',
                            cancel: '❌ Ваш заказ #' + so.number + ' отменён'
                        };
                        if (statusMsgs[so.status]) addNotification(statusMsgs[so.status], so.status);
                        local.status = so.status;
                    }
                });
                localStorage.setItem(ORDERS_KEY, JSON.stringify(localOrders));
            }
            showClientOrders(container, localOrders);
        })
        .catch(function() {
            const localOrders = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]');
            showClientOrders(container, localOrders);
        });
}
function showClientOrders(container, orders) {
    const statusNames = {
        new: '📝 Оформлен', accepted: '✅ Принят', processing: '⏳ В обработке',
        calling: '📞 Скоро позвоним', delivery: '🚚 В доставке',
        done: '✅ Завершён', cancel: '❌ Отменён'
    };
    if (orders.length) {
        container.innerHTML = orders.reverse().map(function(o) {
            const canDelete = (o.status === 'done' || o.status === 'cancel');
            const deleteBtn = canDelete ? '<button class="order-delete-btn" onclick="deleteClientOrder(\'' + o.number + '\')" title="Удалить заказ">✕</button>' : '';
            return '<div class="order-card" style="position:relative;">' + deleteBtn +
                '<div class="order-card-header"><span class="order-number">#' + o.number + '</span>' +
                '<span class="order-date">' + o.date + '</span></div>' +
                '<div class="order-items">' + o.items + '</div>' +
                '<div class="order-total">' + o.total + ' BYN</div>' +
                '<div class="order-contact">👤 ' + o.name + ' | 📞 ' + o.phone + '</div>' +
                '<div style="margin-top:6px;"><span class="order-status ' + o.status + '">' + (statusNames[o.status] || 'В обработке') + '</span></div></div>';
        }).join('');
    } else {
        container.innerHTML = '<p class="cart-empty">Заказов пока нет</p>';
    }
}
function deleteClientOrder(orderNumber) {
    if (!confirm('Удалить заказ #' + orderNumber + '?')) return;
    let orders = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]');
    orders = orders.filter(function(o) { return o.number !== orderNumber; });
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    renderOrders();
    showToast('🗑️ Заказ удалён');
}
function saveOrderToHistory(name, phone, items, total, orderNumber) {
    const orders = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]');
    orders.push({ number: orderNumber, date: new Date().toLocaleString('ru-RU'), name: name, phone: phone, items: items, total: total, status: 'new' });
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}
function saveOrderToPanel(name, phone, inst, items, total, orderNumber) {
    const panelOrders = JSON.parse(localStorage.getItem(ORDERS_PANEL_KEY) || '[]');
    panelOrders.unshift({ id: Date.now().toString(), number: orderNumber, name: name, phone: phone, inst: inst || 'НЕТ', items: items, total: total, date: new Date().toLocaleString('ru-RU'), status: 'new', starred: false, employee: null });
    localStorage.setItem(ORDERS_PANEL_KEY, JSON.stringify(panelOrders));
}
function openCheckoutForm() {
    toggleCart();
    const summary = cart.map(function(item) {
        const cp = item.price.replace(/[^0-9,.]/g, '').replace(',', '.');
        return '• ' + item.name + ' ×' + item.qty + ' — ' + ((parseFloat(cp) || 0) * item.qty).toFixed(2) + ' BYN';
    }).join('<br>');
    document.getElementById('checkoutSummary').innerHTML =
        '<div style="color:#f5f0eb;font-size:14px;margin-bottom:8px;"><b>Ваш заказ:</b></div>' +
        '<div style="color:#aaa;font-size:13px;line-height:1.6;">' + summary + '</div>' +
        '<div style="color:#dbb98c;font-size:16px;font-weight:700;margin-top:8px;">Итого: ' + getCartTotal().toFixed(2) + ' BYN</div>';
    document.getElementById('checkoutModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}
function closeCheckout() {
    document.getElementById('checkoutModal').classList.remove('active');
    document.body.style.overflow = '';
}
async function submitCheckout() {
    const name = document.getElementById('checkoutName').value.trim();
    const phone = document.getElementById('checkoutPhone').value.trim();
    const inst = document.getElementById('checkoutInst').value.trim();
    if (!name) return showToast('⚠️ Введите ФИО');
    if (!phone) return showToast('⚠️ Введите телефон');
    if (cart.length === 0) return showToast('⚠️ Корзина пуста');

    const orderNumber = 'VT' + Date.now().toString().slice(-6);
    const total = getCartTotal().toFixed(2);
    const items = cart.map(function(item) { return '• ' + item.name + ' ×' + item.qty; }).join(', ');
    const itemsTelegram = cart.map(function(item) {
        const cp = item.price.replace(/[^0-9,.]/g, '').replace(',', '.');
        return '• ' + item.name + ' ×' + item.qty + ' — ' + ((parseFloat(cp) || 0) * item.qty).toFixed(2) + ' BYN';
    }).join('\n');

    closeCheckout();
    showOrderStatus(name, phone, orderNumber);
    saveOrderToHistory(name, phone, items, total, orderNumber);
    saveOrderToPanel(name, phone, inst, items, total, orderNumber);
    addNotification('📝 Ваш заказ #' + orderNumber + ' оформлен!', 'order');

    try {
        await fetch('https://vitbeauty-server.onrender.com/order', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: Date.now().toString(), number: orderNumber, name: name, phone: phone, inst: inst || 'НЕТ', items: items, total: total, date: new Date().toLocaleString('ru-RU'), status: 'new', starred: false, employee: null })
        });
    } catch(e) { console.log('❌ Ошибка отправки на сервер:', e); }

    let message = '🛍️ <b>НОВЫЙ ЗАКАЗ #' + orderNumber + '</b>\n\n';
    message += '👤 <b>Клиент:</b> ' + name + '\n';
    message += '📞 <b>Телефон:</b> ' + phone + '\n';
    if (inst) message += '📷 <b>Instagram:</b> ' + inst + '\n';
    message += '\n📦 <b>Товары:</b>\n' + itemsTelegram + '\n\n';
    message += '💰 <b>Итого:</b> ' + total + ' BYN\n';
    message += '🕐 <b>Время:</b> ' + new Date().toLocaleString('ru-RU');
    message += '\n\n🔗 <b>Управление заказом:</b>\nhttps://dieveto.github.io/vitbeauty/orders.html\n';
    message += '🔑 <b>PIN:</b> 6202';

    const BOT_TOKEN = '8087505808:AAHo4lLMNffdqNIHzpRcpt7OojwpGpXAMrI';
    const CHAT_ID = '7365893074';
    try {
        await fetch('https://api.telegram.org/bot' + BOT_TOKEN + '/sendMessage', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: CHAT_ID, text: message, parse_mode: 'HTML' })
        });
    } catch(e) { console.log('Ошибка Telegram:', e); }

    cart = [];
    saveCart();
}
function showOrderStatus(name, phone, orderNumber) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:100002;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML =
        '<div style="background:#1a1410;border-radius:24px;padding:35px 30px;max-width:480px;width:95%;text-align:center;border:1px solid rgba(200,168,122,0.3);">' +
        '<div style="font-size:50px;margin-bottom:15px;">✅</div>' +
        '<h2 style="color:#c8a87a;font-size:22px;margin-bottom:8px;">Заказ оформлен!</h2>' +
        '<p style="color:#888;font-size:14px;margin-bottom:20px;">Мы свяжемся с вами</p>' +
        '<div style="background:rgba(200,168,122,0.05);border-radius:16px;padding:18px;margin-bottom:20px;text-align:left;">' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:10px;color:#aaa;font-size:13px;"><span>Номер заказа:</span><span style="color:#dbb98c;font-weight:600;">#' + orderNumber + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:10px;color:#aaa;font-size:13px;"><span>Получатель:</span><span style="color:#f5f0eb;">' + name + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:10px;color:#aaa;font-size:13px;"><span>Телефон:</span><span style="color:#f5f0eb;">' + phone + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;color:#aaa;font-size:13px;"><span>Сумма:</span><span style="color:#dbb98c;font-weight:700;font-size:16px;">' + getCartTotal().toFixed(2) + ' BYN</span></div>' +
        '</div>' +
        '<button onclick="this.closest(\'div\').parentElement.remove();" style="background:#c8a87a;color:#0b0b0b;border:none;padding:12px 30px;border-radius:25px;font-weight:700;font-size:14px;cursor:pointer;">Понятно, вернуться в корзину</button></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ==========
function showToast(msg) {
    const old = document.querySelector('.share-toast');
    if (old) old.remove();
    const t = document.createElement('div');
    t.className = 'share-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function() {
        t.style.opacity = '0';
        t.style.transform = 'translateX(-50%) translateY(20px)';
        setTimeout(function() { t.remove(); }, 300);
    }, 3000);
}
function getBrandSite(name) {
    if (name === 'HAIR SEKTA') return 'https://hairsekta.com/';
    if (name === 'IMPRESSION PROFESSIONAL') return 'https://ipcolor.ru/';
    if (name === 'MALECULA') return 'https://malecula.pro/';
    if (name === 'ЧИСТОВЬЕ') return 'https://chistovie.ru/';
    return '#';
}
function getParentCategoryName(brand, subCatId) {
    const sub = brandCatalog[brand].categories.find(function(c) { return c.id === subCatId; });
    if (!sub || !sub.parent) return '';
    if (sub.parent === 'all') return 'Все товары';
    if (sub.parent === 'new') return 'Новинки';
    const parent = brandCatalog[brand].categories.find(function(c) { return c.id === sub.parent; });
    return parent ? parent.label : '';
}

// ========== ХРАНИЛИЩЕ ==========
function loadProductsFromStorage() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch(e) { return []; }
}
function saveProductsToStorage(products) { localStorage.setItem(STORAGE_KEY, JSON.stringify(products)); }
function loadCategoriesFromStorage() {
    try { return JSON.parse(localStorage.getItem(CATEGORIES_KEY)) || {}; }
    catch(e) { return {}; }
}
function saveCategoriesToStorage(cats) { localStorage.setItem(CATEGORIES_KEY, JSON.stringify(cats)); }
function loadCustomProductsIntoCatalog() {
    const saved = loadProductsFromStorage();
    saved.forEach(function(p) {
        if (p.brand && brandCatalog[p.brand] && !brandCatalog[p.brand].products.find(function(e) { return e.id === p.id; })) {
            brandCatalog[p.brand].products.push(p);
        }
    });
}
function loadCustomCategoriesIntoCatalog() {
    const saved = loadCategoriesFromStorage();
    Object.entries(saved).forEach(function(entry) {
        const b = entry[0];
        const cats = entry[1];
        if (!brandCatalog[b]) {
            brandCatalog[b] = { categories: [{ id: 'all', label: 'Все товары' }, { id: 'new', label: 'Новинки' }], products: [] };
        }
        cats.forEach(function(cat) {
            if (!brandCatalog[b].categories.find(function(c) { return c.id === cat.id; })) {
                brandCatalog[b].categories.push({ id: cat.id, label: cat.name, parent: null });
            }
            if (cat.children) {
                cat.children.forEach(function(sub) {
                    const sid = cat.id + '_sub_' + sub.replace(/\s/g, '_');
                    if (!brandCatalog[b].categories.find(function(c) { return c.id === sid; })) {
                        brandCatalog[b].categories.push({ id: sid, label: sub, parent: cat.id });
                    }
                });
            }
        });
    });
}

// ========== СТАРАЯ ФИЛЬТРАЦИЯ ==========
function filterProducts(cat, grid, brandName) {
    if (!grid) return;
    const bd = brandCatalog[brandName];
    const allSubIds = [];
    if (bd) {
        function collectSubs(pid) {
            bd.categories.forEach(function(c) { if (c.parent === pid) { allSubIds.push(c.id); collectSubs(c.id); } });
        }
        collectSubs(cat);
    }
    grid.querySelectorAll('.catalog-item').forEach(function(item) {
        const cid = item.getAttribute('data-category-id') || '';
        const tag = item.getAttribute('data-tag') || '';
        let show = false;
        if (cat === 'all') show = true;
        else if (cat === 'new') show = (tag === 'new');
        else if (cat === 'hit') show = (tag === 'hit');
        else { if (cid === cat) show = true; else if (allSubIds.includes(cid)) show = true; }
        item.style.display = show ? 'flex' : 'none';
    });
}

// ========== ПЕРЕХОД К ТОВАРУ ==========
function goToProduct(brand, productName) {
    const searchContainer = document.getElementById('searchResultsContainer');
    if (searchContainer) { searchContainer.style.display = 'none'; searchContainer.innerHTML = ''; }
    document.getElementById('discount').style.display = '';
    const dropdown = document.getElementById('searchDropdown');
    if (dropdown) dropdown.classList.remove('active');
    const searchInputEl = document.getElementById('searchInputNav');
    if (searchInputEl) searchInputEl.value = '';
    if (document.getElementById('catalogContainer').classList.contains('open')) closeCatalog();
    setTimeout(function() { openFullCatalog(brand, productName); }, 100);
}

// ========== СТАРЫЙ КАТАЛОГ (перенаправляет в новый) ==========
function openCatalog(brandName) { openFullCatalog(brandName, null); }
function closeCatalog() {
    document.getElementById('discount').style.display = '';
    document.getElementById('catalogContainer').classList.remove('open');
    activeBrand = null;
    currentCategory = 'all';
}
document.querySelectorAll('.brand-card-link').forEach(function(card) {
    card.addEventListener('click', function(e) {
        e.preventDefault();
        openFullCatalog(this.dataset.brand, null);
    });
});
document.addEventListener('click', function(e) {
    const modal = document.getElementById('productModal');
    if (modal && modal.classList.contains('active')) return;
    const catalogContainer = document.getElementById('catalogContainer');
    if (catalogContainer.contains(e.target) || e.target.closest('.brand-card-link')) return;
    if (catalogContainer.classList.contains('open')) closeCatalog();
});

// ========== НОВЫЙ ПОЛНОЭКРАННЫЙ КАТАЛОГ ==========
let fcState = {
    brand: null,
    brands: new Set(),
    categories: new Set(),
    priceMin: null,
    priceMax: null,
    tagHit: false,
    tagNew: false,
    sort: 'popular',
    items: [],
    highlightName: null
};

function openFullCatalog(brandName, highlightName) {
    const sc = document.getElementById('searchResultsContainer');
    if (sc) { sc.style.display = 'none'; sc.innerHTML = ''; }
    document.getElementById('discount').style.display = 'none';

    fcState.brand = brandName;
    fcState.highlightName = highlightName || null;
    fcState.brands = new Set([brandName]);
    fcState.categories = new Set();
    fcState.priceMin = null;
    fcState.priceMax = null;
    fcState.tagHit = false;
    fcState.tagNew = false;
    fcState.sort = 'popular';

    document.getElementById('fcPriceMin').value = '';
    document.getElementById('fcPriceMax').value = '';
    document.getElementById('fcTagHit').checked = false;
    document.getElementById('fcTagNew').checked = false;
    document.getElementById('fcSort').value = 'popular';
    document.getElementById('fcTitle').textContent = brandName || 'Каталог';

    buildBrandFilter();
    buildCategoryFilter(brandName);
    applyFilters();

    document.getElementById('fullCatalog').classList.add('open');
    document.body.style.overflow = 'hidden';
}
function closeFullCatalog() {
    document.getElementById('fullCatalog').classList.remove('open');
    document.body.style.overflow = '';
    document.getElementById('discount').style.display = '';
    document.getElementById('fcSidebar').classList.remove('mobile-open');
}
function toggleMobileFilters() {
    document.getElementById('fcSidebar').classList.toggle('mobile-open');
}
function buildBrandFilter() {
    const container = document.getElementById('fcBrandFilter');
    const brands = Object.keys(brandCatalog);
    container.innerHTML = brands.map(function(b) {
        const count = brandCatalog[b].products.length;
        const checked = fcState.brands.has(b) ? 'checked' : '';
        return '<label class="fc-checkbox"><input type="checkbox" value="' + b + '" ' + checked + ' onchange="toggleBrand(this)"><span class="fc-checkbox-mark"></span><span class="fc-checkbox-label">' + b + '</span><span class="fc-checkbox-count">' + count + '</span></label>';
    }).join('');
}
function buildCategoryFilter(brandName) {
    const container = document.getElementById('fcCategoryFilter');
    const cats = new Set();
    const brands = fcState.brands.size ? Array.from(fcState.brands) : Object.keys(brandCatalog);
    brands.forEach(function(b) {
        if (!brandCatalog[b]) return;
        brandCatalog[b].categories.forEach(function(c) {
            if (c.id !== 'all' && c.id !== 'new') cats.add(c.label);
        });
    });
    if (!cats.size) { container.innerHTML = '<div style="color:#666;font-size:12px;">Нет категорий</div>'; return; }
    container.innerHTML = Array.from(cats).sort().map(function(catName) {
        const checked = fcState.categories.has(catName) ? 'checked' : '';
        return '<label class="fc-checkbox"><input type="checkbox" value="' + catName.replace(/"/g, '&quot;') + '" ' + checked + ' onchange="toggleCategory(this)"><span class="fc-checkbox-mark"></span><span class="fc-checkbox-label">' + catName + '</span></label>';
    }).join('');
}
function toggleBrand(input) {
    if (input.checked) fcState.brands.add(input.value);
    else fcState.brands.delete(input.value);
    buildCategoryFilter(fcState.brand);
    applyFilters();
}
function toggleCategory(input) {
    if (input.checked) fcState.categories.add(input.value);
    else fcState.categories.delete(input.value);
    applyFilters();
}
function resetAllFilters() {
    fcState.brands = new Set(fcState.brand ? [fcState.brand] : []);
    fcState.categories = new Set();
    fcState.priceMin = null;
    fcState.priceMax = null;
    fcState.tagHit = false;
    fcState.tagNew = false;
    document.getElementById('fcPriceMin').value = '';
    document.getElementById('fcPriceMax').value = '';
    document.getElementById('fcTagHit').checked = false;
    document.getElementById('fcTagNew').checked = false;
    buildBrandFilter();
    buildCategoryFilter(fcState.brand);
    applyFilters();
}
function parsePrice(str) {
    if (!str) return 0;
    const n = String(str).replace(/[^0-9,.]/g, '').replace(',', '.');
    return parseFloat(n) || 0;
}
function applyFilters() {
    const brandsToUse = fcState.brands.size ? Array.from(fcState.brands) : Object.keys(brandCatalog);
    let items = [];
    brandsToUse.forEach(function(b) {
        if (!brandCatalog[b]) return;
        brandCatalog[b].products.forEach(function(p) { items.push(Object.assign({}, p, { _brand: b })); });
    });
    if (fcState.categories.size) {
        items = items.filter(function(p) { return fcState.categories.has(p.category); });
    }
    fcState.priceMin = document.getElementById('fcPriceMin').value ? parseFloat(document.getElementById('fcPriceMin').value) : null;
    fcState.priceMax = document.getElementById('fcPriceMax').value ? parseFloat(document.getElementById('fcPriceMax').value) : null;
    if (fcState.priceMin !== null) items = items.filter(function(p) { return parsePrice(p.price) >= fcState.priceMin; });
    if (fcState.priceMax !== null) items = items.filter(function(p) { return parsePrice(p.price) <= fcState.priceMax; });
    fcState.tagHit = document.getElementById('fcTagHit').checked;
    fcState.tagNew = document.getElementById('fcTagNew').checked;
    if (fcState.tagHit) items = items.filter(function(p) { return p.tag === 'hit'; });
    if (fcState.tagNew) items = items.filter(function(p) { return p.tag === 'new'; });
    fcState.items = items;
    applyCatalogSort(true);
    renderActiveFilters();
}
function applyCatalogSort(skipRead) {
    if (!skipRead) fcState.sort = document.getElementById('fcSort').value;
    let items = fcState.items.slice();
    const s = fcState.sort;
    if (s === 'price-asc') items.sort(function(a,b) { return parsePrice(a.price) - parsePrice(b.price); });
    else if (s === 'price-desc') items.sort(function(a,b) { return parsePrice(b.price) - parsePrice(a.price); });
    else if (s === 'name-asc') items.sort(function(a,b) { return a.name.localeCompare(b.name); });
    else if (s === 'name-desc') items.sort(function(a,b) { return b.name.localeCompare(a.name); });
    else if (s === 'new') items.sort(function(a,b) {
        const rank = function(p) { return p.tag === 'new' ? 0 : p.tag === 'hit' ? 1 : 2; };
        return rank(a) - rank(b);
    });
    renderCatalogGrid(items);
}
function renderCatalogGrid(items) {
    const grid = document.getElementById('fcGrid');
    const empty = document.getElementById('fcEmpty');
    const count = document.getElementById('fcCount');
    count.textContent = items.length + ' ' + plural(items.length, ['товар', 'товара', 'товаров']);
    if (!items.length) { grid.innerHTML = ''; empty.style.display = 'block'; return; }
    empty.style.display = 'none';
    grid.innerHTML = items.map(function(p) {
        const tag = p.tag === 'hit' ? '<div class="fc-card-tag hit">ХИТ</div>' :
                    p.tag === 'new' ? '<div class="fc-card-tag new">NEW</div>' : '';
        const oldPrice = p.oldPrice ? '<span class="old-price">' + p.oldPrice + '</span>' : '';
        const img = (p.img || 'https://i.ibb.co/p7YgvT8/images.jpg').replace(/'/g, "\\'");
        const nameEsc = p.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const brandEsc = p._brand.replace(/'/g, "\\'");
        return '<div class="fc-card" data-name="' + p.name + '">' + tag +
            '<img src="' + (p.img || 'https://i.ibb.co/p7YgvT8/images.jpg') + '" alt="' + p.name + '" onerror="this.src=\'https://i.ibb.co/p7YgvT8/images.jpg\'">' +
            '<div class="fc-card-brand">' + p._brand + '</div>' +
            '<h4>' + p.name + '</h4>' +
            '<div class="fc-card-price"><span class="price">' + p.price + '</span>' + oldPrice + '</div>' +
            '<div class="fc-card-actions">' +
            '<button class="btn-detail" onclick="openProductDetailFromCard(this)">Подробнее</button>' +
            '<button class="btn-cart-add" onclick="event.stopPropagation();addToCart(\'' + nameEsc + '\',\'' + p.price + '\',\'' + img + '\',\'' + brandEsc + '\')">🛒</button>' +
            '</div></div>';
    }).join('');
    if (fcState.highlightName) {
        setTimeout(function() {
            document.querySelectorAll('.fc-card').forEach(function(card) {
                if (card.getAttribute('data-name') === fcState.highlightName) {
                    card.style.borderColor = '#c8a87a';
                    card.style.boxShadow = '0 0 25px rgba(200,168,122,0.4)';
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(function() { card.style.borderColor = ''; card.style.boxShadow = ''; }, 3500);
                }
            });
            fcState.highlightName = null;
        }, 300);
    }
}
function renderActiveFilters() {
    const container = document.getElementById('fcActiveFilters');
    const chips = [];
    if (fcState.brands.size > 1 || (fcState.brands.size === 1 && !fcState.brand)) {
        fcState.brands.forEach(function(b) { chips.push({ label: b, type: 'brand', value: b }); });
    }
    fcState.categories.forEach(function(c) { chips.push({ label: c, type: 'category', value: c }); });
    if (fcState.priceMin !== null) chips.push({ label: 'от ' + fcState.priceMin + ' BYN', type: 'priceMin' });
    if (fcState.priceMax !== null) chips.push({ label: 'до ' + fcState.priceMax + ' BYN', type: 'priceMax' });
    if (fcState.tagHit) chips.push({ label: '🔥 Хиты', type: 'tagHit' });
    if (fcState.tagNew) chips.push({ label: '✨ Новинки', type: 'tagNew' });
    container.innerHTML = chips.map(function(c) {
        return '<span class="fc-chip">' + c.label + '<button onclick="removeChip(\'' + c.type + '\',\'' + String(c.value || '').replace(/'/g, "\\'") + '\')">✕</button></span>';
    }).join('');
}
function removeChip(type, value) {
    if (type === 'brand') { fcState.brands.delete(value); buildBrandFilter(); buildCategoryFilter(fcState.brand); }
    else if (type === 'category') { fcState.categories.delete(value); buildCategoryFilter(fcState.brand); }
    else if (type === 'priceMin') { document.getElementById('fcPriceMin').value = ''; }
    else if (type === 'priceMax') { document.getElementById('fcPriceMax').value = ''; }
    else if (type === 'tagHit') { fcState.tagHit = false; document.getElementById('fcTagHit').checked = false; }
    else if (type === 'tagNew') { fcState.tagNew = false; document.getElementById('fcTagNew').checked = false; }
    applyFilters();
}
function plural(n, forms) {
    const a = Math.abs(n) % 100;
    const b = a % 10;
    if (a > 10 && a < 20) return forms[2];
    if (b > 1 && b < 5) return forms[1];
    if (b === 1) return forms[0];
    return forms[2];
}
function openProductDetailFromCard(btn) {
    const card = btn.closest('.fc-card');
    const name = card.getAttribute('data-name');
    let found = null, foundBrand = null;
    Object.keys(brandCatalog).forEach(function(b) {
        const p = brandCatalog[b].products.find(function(x) { return x.name === name; });
        if (p && !found) { found = p; foundBrand = b; }
    });
    if (!found) return;
    currentModalProduct = { name: found.name, brand: foundBrand };
    document.getElementById('modalProductImg').src = found.img || 'https://i.ibb.co/p7YgvT8/images.jpg';
    document.getElementById('modalProductName').textContent = found.name;
    document.getElementById('modalProductPrice').textContent = found.price;
    if (found.oldPrice) {
        document.getElementById('modalProductOldPrice').textContent = found.oldPrice;
        document.getElementById('modalProductOldPrice').style.display = 'inline';
    } else { document.getElementById('modalProductOldPrice').style.display = 'none'; }
    document.getElementById('modalProductDesc').textContent = found.description || 'Описание пока не добавлено';
    const tagEl = document.getElementById('modalProductTag');
    if (found.tag === 'hit') { tagEl.textContent = '🔥 ХИТ'; tagEl.className = 'product-tag hit'; tagEl.style.display = 'inline-block'; }
    else if (found.tag === 'new') { tagEl.textContent = '✨ Новинка'; tagEl.className = 'product-tag new'; tagEl.style.display = 'inline-block'; }
    else { tagEl.style.display = 'none'; }
    document.getElementById('productModal').classList.add('active');
}

// ========== МОДАЛКА ТОВАРА ==========
function openProductDetail(btn) {
    const item = btn.closest('.catalog-item');
    const n = item.querySelector('h4').textContent;
    const b = activeBrand;
    let fp = null;
    if (brandCatalog[b]) fp = brandCatalog[b].products.find(function(p) { return p.name === n; });
    currentModalProduct = { name: n, brand: b };
    document.getElementById('modalProductImg').src = item.querySelector('img').src;
    document.getElementById('modalProductName').textContent = n;
    document.getElementById('modalProductPrice').textContent = item.querySelector('.price').textContent;
    const op = item.querySelector('.old-price');
    if (op) {
        document.getElementById('modalProductOldPrice').textContent = op.textContent;
        document.getElementById('modalProductOldPrice').style.display = 'inline';
    } else { document.getElementById('modalProductOldPrice').style.display = 'none'; }
    document.getElementById('modalProductDesc').textContent = (fp && fp.description) ? fp.description : 'Описание пока не добавлено';
    const tag = item.getAttribute('data-tag') || (fp ? fp.tag : '') || '';
    const tagEl = document.getElementById('modalProductTag');
    if (tag === 'hit') { tagEl.textContent = '🔥 ХИТ'; tagEl.className = 'product-tag hit'; tagEl.style.display = 'inline-block'; }
    else if (tag === 'new') { tagEl.textContent = '✨ Новинка'; tagEl.className = 'product-tag new'; tagEl.style.display = 'inline-block'; }
    else { tagEl.style.display = 'none'; }
    document.getElementById('productModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}
function closeModal() {
    document.getElementById('productModal').classList.remove('active');
    document.body.style.overflow = '';
}
document.querySelector('.product-modal-close').addEventListener('click', function(e) { e.stopPropagation(); closeModal(); });
document.getElementById('productModal').addEventListener('click', function(e) { if (e.target === this) closeModal(); });
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const modal = document.getElementById('productModal');
        const checkout = document.getElementById('checkoutModal');
        const fc = document.getElementById('fullCatalog');
        if (checkout && checkout.classList.contains('active')) closeCheckout();
        else if (modal && modal.classList.contains('active')) closeModal();
        else if (fc && fc.classList.contains('open')) closeFullCatalog();
    }
});

// ========== ШЕРИНГ ==========
function shareProduct(name, brand) {
    const link = window.location.href.split('?')[0] + '?product=' + encodeURIComponent(name) + '&brand=' + encodeURIComponent(brand);
    if (navigator.clipboard) {
        navigator.clipboard.writeText(link).then(function() { showShareToast(); }).catch(function() { fallbackCopy(link); });
    } else { fallbackCopy(link); }
}
function shareProductFromModal() {
    if (currentModalProduct) shareProduct(currentModalProduct.name, currentModalProduct.brand);
}
function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showShareToast();
}
function showShareToast() {
    const old = document.querySelector('.share-toast');
    if (old) old.remove();
    const toast = document.createElement('div');
    toast.className = 'share-toast';
    toast.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);background:#1a1410;color:#c8a87a;padding:14px 28px;border-radius:30px;z-index:100000;font-size:14px;border:1px solid rgba(200,168,122,0.4);box-shadow:0 8px 30px rgba(0,0,0,0.5);animation:slideUp 0.3s ease;display:flex;align-items:center;gap:8px;';
    toast.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c8a87a" stroke-width="2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg><span style="color:#c8a87a;font-weight:500;">Ссылка скопирована</span>';
    document.body.appendChild(toast);
    setTimeout(function() {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(20px)';
        setTimeout(function() { toast.remove(); }, 300);
    }, 2000);
}
function handleProductLink() {
    const p = new URLSearchParams(location.search);
    const pn = p.get('product');
    const bn = p.get('brand');
    if (pn && bn) { setTimeout(function() { goToProduct(bn, pn); }, 500); }
}

// ========== ПОИСК ==========
function searchAllBrands(q) {
    const r = [];
    const t = q.toLowerCase().trim();
    if (!t) return r;
    Object.keys(brandCatalog).forEach(function(b) {
        brandCatalog[b].products.forEach(function(p) {
            if (p.name.toLowerCase().includes(t) || (p.article && p.article.toLowerCase().includes(t)) || (p.category || '').toLowerCase().includes(t)) {
                r.push({ brand: b, product: p });
            }
        });
    });
    return r;
}
function performSearch() {
    const q = document.getElementById('searchInputNav').value.trim();
    if (!q) return alert('Введите название или артикул');
    showSearchResults(searchAllBrands(q), q);
}
function showSearchResults(results, query) {
    document.getElementById('discount').style.display = 'none';
    if (document.getElementById('catalogContainer').classList.contains('open')) closeCatalog();
    let h = '<div class="search-results-header"><h2 class="search-results-title">Результаты: "' + query + '"</h2><p class="search-results-count">Найдено: ' + results.length + '</p></div>';
    if (!results.length) {
        h += '<div class="search-no-results"><p>Ничего не найдено</p></div>';
    } else {
        h += '<div class="search-items-grid">';
        results.forEach(function(r) {
            const safeName = r.product.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            h += '<div class="search-item">' +
                '<img src="' + (r.product.img || 'https://i.ibb.co/p7YgvT8/images.jpg') + '" onclick="goToProduct(\'' + r.brand + '\',\'' + safeName + '\')" style="cursor:pointer;">' +
                '<h4>' + r.product.name + '</h4>' +
                '<div><span class="price">' + r.product.price + '</span></div>' +
                '<button class="search-go-to" onclick="goToProduct(\'' + r.brand + '\',\'' + safeName + '\')">Перейти</button></div>';
        });
        h += '</div>';
    }
    h += '<button class="close-search" onclick="this.parentElement.style.display=\'none\';document.getElementById(\'discount\').style.display=\'\'">✕ Закрыть</button>';
    document.getElementById('searchResultsContainer').innerHTML = h;
    document.getElementById('searchResultsContainer').style.display = 'block';
}
const searchInput = document.getElementById('searchInputNav');
const searchDropdown = document.getElementById('searchDropdown');
searchInput.addEventListener('input', function() {
    const q = this.value.trim();
    if (!q) { searchDropdown.classList.remove('active'); return; }
    const results = searchAllBrands(q);
    if (!results.length) {
        searchDropdown.innerHTML = '<div class="dropdown-empty">Ничего не найдено</div>';
    } else {
        let h = '';
        results.slice(0, 5).forEach(function(r) {
            const safeName = r.product.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            h += '<div class="dropdown-item" onclick="goToProduct(\'' + r.brand + '\',\'' + safeName + '\');document.getElementById(\'searchDropdown\').classList.remove(\'active\');"><img src="' + (r.product.img || 'https://i.ibb.co/p7YgvT8/images.jpg') + '"><div class="dropdown-info"><div class="dropdown-name">' + r.product.name + '</div><div class="dropdown-brand">' + r.brand + '</div></div><div class="dropdown-price">' + r.product.price + '</div></div>';
        });
        if (results.length > 5) {
            h += '<div class="dropdown-view-all" onclick="performSearch();document.getElementById(\'searchDropdown\').classList.remove(\'active\');">Показать все (' + results.length + ')</div>';
        }
        searchDropdown.innerHTML = h;
    }
    searchDropdown.classList.add('active');
});
searchInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { performSearch(); searchDropdown.classList.remove('active'); }
});
document.addEventListener('click', function(e) {
    if (!e.target.closest('.nav-search-wrap')) searchDropdown.classList.remove('active');
});

// ========== ПРОКРУТКА БРЕНДОВ ==========
function scrollBrands(dir) {
    document.getElementById('brandsGrid').scrollBy({ left: dir === 'left' ? -280 : 280, behavior: 'smooth' });
}
function checkScrollArrows() {
    const g = document.getElementById('brandsGrid');
    const l = document.querySelector('.scroll-arrow.left');
    const r = document.querySelector('.scroll-arrow.right');
    if (!g || !l || !r) return;
    const c = g.querySelectorAll('.brand-card-link');
    if (c.length <= 4) { l.style.display = 'none'; r.style.display = 'none'; g.style.justifyContent = 'center'; }
    else { l.style.display = 'flex'; r.style.display = 'flex'; g.style.justifyContent = 'flex-start'; }
}

// ========== ЗАГРУЗКА CSV ==========
async function loadCSVFile(name) {
    try {
        const r = await fetch('./data/' + name);
        if (!r.ok) return false;
        processCSVData(await r.text(), name);
        return true;
    } catch(e) { return false; }
}
function processCSVData(text, fileName) {
    const firstLine = text.split('\n')[0] || '';
    let delimiter = ';';
    if (firstLine.split('\t').length > firstLine.split(';').length) delimiter = '\t';
    const lines = text.replace(/^\uFEFF/, '').split('\n').filter(function(l) { return l.trim(); });
    if (lines.length < 2) return;
    const headers = lines[0].split(delimiter).map(function(h) { return h.trim(); });
    function findCol() {
        const names = Array.prototype.slice.call(arguments);
        for (let i = 0; i < names.length; i++) {
            const name = names[i];
            const idx = headers.findIndex(function(h) { return h && h.toLowerCase().trim() === name.toLowerCase(); });
            if (idx >= 0) return idx;
        }
        return -1;
    }
    const brandIdx = findCol('Бренд', 'бренд', 'brand');
    const catIdx = findCol('Категория', 'категория', 'category');
    const subCatIdx = findCol('Подкатегория', 'подкатегория', 'subcategory');
    const nameIdx = findCol('Название', 'название', 'Наименование', 'Номенклатура');
    const priceIdx = findCol('Цена', 'цена', 'Розничная');
    const oldPriceIdx = findCol('Старая цена', 'старая цена');
    const artIdx = findCol('Артикул', 'артикул');
    const tagIdx = findCol('Тег', 'тег', 'tag');
    const imgIdx = findCol('Фото', 'фото', 'img');
    const descIdx = findCol('Описание', 'описание');
    const catIdIdx = findCol('ID КАТ', 'id кат', 'category id');
    if (nameIdx === -1 || priceIdx === -1) return;
    for (let i = 1; i < lines.length; i++) {
        const v = lines[i].split(delimiter).map(function(x) { return x.trim(); });
        if (v.length < headers.length) continue;
        const brandRaw = brandIdx >= 0 ? (v[brandIdx] || '') : '';
        const catRaw = catIdx >= 0 ? (v[catIdx] || '') : '';
        const subCatRaw = subCatIdx >= 0 ? (v[subCatIdx] || '') : '';
        const name = v[nameIdx] || '';
        const priceRaw = (v[priceIdx] || '').replace(',', '.');
        const oldPrice = oldPriceIdx >= 0 ? (v[oldPriceIdx] || '') : '';
        const article = artIdx >= 0 ? (v[artIdx] || '') : '';
        const tagRaw = tagIdx >= 0 ? (v[tagIdx] || '') : '';
        const img = imgIdx >= 0 ? (v[imgIdx] || '') : '';
        const desc = descIdx >= 0 ? (v[descIdx] || '') : '';
        const catIdRaw = catIdIdx >= 0 ? (v[catIdIdx] || '') : '';
        if (!name || !priceRaw) continue;
        let foundBrand = brandRaw ? Object.keys(brandCatalog).find(function(b) {
            return b.toUpperCase() === brandRaw.toUpperCase() || b.toUpperCase().includes(brandRaw.toUpperCase());
        }) : null;
        if (!foundBrand) {
            foundBrand = Object.keys(brandCatalog).find(function(b) {
                return name.toUpperCase().includes(b.toUpperCase()) || catRaw.toUpperCase().includes(b.toUpperCase()) || subCatRaw.toUpperCase().includes(b.toUpperCase());
            });
        }
        if (!foundBrand) continue;
        let pr = priceRaw;
        if (!pr.toLowerCase().includes('byn')) pr += ' BYN';
        let op = oldPrice || null;
        if (op && !op.toLowerCase().includes('byn')) op += ' BYN';
        let tag = null;
        const tt = tagRaw.toLowerCase();
        if (tt.includes('новинка')) tag = 'new';
        else if (tt.includes('хит')) tag = 'hit';
        let categoryId = catIdRaw || '';
        let categoryName = 'Все товары';
        if (categoryId && !['all', 'new', ''].includes(categoryId)) {
            const existingCat = brandCatalog[foundBrand].categories.find(function(x) { return x.id === categoryId; });
            if (!existingCat) {
                if (categoryId.includes('_sub_')) {
                    const pid = categoryId.split('_sub_')[0];
                    if (!brandCatalog[foundBrand].categories.find(function(x) { return x.id === pid; })) {
                        brandCatalog[foundBrand].categories.push({ id: pid, label: pid.replace('cat_', '').replace(/_/g, ' '), parent: null });
                    }
                    brandCatalog[foundBrand].categories.push({ id: categoryId, label: subCatRaw || categoryId.split('_sub_')[1].replace(/_/g, ' '), parent: pid });
                } else {
                    brandCatalog[foundBrand].categories.push({ id: categoryId, label: catRaw || categoryId.replace('cat_', '').replace(/_/g, ' '), parent: null });
                }
            }
            categoryName = catRaw || 'Все товары';
        } else if (subCatRaw) {
            let subCat = brandCatalog[foundBrand].categories.find(function(c) { return c.parent && c.label.toLowerCase() === subCatRaw.toLowerCase(); });
            if (subCat) {
                categoryId = subCat.id;
                const parentCat = brandCatalog[foundBrand].categories.find(function(c) { return c.id === subCat.parent; });
                categoryName = (parentCat ? parentCat.label + ' → ' : '') + subCat.label;
            } else {
                let parentId = null;
                if (catRaw) {
                    let parentCat = brandCatalog[foundBrand].categories.find(function(c) { return !c.parent && c.id !== 'all' && c.id !== 'new' && c.label.toLowerCase() === catRaw.toLowerCase(); });
                    if (!parentCat) {
                        parentId = 'cat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
                        brandCatalog[foundBrand].categories.push({ id: parentId, label: catRaw, parent: null });
                    } else { parentId = parentCat.id; }
                } else {
                    const firstMain = brandCatalog[foundBrand].categories.find(function(c) { return !c.parent && c.id !== 'all' && c.id !== 'new'; });
                    if (firstMain) parentId = firstMain.id;
                    else { parentId = 'cat_' + Date.now(); brandCatalog[foundBrand].categories.push({ id: parentId, label: 'Прочее', parent: null }); }
                }
                categoryId = parentId + '_sub_' + subCatRaw.replace(/\s/g, '_');
                brandCatalog[foundBrand].categories.push({ id: categoryId, label: subCatRaw, parent: parentId });
                const pc = brandCatalog[foundBrand].categories.find(function(c) { return c.id === parentId; });
                categoryName = (pc ? pc.label + ' → ' : '') + subCatRaw;
            }
        } else if (catRaw) {
            let mainCat = brandCatalog[foundBrand].categories.find(function(c) { return !c.parent && c.id !== 'all' && c.id !== 'new' && c.label.toLowerCase() === catRaw.toLowerCase(); });
            if (mainCat) { categoryId = mainCat.id; categoryName = mainCat.label; }
            else {
                categoryId = 'cat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
                brandCatalog[foundBrand].categories.push({ id: categoryId, label: catRaw, parent: null });
                categoryName = catRaw;
            }
        }
        const product = {
            id: 'csv_' + Date.now() + '_' + i, article: article || '', name: name, price: pr, oldPrice: op,
            category: categoryName, categoryId: categoryId, tag: tag,
            img: img || 'https://i.ibb.co/p7YgvT8/images.jpg', description: desc || '', brand: foundBrand
        };
        if (!brandCatalog[foundBrand].products.find(function(e) { return e.name === product.name; })) {
            brandCatalog[foundBrand].products.push(product);
        }
    }
    const all = [];
    Object.values(brandCatalog).forEach(function(d) { d.products.forEach(function(p) { all.push(p); }); });
    saveProductsToStorage(all);
}
function loadCategoriesFromCSV(text, fileName) {
    const firstLine = text.split('\n')[0] || '';
    let delimiter = ';';
    if (firstLine.split('\t').length > firstLine.split(';').length) delimiter = '\t';
    const lines = text.replace(/^\uFEFF/, '').split('\n').filter(function(l) { return l.trim(); });
    if (lines.length < 2) return;
    const headers = lines[0].split(delimiter).map(function(h) { return h.trim(); });
    const hasTypeColumn = headers.some(function(h) { return h && (h.toLowerCase() === 'тип' || h.toLowerCase() === 'type'); });
    const hasIdColumn = headers.some(function(h) { return h && (h.toLowerCase() === 'id категории' || h.toLowerCase() === 'id кат' || h.toLowerCase() === 'id'); });
    if (hasTypeColumn && hasIdColumn) {
        for (let i = 1; i < lines.length; i++) {
            const v = lines[i].split(delimiter).map(function(x) { return x.trim(); });
            if (v.length < 3) continue;
            const b = v[0], cid = v[1], cn = v[2], pid = v[4] || null;
            if (!b || !cid || !cn) continue;
            let fb = Object.keys(brandCatalog).find(function(x) { return x.toUpperCase() === b.toUpperCase() || x.toUpperCase().includes(b.toUpperCase()); });
            if (!fb) continue;
            if (!brandCatalog[fb].categories.find(function(x) { return x.id === cid; })) {
                brandCatalog[fb].categories.push({ id: cid, label: cn, parent: pid });
            }
        }
    } else {
        for (let i = 1; i < lines.length; i++) {
            const v = lines[i].split(delimiter).map(function(x) { return x.trim(); });
            if (v.length < 2) continue;
            const b = v[0], catName = v[1], subCatName = v[2] || '';
            if (!b || !catName) continue;
            let fb = Object.keys(brandCatalog).find(function(x) { return x.toUpperCase() === b.toUpperCase() || x.toUpperCase().includes(b.toUpperCase()); });
            if (!fb) continue;
            let mainCat = brandCatalog[fb].categories.find(function(c) { return !c.parent && c.id !== 'all' && c.id !== 'new' && c.label.toLowerCase() === catName.toLowerCase(); });
            if (!mainCat) {
                const newId = 'cat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
                brandCatalog[fb].categories.push({ id: newId, label: catName, parent: null });
                mainCat = { id: newId, label: catName };
            }
            if (subCatName) {
                const sid = mainCat.id + '_sub_' + subCatName.replace(/\s/g, '_');
                if (!brandCatalog[fb].categories.find(function(x) { return x.id === sid; })) {
                    brandCatalog[fb].categories.push({ id: sid, label: subCatName, parent: mainCat.id });
                }
            }
        }
    }
}
async function loadAllCSV() {
    Object.keys(brandCatalog).forEach(function(b) {
        brandCatalog[b].products = [];
        brandCatalog[b].categories = [{ id: 'all', label: 'Все товары' }, { id: 'new', label: 'Новинки' }];
    });
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CATEGORIES_KEY);
    try {
        const r = await fetch('./data/files_list.txt');
        if (r.ok) {
            const files = (await r.text()).split('\n').map(function(f) { return f.trim(); }).filter(function(f) { return f.endsWith('.csv'); });
            for (const f of files) {
                const resp = await fetch('./data/' + f);
                const text = await resp.text();
                const fl = text.split('\n')[0].trim() || '';
                if (fl.includes('ID категории') || (fl.includes('Подкатегория') && !fl.includes('Название') && !fl.includes('Цена'))) {
                    loadCategoriesFromCSV(text, f);
                } else { processCSVData(text, f); }
            }
        } else { throw new Error(); }
    } catch(e) {
        await loadCSVFile('MALECULA.csv');
        await loadCSVFile('productsHR.csv');
    }
    const ac = {};
    Object.entries(brandCatalog).forEach(function(entry) {
        const b = entry[0], d = entry[1];
        const cats = d.categories.filter(function(c) { return c.id !== 'all' && c.id !== 'new'; })
            .map(function(c) { return { id: c.id, name: c.label, parent: c.parent || null, children: [] }; });
        const mc = cats.filter(function(c) { return !c.parent; });
        cats.filter(function(c) { return c.parent; }).forEach(function(s) {
            const p = mc.find(function(x) { return x.id === s.parent; });
            if (p) { if (!p.children) p.children = []; if (!p.children.includes(s.name)) p.children.push(s.name); }
        });
        if (mc.length) ac[b] = mc;
    });
    saveCategoriesToStorage(ac);
    loadCustomCategoriesIntoCatalog();
}

// ========== СЧЁТЧИК ПОСЕЩЕНИЙ ==========
const VISITOR_KEY = 'vitbeauty_site_visitors';
(function() {
    const today = new Date().toDateString();
    let d;
    try { d = JSON.parse(localStorage.getItem(VISITOR_KEY)) || { total: 0, daily: {}, firstVisit: new Date().toISOString() }; }
    catch(e) { d = { total: 0, daily: {}, firstVisit: new Date().toISOString() }; }
    if (!sessionStorage.getItem('site_visited')) {
        sessionStorage.setItem('site_visited', 'true');
        d.total++;
        if (!d.daily[today]) d.daily[today] = 0;
        d.daily[today]++;
        localStorage.setItem(VISITOR_KEY, JSON.stringify(d));
    }
})();

// ========== МОДАЛКА ЛОЯЛЬНОСТИ ==========
function openLoyaltyInfo() {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);backdrop-filter:blur(6px);z-index:100002;display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.innerHTML = `
        <div style="background:#1a1410;border:1px solid rgba(200,168,122,0.3);border-radius:24px;padding:35px 30px;max-width:520px;width:100%;max-height:85vh;overflow-y:auto;">
            <div style="text-align:center;margin-bottom:20px;">
                <div style="font-size:44px;">💎</div>
                <h2 style="color:#c8a87a;font-size:22px;margin:10px 0 6px;">Программа лояльности</h2>
                <p style="color:#aaa;font-size:14px;">5% с каждой покупки — постоянным клиентам</p>
            </div>
            <div style="background:rgba(200,168,122,0.05);border-radius:16px;padding:18px;margin-bottom:16px;color:#ddd;font-size:14px;line-height:1.7;">
                <p style="margin-bottom:10px;"><b style="color:#c8a87a;">Как это работает:</b></p>
                <p>• Совершаете покупки на любую сумму<br>
                • После второй покупки получаете статус «Постоянный клиент»<br>
                • На каждый следующий заказ действует скидка <b style="color:#c8a87a;">5%</b><br>
                • Скидка суммируется с акциями брендов<br>
                • Персональный менеджер и приоритетная доставка</p>
            </div>
            <div style="display:flex;gap:8px;justify-content:center;">
                <a href="tel:+375336144033" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px;background:#c8a87a;color:#0b0b0b;padding:12px 24px;border-radius:24px;font-weight:700;font-size:14px;">📞 Позвонить</a>
                <button onclick="this.closest('div').parentElement.parentElement.remove()" style="background:transparent;border:1px solid rgba(200,168,122,0.4);color:#c8a87a;padding:12px 24px;border-radius:24px;font-weight:600;font-size:14px;cursor:pointer;font-family:inherit;">Закрыть</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
}

// ========== ФИКС: корзина и уведомления всегда поверх ==========
document.addEventListener('DOMContentLoaded', function() {
    const cartIcon = document.querySelector('.cart-icon');
    const notifIcon = document.querySelector('.notif-icon-header');
    if (cartIcon && !cartIcon.dataset.bound) {
        cartIcon.dataset.bound = '1';
        cartIcon.addEventListener('click', function(e) { e.stopPropagation(); toggleCart(); });
    }
    if (notifIcon && !notifIcon.dataset.bound) {
        notifIcon.dataset.bound = '1';
        notifIcon.addEventListener('click', function(e) { e.stopPropagation(); toggleNotifications(); });
    }
});

// ========== ЗАПУСК ==========
document.addEventListener('DOMContentLoaded', function() {
    const sv = localStorage.getItem('vitbeauty_data_version');
    if (sv !== DATA_VERSION) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(CATEGORIES_KEY);
        localStorage.setItem('vitbeauty_data_version', DATA_VERSION);
    }
    loadCustomProductsIntoCatalog();
    loadCustomCategoriesIntoCatalog();
    setTimeout(loadAllCSV, 300);
    handleProductLink();
    setTimeout(checkScrollArrows, 500);
    window.addEventListener('resize', checkScrollArrows);
    updateCartUI();
    updateNotifCount();
    loadNotificationsFromServer();
});   
