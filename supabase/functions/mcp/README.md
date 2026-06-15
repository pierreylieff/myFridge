# myFridge — serveur MCP distant (Edge Function) pour Claude.ai

Serveur MCP **multi-utilisateurs** hébergé sur Supabase Edge Functions, conçu pour être ajouté comme **connecteur personnalisé** dans Claude (claude.ai). Chaque utilisateur se connecte avec son propre compte Supabase ; les **RLS** garantissent qu'il ne voit que ses recettes, son frigo et sa liste.

- **Endpoint MCP** : `https://acrozolmszroqegeluch.supabase.co/functions/v1/mcp`
- **Transport** : Streamable HTTP (Web standard)
- **Auth** : OAuth 2.1 — Supabase Auth est le serveur d'autorisation ; l'Edge Function est une *ressource protégée*.

## Architecture

```
Claude.ai ──(1) GET endpoint sans token──► Edge Function ──401 + WWW-Authenticate(resource_metadata)
Claude.ai ──(2) GET /.well-known/oauth-protected-resource──► { authorization_servers: [supabase /auth/v1] }
Claude.ai ──(3) OAuth 2.1 (DCR + PKCE) ───► Supabase Auth  (login email / Google / Apple + consentement)
Claude.ai ──(4) POST endpoint + Bearer(JWT) ─► Edge Function ─► Supabase (client scopté au JWT, RLS) ─► données de l'utilisateur
```

## Tools exposés

`list_recipes`, `get_recipe`, `list_fridge`, `list_shopping_list`, `add_shopping_item`, `add_recipe_to_shopping_list`.

## État

| Élément | État |
|--------|------|
| Edge Function déployée (`verify_jwt=false`) | ✅ |
| Protected Resource Metadata (`/.well-known/oauth-protected-resource`) | ✅ vérifié (200) |
| Challenge `401 WWW-Authenticate` | ✅ vérifié |
| OIDC discovery Supabase (PKCE S256, authz code + refresh) | ✅ public |
| **Serveur OAuth 2.1 Supabase activé** | ❌ à activer (voir ci-dessous) |
| **Dynamic Client Registration (DCR)** | ❌ à activer |
| **Page de consentement `/oauth/consent`** | ✅ implémentée (`src/screens/OAuthConsent.tsx`) |

## Étapes restantes (côté toi)

### 1. Activer le serveur OAuth 2.1 + DCR

Dashboard → **Authentication → OAuth Server**, ou via `supabase/config.toml` :

```toml
[auth.oauth_server]
enabled = true
authorization_url_path = "/oauth/consent"
allow_dynamic_registration = true
```

> `allow_dynamic_registration = true` est **indispensable** : sans lui, le `registration_endpoint` reste vide et Claude.ai ne peut pas s'enregistrer (constaté lors des tests).

### 2. Page de consentement (déjà implémentée)

`src/screens/OAuthConsent.tsx` (route `/oauth/consent`) gère le login en place (email / Google / Apple) puis l'approbation via `supabase.auth.oauth.getAuthorizationDetails` / `approveAuthorization` / `denyAuthorization`. Pense à ajouter l'URL `…/oauth/consent` à la liste des **Redirect URLs** autorisées (Authentication → URL Configuration) pour le retour après login social.

### 3. Fournisseurs Google / Apple

Email/mot de passe fonctionne déjà. Pour Google/Apple, configure-les dans Dashboard → **Authentication → Providers** (clés OAuth tierces).

### 4. Ajouter le connecteur dans Claude

claude.ai → Settings → Connectors → *Add custom connector* → URL :
`https://acrozolmszroqegeluch.supabase.co/functions/v1/mcp`
Claude découvre l'OAuth, propose la connexion, l'utilisateur se logge → ses données sont accessibles.

## Tester le chemin authentifié dès maintenant (sans OAuth)

Depuis `mcp-server/`, avec un mot de passe renseigné dans `.env` :

```powershell
npx tsx src/test-remote.ts
```

Le script se connecte en email/mot de passe, récupère un JWT et appelle le endpoint MCP distant exactement comme Claude le ferait après l'OAuth. Cela valide transport + auth + RLS de bout en bout.

## Redéployer après modification

Via le MCP Supabase (`deploy_edge_function`, `verify_jwt=false`) ou en CLI :

```bash
supabase functions deploy --no-verify-jwt mcp
```
