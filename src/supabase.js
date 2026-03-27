import { CONFIG } from "./config.js";

// Minimal Supabase client — SDK'sız, saf fetch
const supabase = {
  url: CONFIG.SUPABASE_URL,
  key: CONFIG.SUPABASE_ANON_KEY,

  headers(token) {
    return {
      "Content-Type": "application/json",
      apikey: this.key,
      Authorization: `Bearer ${token || this.key}`,
    };
  },

  async signUp(email, password) {
    const r = await fetch(`${this.url}/auth/v1/signup`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ email, password }),
    });
    return r.json();
  },

  async signIn(email, password) {
    const r = await fetch(`${this.url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ email, password }),
    });
    return r.json();
  },

  signInWithGoogle() {
    const redirect = encodeURIComponent(window.location.origin);
    window.location.href = `${this.url}/auth/v1/authorize?provider=google&redirect_to=${redirect}`;
  },

  async getUser(token) {
    const r = await fetch(`${this.url}/auth/v1/user`, {
      headers: this.headers(token),
    });
    return r.json();
  },

  async getProfile(userId, token) {
    const r = await fetch(
      `${this.url}/rest/v1/profiles?id=eq.${userId}&select=*`,
      { headers: this.headers(token) }
    );
    const data = await r.json();
    return data?.[0] || null;
  },

  async updateQueryCount(userId, count, token) {
    await fetch(`${this.url}/rest/v1/profiles?id=eq.${userId}`, {
      method: "PATCH",
      headers: this.headers(token),
      body: JSON.stringify({ query_count: count }),
    });
  },
};

export default supabase;
