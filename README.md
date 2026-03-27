# KARAPSİKO — Deploy Rehberi

## 1. GitHub'a Yükle

Cmd'de karapsiko-deploy klasörüne gir ve şu komutları sırayla çalıştır:

```bash
git init
git add .
git commit -m "KaraPsiko MVP"
git branch -M main
git remote add origin https://github.com/SENIN_KULLANICI_ADIN/karapsiko.git
git push -u origin main
```

**Not:** Önce github.com'da "karapsiko" adında yeni bir repo oluştur (boş, README ekleme).

## 2. Vercel'e Bağla

1. **vercel.com** → GitHub ile giriş yap
2. **"Add New Project"** tıkla
3. GitHub'daki **karapsiko** reposunu seç
4. **"Import"** tıkla
5. Framework: **Vite** otomatik algılanacak
6. **"Deploy"** tıkla

## 3. Environment Variables Ekle (ÇOK ÖNEMLİ)

Deploy bittikten sonra:

1. Vercel Dashboard → karapsiko projesi → **Settings** → **Environment Variables**
2. Şu değişkenleri ekle:

| Key | Value |
|-----|-------|
| `ANTHROPIC_API_KEY` | Claude API key'in (console.anthropic.com'dan) |
| `VITE_SUPABASE_URL` | https://fhpfbykcnfcqbzkthbgn.supabase.co |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key'in |
| `VITE_SHOPIER_URL` | Shopier ürün linkin |
| `VITE_FREE_LIMIT` | 3 |
| `VITE_PRO_PRICE` | ₺200/ay |

3. **"Save"** tıkla
4. **Deployments** sekmesine git → en son deploy'un yanındaki **"..."** → **"Redeploy"** tıkla

## 4. Supabase Redirect URL Güncelle

Google login kullanacaksan:

1. Supabase → Authentication → URL Configuration
2. **Site URL:** `https://karapsiko.vercel.app` (Vercel'in verdiği URL)
3. **Redirect URLs:** `https://karapsiko.vercel.app` ekle

## 5. Test Et

Vercel'in verdiği URL'yi aç (karapsiko.vercel.app gibi). Kayıt ol, giriş yap, mod seç, soru sor.

## Özel Domain (Opsiyonel)

Vercel → Settings → Domains → karapsiko.com gibi kendi domain'ini ekleyebilirsin.
