// ┌─────────────────────────────────────────────┐
// │  KARAPSİKO CONFIG                            │
// │                                               │
// │  Bu değerler .env dosyasından okunuyor.        │
// │  .env.example dosyasını .env olarak kopyala    │
// │  ve kendi değerlerini yaz.                     │
// └─────────────────────────────────────────────┘

export const CONFIG = {
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || "",
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
  SHOPIER_URL: import.meta.env.VITE_SHOPIER_URL || "",
  FREE_LIMIT: parseInt(import.meta.env.VITE_FREE_LIMIT || "3"),
  PRO_PRICE: import.meta.env.VITE_PRO_PRICE || "₺99/ay",
};
