import { useEffect, useState, useRef } from 'react'
import './App.css'

export default function App() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')

  // Google OAuth Client ID & Stripe config
  const [googleClientId, setGoogleClientId] = useState('')
  const [stripePublishableKey, setStripePublishableKey] = useState('')
  
  // User state
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('shop_user')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  // Cart state
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem('shop_cart')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [isCartOpen, setIsCartOpen] = useState(false)

  // Checkout modal & state
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  const [submittingOrder, setSubmittingOrder] = useState(false)
  const [orderError, setOrderError] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [shippingAddress, setShippingAddress] = useState('')

  // Order confirmation modal
  const [confirmedOrder, setConfirmedOrder] = useState(null)

  // Order history modal
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [myOrders, setMyOrders] = useState([])
  const [loadingOrders, setLoadingOrders] = useState(false)

  const googleBtnRef = useRef(null)

  // Persist cart to localStorage
  useEffect(() => {
    localStorage.setItem('shop_cart', JSON.stringify(cart))
  }, [cart])

  // Fetch backend config (Google + Stripe)
  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((cfg) => {
        if (cfg.google_client_id) setGoogleClientId(cfg.google_client_id)
        if (cfg.stripe_publishable_key) setStripePublishableKey(cfg.stripe_publishable_key)
      })
      .catch(() => {})
  }, [])

  // Auto-verify Stripe redirect on return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get('session_id')
    const status = params.get('status')

    if (sessionId && status === 'success') {
      verifyStripeSession(sessionId)
    } else if (status === 'cancelled') {
      setOrderError('Payment was cancelled. You can try checking out again.')
      setIsCheckoutOpen(true)
      // Clean query params
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  async function verifyStripeSession(sessionId) {
    try {
      const res = await fetch('/api/stripe/verify-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setConfirmedOrder(data)
        setCart([])
        localStorage.removeItem('shop_cart')
        fetchProducts()
      } else {
        setError(data.error || 'Failed to verify payment session')
      }
    } catch (err) {
      console.error('Error verifying Stripe session:', err)
    } finally {
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }

  // Auto-fill checkout fields if user logs in
  useEffect(() => {
    if (user) {
      if (!customerName) setCustomerName(user.name || '')
      if (!customerEmail) setCustomerEmail(user.email || '')
    }
  }, [user])

  // Render Google Sign-In Button
  useEffect(() => {
    if (user) return // already signed in

    function initGoogle() {
      if (window.google?.accounts?.id && googleClientId) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleResponse,
        })

        if (googleBtnRef.current) {
          googleBtnRef.current.innerHTML = ''
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            theme: 'outline',
            size: 'medium',
            text: 'signin_with',
            shape: 'pill',
          })
        }
      }
    }

    if (window.google?.accounts?.id) {
      initGoogle()
    } else {
      const timer = setInterval(() => {
        if (window.google?.accounts?.id) {
          initGoogle()
          clearInterval(timer)
        }
      }, 300)
      return () => clearInterval(timer)
    }
  }, [user, googleClientId])

  async function handleGoogleResponse(response) {
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed Google authentication')

      setUser(data.user)
      localStorage.setItem('shop_user', JSON.stringify(data.user))
    } catch (err) {
      alert(`Google Sign-In Error: ${err.message}`)
    }
  }

  function handleSignOut() {
    setUser(null)
    localStorage.removeItem('shop_user')
  }

  // Fetch products from Flask / Supabase API
  useEffect(() => {
    fetchProducts()
  }, [selectedCategory])

  async function fetchProducts() {
    setLoading(true)
    try {
      let url = '/api/products'
      if (selectedCategory !== 'All') {
        url += `?category=${encodeURIComponent(selectedCategory)}`
      }
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch products')
      const data = await res.json()
      setProducts(data)
      setError('')
    } catch (err) {
      setError('Could not load products. Ensure the backend is running.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Fetch user orders history
  async function openOrderHistory() {
    if (!user) return
    setIsHistoryOpen(true)
    setLoadingOrders(true)
    try {
      const res = await fetch(`/api/orders/my-orders?user_id=${user.id}`)
      const data = await res.json()
      setMyOrders(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingOrders(false)
    }
  }

  // Cart operations
  function addToCart(product) {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id)
      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }
      return [...prev, { ...product, quantity: 1 }]
    })
    setIsCartOpen(true)
  }

  function updateQuantity(productId, delta) {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === productId) {
            const newQty = item.quantity + delta
            return newQty > 0 ? { ...item, quantity: newQty } : null
          }
          return item
        })
        .filter(Boolean)
    )
  }

  function removeFromCart(productId) {
    setCart((prev) => prev.filter((item) => item.id !== productId))
  }

  const cartTotalItems = cart.reduce((sum, item) => sum + item.quantity, 0)
  const cartSubtotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  )

  const filteredProducts = products.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const categories = ['All', 'Cardigans', 'Hats & Beanies', 'Tops', 'Bags', 'Accessories']

  // Stripe Checkout Flow (Apple Pay, Google Pay, Cards)
  async function handleStripeCheckout(e) {
    e.preventDefault()
    setOrderError('')

    if (!customerName.trim() || !customerEmail.trim() || !shippingAddress.trim()) {
      setOrderError('Please fill out all checkout fields.')
      return
    }

    setSubmittingOrder(true)
    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: customerName,
          customer_email: customerEmail,
          shipping_address: shippingAddress,
          items: cart,
          user_id: user ? user.id : null,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to initialize Stripe checkout session.')
      }

      // Redirect to Stripe's hosted secure checkout page (supports Apple Pay, Google Pay, Cards)
      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error('No checkout URL returned from Stripe.')
      }
    } catch (err) {
      setOrderError(err.message || 'An error occurred while connecting to Stripe.')
      setSubmittingOrder(false)
    }
  }

  return (
    <div className="store-container">
      {/* Top Announcement Bar */}
      <div className="announcement-bar">
        Free UK & Worldwide shipping over £40 | Handcrafted crochet wear | Apple Pay & Stripe Secure Checkout
      </div>

      {/* Navigation Header */}
      <header className="navbar">
        <div className="nav-brand">
          <span className="brand-badge">BOUTIQUE</span>
          <span className="brand-name">CrochetStudio</span>
        </div>

        <div className="nav-search">
          <input
            type="text"
            placeholder="Search crochet pieces..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="nav-actions">
          {user ? (
            <div className="user-dropdown">
              <div className="user-profile-badge">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.name} className="user-avatar" />
                ) : (
                  <div className="user-avatar-initial">{user.name ? user.name[0] : 'U'}</div>
                )}
                <span className="user-name">{user.name.split(' ')[0]}</span>
              </div>
              <button className="my-orders-btn" onClick={openOrderHistory}>
                Orders
              </button>
              <button className="sign-out-btn" onClick={handleSignOut}>
                Sign Out
              </button>
            </div>
          ) : (
            <div ref={googleBtnRef} className="google-btn-container"></div>
          )}

          <button className="cart-btn" onClick={() => setIsCartOpen(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <span className="cart-label">Cart</span>
            {cartTotalItems > 0 && <span className="cart-badge">{cartTotalItems}</span>}
          </button>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="hero-banner">
        <div className="hero-content">
          <h1>Handmade Crochet Creations</h1>
          <p>
            One-of-a-kind cardigans, hats, and accessories lovingly hand-stitched. Powered by Stripe Apple Pay & Supabase.
          </p>
        </div>
      </section>

      {/* Category Filter Pills */}
      <div className="category-bar">
        {categories.map((cat) => (
          <button
            key={cat}
            className={`category-pill ${selectedCategory === cat ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Main Content & Product Catalog */}
      <main className="catalog-section">
        {error && <div className="status-banner error">{error}</div>}

        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading boutique pieces from Supabase...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="empty-state">
            <p>No products found matching your search.</p>
          </div>
        ) : (
          <div className="products-grid">
            {filteredProducts.map((product) => (
              <div className="product-card" key={product.id}>
                <div className="product-image-wrap">
                  <img src={product.image_url} alt={product.title} loading="lazy" />
                  <span className="product-category-tag">{product.category}</span>
                  {product.badge && <span className="product-badge-accent">{product.badge}</span>}
                </div>
                <div className="product-info">
                  <h3 className="product-title">{product.title}</h3>
                  <p className="product-description">{product.description}</p>
                  
                  {product.care_instructions && (
                    <div className="product-care-hint">
                      🧶 {product.care_instructions}
                    </div>
                  )}

                  <div className="product-stock-badge">
                    {product.stock <= 2 ? `🔥 Only ${product.stock} left in stock!` : `Stock: ${product.stock}`}
                  </div>
                  <div className="product-footer">
                    <span className="product-price">£{Number(product.price).toFixed(2)}</span>
                    <button
                      className="add-to-cart-btn"
                      disabled={product.stock <= 0}
                      onClick={() => addToCart(product)}
                    >
                      {product.stock > 0 ? 'Add to Bag' : 'Sold Out'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Slide-Out Cart Drawer */}
      {isCartOpen && (
        <div className="cart-overlay" onClick={() => setIsCartOpen(false)}>
          <div className="cart-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="cart-drawer-header">
              <h2>Your Shopping Bag ({cartTotalItems})</h2>
              <button className="close-btn" onClick={() => setIsCartOpen(false)}>
                &times;
              </button>
            </div>

            <div className="cart-drawer-body">
              {cart.length === 0 ? (
                <div className="cart-empty">
                  <p>Your bag is empty.</p>
                  <button className="shop-now-btn" onClick={() => setIsCartOpen(false)}>
                    Browse Pieces
                  </button>
                </div>
              ) : (
                <div className="cart-items-list">
                  {cart.map((item) => (
                    <div className="cart-item" key={item.id}>
                      <img src={item.image_url} alt={item.title} className="cart-item-img" />
                      <div className="cart-item-details">
                        <h4>{item.title}</h4>
                        <div className="cart-item-price">£{Number(item.price).toFixed(2)}</div>
                        <div className="cart-quantity-row">
                          <button onClick={() => updateQuantity(item.id, -1)}>-</button>
                          <span>{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, 1)}>+</button>
                          <button
                            className="remove-btn"
                            onClick={() => removeFromCart(item.id)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="cart-drawer-footer">
                <div className="subtotal-row">
                  <span>Subtotal</span>
                  <span className="subtotal-amount">£{cartSubtotal.toFixed(2)}</span>
                </div>
                <p className="shipping-note">Free UK delivery applied at checkout.</p>
                <button
                  className="checkout-btn"
                  onClick={() => setIsCheckoutOpen(true)}
                >
                  Pay with Stripe • £{cartSubtotal.toFixed(2)}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checkout Modal with Stripe Button */}
      {isCheckoutOpen && (
        <div className="modal-backdrop" onClick={() => !submittingOrder && setIsCheckoutOpen(false)}>
          <div className="checkout-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Checkout with Stripe</h2>
              <button
                className="close-btn"
                disabled={submittingOrder}
                onClick={() => setIsCheckoutOpen(false)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleStripeCheckout} className="checkout-form">
              {orderError && <div className="status-banner error">{orderError}</div>}

              {user && (
                <div className="auth-autofill-banner">
                  Signed in as <strong>{user.email}</strong>. Details auto-filled!
                </div>
              )}

              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Alex Morgan"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Email Address (Confirmation & receipt sent here)</label>
                <input
                  type="email"
                  placeholder="e.g. alex@example.com"
                  required
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Delivery Address</label>
                <textarea
                  rows="3"
                  placeholder="House number, Street, City, Postcode"
                  required
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                />
              </div>

              <div className="checkout-summary-box">
                <div className="summary-line">
                  <span>Items ({cartTotalItems}):</span>
                  <span>£{cartSubtotal.toFixed(2)}</span>
                </div>
                <div className="summary-line">
                  <span>Delivery:</span>
                  <span className="free-tag">FREE</span>
                </div>
                <div className="summary-line total-line">
                  <span>Total to Pay:</span>
                  <span>£{cartSubtotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="stripe-secure-badges">
                <span>🔒 256-bit Encrypted Checkout</span>
                <span className="payment-icons-text">💳 Cards • 🍎 Apple Pay • G Pay</span>
              </div>

              <button
                type="submit"
                className="stripe-pay-btn"
                disabled={submittingOrder}
              >
                {submittingOrder ? 'Connecting to Stripe...' : `Pay £${cartSubtotal.toFixed(2)} with Stripe / Apple Pay`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Order Confirmed Celebratory Modal */}
      {confirmedOrder && (
        <div className="modal-backdrop" onClick={() => setConfirmedOrder(null)}>
          <div className="success-modal" onClick={(e) => e.stopPropagation()}>
            <div className="success-icon-wrap">✓</div>
            <h2>Payment Successful!</h2>
            <p className="order-number">Order ID: #{confirmedOrder.order_id}</p>
            <p className="order-details-text">
              Total Paid: <strong>£{Number(confirmedOrder.total_amount).toFixed(2)}</strong> via Stripe
            </p>

            <div className="email-status-box">
              <span className="email-icon">✉️</span>
              <div>
                <strong>Mailgun Confirmation:</strong>
                <p>
                  {confirmedOrder.email_sent
                    ? `Receipt sent to ${confirmedOrder.customer_email}`
                    : `Order recorded in Supabase! (${confirmedOrder.email_status})`}
                </p>
              </div>
            </div>

            <button
              className="continue-btn"
              onClick={() => setConfirmedOrder(null)}
            >
              Continue Shopping
            </button>
          </div>
        </div>
      )}

      {/* My Orders Modal */}
      {isHistoryOpen && (
        <div className="modal-backdrop" onClick={() => setIsHistoryOpen(false)}>
          <div className="history-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>My Order History</h2>
              <button className="close-btn" onClick={() => setIsHistoryOpen(false)}>
                &times;
              </button>
            </div>

            <div className="history-modal-body">
              {loadingOrders ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading your past orders...</p>
                </div>
              ) : myOrders.length === 0 ? (
                <p className="empty-state">You haven't placed any orders with this account yet.</p>
              ) : (
                <div className="orders-list">
                  {myOrders.map((order) => (
                    <div className="order-history-card" key={order.id}>
                      <div className="order-history-header">
                        <div>
                          <strong>Order #{order.id}</strong>
                          <span className="order-date">
                            {order.created_at ? new Date(order.created_at).toLocaleDateString() : ''}
                          </span>
                        </div>
                        <span className="order-badge">{order.status}</span>
                      </div>
                      <div className="order-history-footer">
                        <span>Total: <strong>£{Number(order.total_amount).toFixed(2)}</strong></span>
                        <span className="order-ship-to">Delivery to: {order.shipping_address}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="footer">
        <p>© 2026 CrochetStudio Boutique. Powered by Stripe, Supabase PostgreSQL, Mailgun, and React.</p>
      </footer>
    </div>
  )
}
