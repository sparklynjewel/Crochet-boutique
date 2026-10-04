import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Image,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { fetchProducts, placeOrder, loginUser, API_BASE_URL } from './src/api';
import { useSyncedCart } from './src/useSyncedCart';
import { Ionicons, FontAwesome } from '@expo/vector-icons';

export default function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // User auth state
  const [user, setUser] = useState(null);
  const { cart, setCart, cartError, flushCart } = useSyncedCart(user?.id, API_BASE_URL);
  const [loginEmail, setLoginEmail] = useState('');
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  // Checkout form state
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState(null);

  const categories = ['All', 'Cardigans', 'Hats & Beanies', 'Tops', 'Bags', 'Accessories'];

  useEffect(() => {
    loadProducts();
  }, [selectedCategory]);

  async function loadProducts() {
    setLoading(true);
    const data = await fetchProducts(selectedCategory);
    setProducts(data);
    setLoading(false);
  }

  async function handleLogin() {
    if (!loginEmail || !loginEmail.includes('@')) {
      alert('Please enter a valid email.');
      return;
    }
    const res = await loginUser(loginEmail, 'Odofin Moronke');
    if (res.success && res.user) {
      setUser(res.user);
      setCustomerEmail(res.user.email);
      setCustomerName(res.user.name);
      setIsLoginOpen(false);
      alert(`Signed in as ${res.user.name}! Loading your saved cart.`);
    } else {
      alert('Login failed');
    }
  }

  function addToCart(product) {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setIsCartOpen(true);
  }

  function updateQuantity(productId, delta) {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  }

  function removeFromCart(productId) {
    setCart((prev) => prev.filter((item) => item.id !== productId));
  }

  const cartTotalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const filteredProducts = products.filter(
    (p) =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  async function handleCheckout() {
    if (!customerName || !customerEmail || !shippingAddress) {
      alert('Please fill out all checkout fields.');
      return;
    }

    setSubmitting(true);
    const result = await placeOrder({
      customer_name: customerName,
      customer_email: customerEmail,
      shipping_address: shippingAddress,
      items: cart,
      user_id: user ? user.id : null,
    });
    setSubmitting(false);

    if (result.success) {
      setConfirmedOrder(result);
      setCart([]);
      setIsCheckoutOpen(false);
      setIsCartOpen(false);
    } else {
      alert(result.error || 'Failed to place order');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.brandBadge}>MOBILE BOUTIQUE</Text>
          <Text style={styles.brandTitle}>CrochetStudio</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {user ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={styles.userBadge}>
                <Text style={styles.userBadgeText}>Hi, {user.name.split(' ')[0]}</Text>
              </View>
              <TouchableOpacity style={styles.signOutBtn} onPress={async () => { await flushCart(); setUser(null); alert('Signed out. Your saved cart will be here when you sign back in.'); }}>
                <Text style={styles.signOutBtnText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.googleLoginBtn} onPress={() => setIsLoginOpen(true)}>
              <FontAwesome name="google" size={14} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.googleLoginText}>Sign In</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.cartIconBtn} onPress={() => setIsCartOpen(true)}>
            <Ionicons name="bag-outline" size={24} color="#111827" />
            {cartTotalItems > 0 && (
              <View style={styles.badgeCount}>
                <Text style={styles.badgeText}>{cartTotalItems}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Search & Categories */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#6b7280" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search crochet pieces..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#9ca3af"
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.categoryPill, selectedCategory === cat && styles.categoryPillActive]}
            onPress={() => setSelectedCategory(cat)}
          >
            <Text style={[styles.categoryText, selectedCategory === cat && styles.categoryTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Product List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#635bff" />
          <Text style={styles.loadingText}>Loading collection from Supabase...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <View style={styles.productCard}>
              <Image source={{ uri: item.image_url }} style={styles.productImage} />
              <View style={styles.productInfo}>
                <Text style={styles.productCategory}>{item.category}</Text>
                <Text style={styles.productTitle}>{item.title}</Text>
                <Text style={styles.productDesc} numberOfLines={2}>{item.description}</Text>
                <View style={styles.productFooter}>
                  <Text style={styles.productPrice}>£{Number(item.price).toFixed(2)}</Text>
                  <TouchableOpacity style={styles.addButton} onPress={() => addToCart(item)}>
                    <Text style={styles.addButtonText}>Add to Bag</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        />
      )}

      {/* Login Modal */}
      <Modal visible={isLoginOpen} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: 280 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sign In & Sync Cart</Text>
              <TouchableOpacity onPress={() => setIsLoginOpen(false)}>
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>
            <Text style={styles.label}>Google Account Email</Text>
            <TextInput style={styles.input} placeholder="kiah4u2c@gmail.com" value={loginEmail} onChangeText={setLoginEmail} keyboardType="email-address" autoCapitalize="none" />
            <TouchableOpacity style={styles.checkoutBtn} onPress={handleLogin}>
              <Text style={styles.checkoutBtnText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Cart Modal with +/- Quantity Controls */}
      <Modal visible={isCartOpen} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Your Shopping Bag ({cartTotalItems})</Text>
              <TouchableOpacity onPress={() => setIsCartOpen(false)}>
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>

            {cartError ? <Text accessibilityRole="alert">{cartError}</Text> : null}
            {cart.length === 0 ? (
              <View style={styles.centerBox}>
                <Text style={styles.emptyText}>Your bag is empty.</Text>
              </View>
            ) : (
              <ScrollView style={{ flex: 1 }}>
                {cart.map((item) => (
                  <View style={styles.cartItemRow} key={item.id}>
                    <Image source={{ uri: item.image_url }} style={styles.cartItemImg} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.cartItemTitle}>{item.title}</Text>
                      <Text style={styles.cartItemPrice}>£{Number(item.price).toFixed(2)}</Text>
                      
                      {/* +/- Quantity Row */}
                      <View style={styles.quantityRow}>
                        <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item.id, -1)}>
                          <Text style={styles.qtyBtnText}>-</Text>
                        </TouchableOpacity>
                        <Text style={styles.qtyNumber}>{item.quantity}</Text>
                        <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item.id, 1)}>
                          <Text style={styles.qtyBtnText}>+</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={{ marginLeft: 16 }} onPress={() => removeFromCart(item.id)}>
                          <Ionicons name="trash-outline" size={18} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}

            {cart.length > 0 && (
              <View style={styles.modalFooter}>
                <View style={styles.subtotalRow}>
                  <Text style={styles.subtotalLabel}>Subtotal</Text>
                  <Text style={styles.subtotalValue}>£{cartSubtotal.toFixed(2)}</Text>
                </View>
                <TouchableOpacity
                  style={styles.checkoutBtn}
                  onPress={() => {
                    setIsCartOpen(false);
                    setIsCheckoutOpen(true);
                  }}
                >
                  <Text style={styles.checkoutBtnText}>Proceed to Checkout</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Checkout Modal */}
      <Modal visible={isCheckoutOpen} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Checkout Details</Text>
              <TouchableOpacity onPress={() => setIsCheckoutOpen(false)}>
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 16 }}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput style={styles.input} placeholder="e.g. Odofin Moronke" value={customerName} onChangeText={setCustomerName} />

              <Text style={styles.label}>Email Address</Text>
              <TextInput style={styles.input} placeholder="e.g. kiah4u2c@gmail.com" value={customerEmail} onChangeText={setCustomerEmail} keyboardType="email-address" />

              <Text style={styles.label}>Delivery Address</Text>
              <TextInput style={[styles.input, { height: 80 }]} placeholder="Street, City, Postcode" value={shippingAddress} onChangeText={setShippingAddress} multiline />

              <TouchableOpacity style={[styles.checkoutBtn, { marginTop: 24 }]} onPress={handleCheckout} disabled={submitting}>
                <Text style={styles.checkoutBtnText}>{submitting ? 'Placing Order...' : `Place Order (£${cartSubtotal.toFixed(2)})`}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal visible={!!confirmedOrder} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: 320, alignItems: 'center', justifyContent: 'center' }]}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark" size={36} color="#16a34a" />
            </View>
            <Text style={styles.successTitle}>Order Placed Successfully!</Text>
            <Text style={styles.successSubtitle}>Order ID: #{confirmedOrder?.order_id}</Text>
            <Text style={styles.successDesc}>A receipt has been dispatched via Mailgun.</Text>
            <TouchableOpacity style={[styles.checkoutBtn, { width: '100%', marginTop: 20 }]} onPress={() => setConfirmedOrder(null)}>
              <Text style={styles.checkoutBtnText}>Continue Shopping</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  brandBadge: { fontSize: 9, fontWeight: '700', color: '#2563eb', letterSpacing: 0.5 },
  brandTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  googleLoginBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#4285F4', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6 },
  googleLoginText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  userBadge: { paddingHorizontal: 8, paddingVertical: 6, backgroundColor: '#f1f5f9', borderRadius: 6 },
  userBadgeText: { fontSize: 12, fontWeight: '700', color: '#2563eb' },
  signOutBtn: { paddingHorizontal: 6, paddingVertical: 6, borderWidth: 1, borderColor: '#fca5a5', borderRadius: 6, backgroundColor: '#fef2f2' },
  signOutBtnText: { fontSize: 11, fontWeight: '600', color: '#ef4444' },
  cartIconBtn: { position: 'relative', padding: 8, backgroundColor: '#f3f4f6', borderRadius: 20 },
  badgeCount: { position: 'absolute', top: 2, right: 2, backgroundColor: '#ef4444', borderRadius: 10, width: 18, height: 18, justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', height: 44 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#111827' },
  categoryScroll: { paddingHorizontal: 16, marginVertical: 12, maxHeight: 40 },
  categoryPill: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#e5e7eb', marginRight: 8, height: 36 },
  categoryPillActive: { backgroundColor: '#111827', borderColor: '#111827' },
  categoryText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  categoryTextActive: { color: '#fff' },
  listContainer: { padding: 16, paddingBottom: 40 },
  productCard: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', marginBottom: 16, borderWidth: 1, borderColor: '#e5e7eb', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  productImage: { width: '100%', height: 200, resizeMode: 'cover' },
  productInfo: { padding: 14 },
  productCategory: { fontSize: 11, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 },
  productTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
  productDesc: { fontSize: 13, color: '#4b5563', marginBottom: 12, lineHeight: 18 },
  productFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 10 },
  productPrice: { fontSize: 18, fontWeight: '800', color: '#111827' },
  addButton: { backgroundColor: '#111827', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6 },
  addButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  loadingText: { marginTop: 12, color: '#6b7280', fontSize: 14 },
  emptyText: { color: '#6b7280', fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '80%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingBottom: 14, marginBottom: 14 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  cartItemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', paddingBottom: 14 },
  cartItemImg: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#f1f5f9' },
  cartItemTitle: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 2 },
  cartItemPrice: { fontSize: 13, color: '#6b7280', fontWeight: '500', marginBottom: 6 },
  quantityRow: { flexDirection: 'row', alignItems: 'center' },
  qtyBtn: { width: 28, height: 28, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 16, fontWeight: 'bold', color: '#374151' },
  qtyNumber: { marginHorizontal: 12, fontSize: 14, fontWeight: '700', color: '#111827' },
  modalFooter: { borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 16 },
  subtotalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  subtotalLabel: { fontSize: 16, fontWeight: '600', color: '#374151' },
  subtotalValue: { fontSize: 18, fontWeight: '800', color: '#111827' },
  checkoutBtn: { backgroundColor: '#16a34a', padding: 14, borderRadius: 8, alignItems: 'center' },
  checkoutBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 16, backgroundColor: '#f9fafb' },
  successIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#dcfce7', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  successTitle: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 6 },
  successSubtitle: { fontSize: 15, fontWeight: '700', color: '#2563eb', marginBottom: 8 },
  successDesc: { fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 20 },
});
