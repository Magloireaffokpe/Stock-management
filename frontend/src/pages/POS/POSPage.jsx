import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  User,
  ReceiptText,
  X,
  Check,
  Percent,
  ChevronDown,
} from "lucide-react";
import { catalogAPI, salesAPI, reportsAPI, formatCurrency } from "../../api";
import useSettingsStore from "../../store/settingsStore";
import useAuthStore from "../../store/authStore";
import toast from "react-hot-toast";

const PAYMENT_METHODS = [{ value: "cash", label: "Espèces" }];

export default function POSPage() {
  const currency = useSettingsStore((s) => s.settings?.currency || "FCFA");
  const isAdmin = useAuthStore((s) => s.isAdmin());
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [payment, setPayment] = useState("cash");
  const [discount, setDiscount] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(null);
  const [catFilter, setCatFilter] = useState("all");
  const [categories, setCategories] = useState([]);
  const searchRef = useRef();

  // Debounce de la recherche
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(handler);
  }, [query]);

  // Chargement initial
  useEffect(() => {
    Promise.all([
      catalogAPI.products({ page_size: 20, is_active: true, min_stock: 1 }), // Exclure produits inactifs et en rupture
      salesAPI.clients({ page_size: 200 }),
      catalogAPI.categories({ active_only: true }),
    ])
      .then(([pRes, cRes, catRes]) => {
        const prods = pRes.data?.results ?? pRes.data ?? [];
        setAllProducts(prods);
        setProducts(prods);
        setClients(cRes.data?.results ?? cRes.data ?? []);
        setCategories(catRes.data?.results ?? catRes.data ?? []);
      })
      .catch(() => toast.error("Erreur chargement des produits"));
  }, []);

  // Recherche via API quand les filtres changent
  useEffect(() => {
    if (!debouncedQuery.trim() && catFilter === "all") {
      setProducts(allProducts); // Restaure les produits initiaux
      return;
    }

    const search = async () => {
      try {
        const res = await catalogAPI.products({
          page_size: 50,
          is_active: true,
          min_stock: 1,
          ...(debouncedQuery && { search: debouncedQuery }),
          ...(catFilter !== "all" && { category: catFilter }),
        });
        setProducts(res.data?.results ?? res.data ?? []);
      } catch (e) {
        console.error("Erreur de recherche POS:", e);
      }
    };
    search();
  }, [debouncedQuery, catFilter, allProducts]);

  const addToCart = (product) => {
    if (product.stock_quantity <= 0) return;
    setCart((prev) => {
      const exists = prev.find((i) => i.product.id === product.id);
      if (exists) {
        if (exists.quantity >= product.stock_quantity) {
          toast.error(`Stock max: ${product.stock_quantity}`);
          return prev;
        }
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [
        ...prev,
        { product, quantity: 1, unit_price: parseFloat(product.selling_price) },
      ];
    });
  };

  const updateQty = (productId, delta) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.product.id === productId
            ? {
                ...i,
                quantity: Math.max(
                  0,
                  Math.min(i.quantity + delta, i.product.stock_quantity),
                ),
              }
            : i,
        )
        .filter((i) => i.quantity > 0),
    );
  };

  const updatePrice = (productId, price) => {
    setCart((prev) =>
      prev.map((i) =>
        i.product.id === productId
          ? { ...i, unit_price: parseFloat(price) || 0 }
          : i,
      ),
    );
  };

  const removeItem = (productId) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const subtotal = cart.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const discountAmt = parseFloat(discount) || 0;
  const total = Math.max(0, subtotal - discountAmt);

  const handleSale = async () => {
    if (cart.length === 0) {
      toast.error("Panier vide");
      return;
    }
    setLoading(true);
    try {
      const res = await salesAPI.createSale({
        client_id: selectedClient?.id || null,
        items: cart.map((i) => ({
          product_id: i.product.id,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
        payment_method: payment,
        amount_paid: total,
        discount: discountAmt,
      });
      const sale = res.data;
      setShowSuccess(sale);
      setCart([]);
      setSelectedClient(null);
      setDiscount("");
      // Rafraîchir les stocks dans la liste produits initiale
      const updated = await catalogAPI.products({
        page_size: 20,
        is_active: true,
        min_stock: 1,
      });
      const prods = updated.data?.results ?? updated.data ?? [];
      setAllProducts(prods);
    } catch (e) {
      toast.error(e.response?.data?.error || "Erreur lors de la vente");
    } finally {
      setLoading(false);
    }
  };

  if (showSuccess) {
    return (
      <SuccessScreen
        sale={showSuccess}
        currency={currency}
        onNew={() => setShowSuccess(null)}
      />
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
      }}
    >
      {/* Filtres */}
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 14,
          flexWrap: "wrap",
          flexShrink: 0,
        }}
      >
        <div
          className="input-wrapper"
          style={{ flex: 1, minWidth: 200, maxWidth: 360 }}
        >
          <Search size={15} className="input-icon" />
          <input
            ref={searchRef}
            className="input has-icon"
            placeholder="Rechercher produit ou SKU…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          className="input"
          style={{ width: "auto", minWidth: 160 }}
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
        >
          <option value="all">Toutes catégories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <ShoppingCart size={16} style={{ color: "var(--text-muted)" }} />
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            {cart.length} article(s)
          </span>
        </div>
      </div>

      <div className="pos-layout" style={{ flex: 1, minHeight: 0 }}>
        {/* Grille produits */}
        <div className="pos-products">
          {products.length === 0 ? (
            <div className="empty-state">
              <Search size={32} />
              <h3>Aucun produit trouvé</h3>
              <p>Essayez un autre terme ou catégorie</p>
            </div>
          ) : (
            <div className="pos-product-grid">
              {products.map((p) => (
                <div
                  key={p.id}
                  className={`pos-product-card${p.stock_quantity <= 0 ? " out-of-stock" : ""}`}
                  onClick={() => addToCart(p)}
                  title={
                    p.stock_quantity <= 0
                      ? "Rupture de stock"
                      : `Ajouter ${p.name}`
                  }
                >
                  {/* Badge catégorie */}
                  <div
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: p.category_color || "var(--blue-400)",
                    }}
                  />

                  <div className="pos-product-name">{p.name}</div>
                  <div className="pos-product-price">
                    {formatCurrency(p.selling_price, currency)}
                  </div>
                  <div
                    className={`pos-product-stock stock-dot ${p.stock_status}`}
                  >
                    {p.stock_quantity <= 0
                      ? "Rupture"
                      : `${p.stock_quantity} dispo`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Panier */}
        <div className="pos-cart">
          <div className="pos-cart-header">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ShoppingCart size={17} />
              Panier
            </div>
            {cart.length > 0 && (
              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => setCart([])}
                data-tooltip="Vider le panier"
              >
                <Trash2 size={14} style={{ color: "var(--danger)" }} />
              </button>
            )}
          </div>

          {/* Items */}
          <div className="pos-cart-items">
            {cart.length === 0 ? (
              <div
                style={{
                  padding: "30px 10px",
                  textAlign: "center",
                  color: "var(--text-muted)",
                }}
              >
                <ShoppingCart
                  size={28}
                  style={{
                    opacity: 0.2,
                    display: "block",
                    margin: "0 auto 8px",
                  }}
                />
                <p style={{ fontSize: "0.8rem" }}>Cliquez sur un produit</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.product.id} className="cart-item">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="cart-item-name">{item.product.name}</div>
                    {/* Prix — modifiable admin seulement */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        marginTop: 3,
                      }}
                    >
                      {isAdmin ? (
                        <input
                          type="number"
                          value={item.unit_price}
                          onChange={(e) =>
                            updatePrice(item.product.id, e.target.value)
                          }
                          style={{
                            width: 90,
                            padding: "2px 6px",
                            border: "1px solid var(--border)",
                            borderRadius: 5,
                            fontSize: "0.75rem",
                            fontFamily: "var(--font-mono)",
                            background: "var(--bg-input)",
                          }}
                          min={0}
                        />
                      ) : (
                        <span
                          style={{
                            fontSize: "0.75rem",
                            fontFamily: "var(--font-mono)",
                            color: "var(--text-secondary)",
                            fontWeight: 600,
                          }}
                        >
                          {formatCurrency(item.unit_price, currency)}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: "0.68rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        {currency}
                      </span>
                    </div>
                  </div>
                  <div className="cart-item-qty">
                    <button
                      className="qty-btn"
                      onClick={() => updateQty(item.product.id, -1)}
                    >
                      <Minus size={10} />
                    </button>
                    <span
                      style={{
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        minWidth: 22,
                        textAlign: "center",
                      }}
                    >
                      {item.quantity}
                    </span>
                    <button
                      className="qty-btn"
                      onClick={() => updateQty(item.product.id, 1)}
                    >
                      <Plus size={10} />
                    </button>
                  </div>
                  <div className="cart-item-price">
                    {formatCurrency(item.unit_price * item.quantity, currency)}
                  </div>
                  <button
                    className="btn btn-ghost btn-icon"
                    style={{ padding: 3 }}
                    onClick={() => removeItem(item.product.id)}
                  >
                    <X size={13} style={{ color: "var(--danger)" }} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer panier */}
          <div className="pos-cart-footer">
            {/* Client */}
            <div style={{ marginBottom: 10 }}>
              <select
                className="input"
                style={{ width: "100%", fontSize: "0.82rem" }}
                value={selectedClient?.id || ""}
                onChange={(e) => {
                  const c = clients.find(
                    (c) => c.id === parseInt(e.target.value),
                  );
                  setSelectedClient(c || null);
                }}
              >
                <option value="">Client comptoir (anonyme)</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name} — {c.phone}
                  </option>
                ))}
              </select>
            </div>

            {/* Totaux */}
            <div className="pos-total-row">
              <span>Sous-total</span>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                {formatCurrency(subtotal, currency)}
              </span>
            </div>

            {/* Remise — admins seulement */}
            {isAdmin && (
              <div className="pos-total-row">
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Percent size={13} /> Remise
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    placeholder="0"
                    min={0}
                    style={{
                      width: 80,
                      padding: "3px 8px",
                      border: "1px solid var(--border)",
                      borderRadius: 5,
                      fontSize: "0.78rem",
                      fontFamily: "var(--font-mono)",
                      textAlign: "right",
                      background: "var(--bg-input)",
                    }}
                  />
                  <span
                    style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}
                  >
                    {currency}
                  </span>
                </div>
              </div>
            )}

            <div className="divider" style={{ margin: "8px 0" }} />

            <div className="pos-total-row" style={{ marginBottom: 10 }}>
              <span
                style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
              >
                TOTAL
              </span>
              <span className="pos-grand-total">
                {formatCurrency(total, currency)}
              </span>
            </div>

            {/* Paiement */}
            <div style={{ marginBottom: 10 }}>
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "var(--text-muted)",
                  marginBottom: 6,
                }}
              >
                Paiement
              </div>
              <div
                style={{
                  padding: "8px 10px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  background: "var(--bg-soft)",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                }}
              >
                {PAYMENT_METHODS[0].label}
              </div>
            </div>

            {/* Bouton valider */}
            <button
              className="btn btn-orange btn-xl w-full"
              onClick={handleSale}
              disabled={loading || cart.length === 0}
              style={{ justifyContent: "center" }}
            >
              {loading ? (
                <>
                  <div
                    className="spinner"
                    style={{
                      borderColor: "rgba(255,255,255,0.3)",
                      borderTopColor: "#fff",
                    }}
                  />{" "}
                  Validation…
                </>
              ) : (
                <>
                  <Check size={18} /> Valider la vente
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SuccessScreen({ sale, currency, onNew }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "calc(100vh - 120px)",
        textAlign: "center",
        padding: 40,
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: "50%",
          background: "var(--success-light)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
          animation: "slide-up 0.3s ease",
        }}
      >
        <Check size={40} color="var(--success)" strokeWidth={2.5} />
      </div>
      <h2 style={{ fontSize: "1.6rem", marginBottom: 6 }}>
        Vente enregistrée !
      </h2>
      <p style={{ color: "var(--text-muted)", marginBottom: 6 }}>
        Facture{" "}
        <strong
          style={{ color: "var(--blue-600)", fontFamily: "var(--font-mono)" }}
        >
          {sale.invoice_number}
        </strong>
      </p>
      <p
        style={{
          fontSize: "1.4rem",
          fontFamily: "var(--font-mono)",
          fontWeight: 800,
          color: "var(--text-primary)",
          marginBottom: 24,
        }}
      >
        {formatCurrency(sale.total_amount, currency)}
      </p>
      {sale.change_given > 0 && (
        <div
          className="alert-banner success"
          style={{ marginBottom: 20, fontSize: "1rem" }}
        >
          Monnaie à rendre :{" "}
          <strong>{formatCurrency(sale.change_given, currency)}</strong>
        </div>
      )}
      <div style={{ display: "flex", gap: 12 }}>
        <a
          onClick={() => reportsAPI.invoicePDF(sale.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-outline"
        >
          <ReceiptText size={16} /> Imprimer facture
        </a>
        <button className="btn btn-orange btn-lg" onClick={onNew}>
          <Plus size={16} /> Nouvelle vente
        </button>
      </div>
    </div>
  );
}
