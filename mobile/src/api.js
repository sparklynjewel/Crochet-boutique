export const API_BASE_URL = 'https://crochet-boutique-0si4.onrender.com';

export async function fetchProducts(category = '') {
  try {
    let url = `${API_BASE_URL}/api/products`;
    if (category && category !== 'All') {
      url += `?category=${encodeURIComponent(category)}`;
    }
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch products');
    return await response.json();
  } catch (error) {
    console.error('API Error (fetchProducts):', error);
    return [];
  }
}

export async function loginUser(email, name) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: email, name: name || 'Odofin Moronke' }),
    });
    return await response.json();
  } catch (error) {
    console.error('API Error (loginUser):', error);
    return { success: false };
  }
}

export async function fetchUserCart(userId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/cart?user_id=${userId}`);
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error('API Error (fetchUserCart):', error);
    return [];
  }
}

export async function syncUserCart(userId, items) {
  try {
    await fetch(`${API_BASE_URL}/api/cart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, items }),
    });
  } catch (error) {
    console.error('API Error (syncUserCart):', error);
  }
}

export async function placeOrder(orderData) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData),
    });
    return await response.json();
  } catch (error) {
    console.error('API Error (placeOrder):', error);
    return { success: false, error: error.message };
  }
}
