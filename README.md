# myFridge 🥬

Application mobile-first de **liste de courses générée par IA**, construite en **React + TypeScript (Vite)** et **Supabase**, avec le design system *« Material 3 — vert frais »* défini dans Claude Design.

> MVP « Must » du PRD : Inscription, Onboarding, Accueil/Liste, Scan frigo (IA Claude),
> Validation des suggestions IA, Gestion manuelle de la liste, Paramètres.

---

## 1. Démarrer en local

```bash
npm install
npm run dev        # http://localhost:5173
```

Les variables d'environnement sont déjà dans `.env` (URL Supabase + clé publishable — clé publique, sans risque) :

```
VITE_SUPABASE_URL=https://acrozolmszroqegeluch.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

### Compte de démonstration
Un compte de test est déjà créé et confirmé :

```
Email    : camille.myfridge@gmail.com
Password : testpass123
```

---

## 2. ⚠️ Activer l'IA (scan + import de recettes)

Le scan **et l'import de recettes** appellent l'**API Claude** via les Edge Functions Supabase
(`analyze-scan`, `import-recipe`). Elles ont besoin d'une clé API Anthropic, à définir **une seule
fois** comme secret côté serveur :

- Dashboard Supabase → *Project Settings → Edge Functions → Secrets* → ajouter
  `ANTHROPIC_API_KEY = sk-ant-...`
- ou en CLI : `supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref acrozolmszroqegeluch`

Sans cette clé, toutes les fonctionnalités marchent **sauf** l'analyse de photo, qui affiche
un message d'erreur clair.

---

## 3. Authentification (note importante)

Le projet Supabase a la **confirmation d'email activée par défaut**. À l'inscription, l'utilisateur
reçoit donc un email de confirmation avant de pouvoir se connecter.

Pour un MVP « inscription en moins de 2 minutes », vous pouvez la désactiver :
*Dashboard → Authentication → Sign In / Providers → Email → décocher « Confirm email »*.

Les boutons **Google / Apple / Facebook / Microsoft** sont câblés (`signInWithOAuth`) ; il suffit
d'activer les providers correspondants dans *Authentication → Providers* (Microsoft = provider
**Azure**) pour qu'ils fonctionnent.

---

## 4. Architecture

```
src/
  lib/
    supabase.ts      Client Supabase
    types.ts         Types domaine (Rayon, ListItem, Profile…)
    constants.ts     Tokens métier : taxonomie des rayons, unités, seuil IA 70%
    products.ts      Référentiel produits (autocomplete + rayon par défaut)
    api.ts           CRUD liste + recettes + déduplication (règles métier PRD)
    functions.ts     Wrapper d'appel aux Edge Functions (gestion d'erreur normalisée)
  contexts/
    AuthContext.tsx  Session + profil + garde de route
    ToastContext.tsx Snackbar
  components/        BottomNav, ListItemRow, OAuthButtons, common (Logo, loaders…)
  screens/           Login, Signup, Onboarding, Home, AddEditItem, Scanner, ScanResults,
                     Recipes, RecipeDetail, ImportRecipe, Settings, Placeholder
  index.css          🎨 Design system complet (variables CSS, composants)
```

**Backend Supabase** (région `eu-west-3`, RGPD) :
- Tables : `profiles`, `pantries`, `pantry_items`, `shopping_lists`, `list_items`, `scans`,
  `recipes`, `recipe_ingredients`
- **RLS** sur toutes les tables (chaque utilisateur ne voit que ses données)
- Trigger `handle_new_user` : crée le profil + une liste active à l'inscription
- Edge Functions : `analyze-scan` (vision Claude — frigo/placards/**congélateur**/ticket),
  `import-recipe` (extraction de recette Claude), `delete-account` (suppression RGPD)
- Les **images ne sont pas stockées** : seules les données extraites sont conservées (confidentialité).

Tout le backend est versionné sous [`supabase/`](supabase/) :
```
supabase/
  config.toml              Config CLI (project_id, verify_jwt par fonction)
  migrations/              4 migrations SQL (schéma, RLS, durcissement, recettes)
  functions/
    analyze-scan/          Vision Claude (frigo/placards/congélateur/ticket)
    import-recipe/         Extraction de recette Claude
    delete-account/        Suppression de compte RGPD (service role)
```

### Reconstruire le backend depuis le repo
Avec la [CLI Supabase](https://supabase.com/docs/guides/cli) :
```bash
supabase link --project-ref <votre-ref>      # relier au projet
supabase db push                              # appliquer les migrations
supabase functions deploy                     # déployer les 3 Edge Functions
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   # clé pour l'IA
```

---

## 5. Couverture du PRD (MVP)

| US | Fonctionnalité | Statut |
|----|----------------|--------|
| US1 | Inscription (email + Google/Apple) | ✅ |
| US2 | Onboarding 3 écrans (caméra, garde-manger) | ✅ |
| US3 | Accueil / Liste groupée par rayon | ✅ |
| US4 | Scan frigo / armoires / **congélateur** (IA Claude vision) | ✅ (clé API requise) |
| US6 | Validation des suggestions IA (seuil 70 %) | ✅ |
| US7 | Gestion manuelle (ajout/édition/cochage, autocomplete) | ✅ |
| US8 | Import recette Instagram / Reels (coller lien ou légende → IA) | ✅ (clé API requise) |
| US9 | Base de recettes (recherche nom/ingrédient, ajout liste 1 tap, favoris) | ✅ |
| US11 | Paramètres (profil, permissions, déconnexion, suppression) | ✅ |

**Connexion sociale** : Google, Apple, Facebook, Microsoft (à activer côté Supabase).
**Scan congélateur** : 4ᵉ type de scan, oriente les détections vers le rayon *Surgelés*.

Onglet **Planning** : écran « bientôt disponible » (US10, hors MVP).

Design system : voir [`src/index.css`](src/index.css) — couleurs, typographie (Caveat + Nunito + JetBrains Mono),
formes, élévation et composants repris fidèlement de la planche `Design System.dc.html`.
