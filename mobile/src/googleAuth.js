// Google proves account ownership; the shop backend returns its existing user.
export async function authenticateWithGoogle({ google, loadConfig, exchangeCredential }) {
  const config = await loadConfig();
  if (!config.google_client_id) {
    throw new Error('Google sign-in is not configured yet. Please try again after setup is complete.');
  }
  google.configure({ webClientId: config.google_client_id });
  await google.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const result = await google.signIn();
  if (result.type === 'cancelled') return null;
  if (result.type !== 'success' || !result.data?.idToken) {
    throw new Error('Google could not verify your sign-in. Please try again.');
  }
  return exchangeCredential(result.data.idToken);
}
