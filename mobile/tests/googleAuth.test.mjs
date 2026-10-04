import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticateWithGoogle } from '../src/googleAuth.js';
import { loginWithGoogle, fetchAuthConfig } from '../src/api.js';

function setup(overrides = {}) {
  const calls = [];
  return {
    calls,
    options: {
      google: {
        configure(config) { calls.push(['configure', config]); },
        async hasPlayServices() { return true; },
        async signIn() { return { type: 'success', data: { idToken: 'header.payload.signature' } }; },
      },
      loadConfig: async () => ({ google_client_id: 'website-client.apps.googleusercontent.com' }),
      exchangeCredential: async (token) => { calls.push(['exchange', token]); return { success: true, user: { id: 7 } }; },
      ...overrides,
    },
  };
}

test('Google account proof is exchanged for the existing backend user', async () => {
  const { options, calls } = setup();
  const result = await authenticateWithGoogle(options);
  assert.equal(result.user.id, 7);
  assert.deepEqual(calls, [
    ['configure', { webClientId: 'website-client.apps.googleusercontent.com' }],
    ['exchange', 'header.payload.signature'],
  ]);
});

test('cancelling Google sign-in does not log into the backend', async () => {
  const { options, calls } = setup();
  options.google.signIn = async () => ({ type: 'cancelled' });
  assert.equal(await authenticateWithGoogle(options), null);
  assert.equal(calls.filter(([name]) => name === 'exchange').length, 0);
});

test('missing Google proof cannot fall back to an email login', async () => {
  const { options, calls } = setup();
  options.google.signIn = async () => ({ type: 'success', data: { user: { email: 'shopper@example.com' } } });
  await assert.rejects(authenticateWithGoogle(options), /could not verify/);
  assert.equal(calls.filter(([name]) => name === 'exchange').length, 0);
});

test('missing backend configuration stops Google sign-in', async () => {
  const { options, calls } = setup({ loadConfig: async () => ({}) });
  await assert.rejects(authenticateWithGoogle(options), /not configured/);
  assert.deepEqual(calls, []);
});

test('Play services failure does not exchange credentials', async () => {
  const { options, calls } = setup();
  options.google.hasPlayServices = async () => { throw new Error('play services unavailable'); };
  await assert.rejects(authenticateWithGoogle(options), /play services unavailable/);
  assert.equal(calls.filter(([name]) => name === 'exchange').length, 0);
});

test('the API client rejects email-only credentials before making a request', async (t) => {
  let called = false;
  t.mock.method(globalThis, 'fetch', async () => { called = true; });
  await assert.rejects(loginWithGoogle('shopper@example.com'), /verified Google/);
  assert.equal(called, false);
});

test('the API client uses the web authentication endpoint and verified credential', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://crochet-boutique-0si4.onrender.com/api/auth/google');
    assert.deepEqual(JSON.parse(options.body), { credential: 'header.payload.signature' });
    return { ok: true, json: async () => ({ success: true, user: { id: 7 } }) };
  });
  assert.equal((await loginWithGoogle('header.payload.signature')).user.id, 7);
});

test('backend rejection cannot be treated as a successful login', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, json: async () => ({ error: 'Invalid Google authentication token' }) }));
  await assert.rejects(loginWithGoogle('header.payload.signature'), /Invalid Google/);
});

test('configuration errors are visible instead of becoming an empty configuration', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false }));
  await assert.rejects(fetchAuthConfig(), /Could not load sign-in settings/);
});
