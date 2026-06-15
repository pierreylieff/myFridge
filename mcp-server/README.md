# myFridge — Serveur MCP

Serveur [Model Context Protocol](https://github.com/modelcontextprotocol/typescript-sdk) qui donne accès, à un client MCP (Claude Desktop, Claude Code, etc.), à trois domaines de l'app **myFridge**, directement depuis la base **Supabase** :

- 📖 **Recettes** (`recipes` + `recipe_ingredients`)
- 🧊 **Garde-manger / frigo** (`pantry_items`)
- 🛒 **Liste de courses** (`shopping_lists` + `list_items`)

## Tools exposés

| Tool | Description |
|------|-------------|
| `list_recipes` | Liste les recettes (filtre `search` sur titre/ingrédient, `favorites_only`). |
| `get_recipe` | Détail complet d'une recette (ingrédients + étapes) par `id`. |
| `list_fridge` | Contenu du garde-manger (filtres `rayon`, `expiring_within_days`). |
| `list_shopping_list` | Liste de courses active, groupée par rayon (`include_checked`). |
| `add_shopping_item` | Ajoute un article (dédoublonnage : même nom + unité ⇒ quantité cumulée). |
| `add_recipe_to_shopping_list` | Ajoute tous les ingrédients d'une recette à la liste (US9). |

## Resources exposées

- `myfridge://recipes`
- `myfridge://fridge`
- `myfridge://shopping-list`

## Configuration

1. Copier l'exemple d'environnement et le compléter :

   ```powershell
   Copy-Item .env.example .env
   ```

2. Renseigner dans `.env` :
   - `SUPABASE_URL` et `SUPABASE_ANON_KEY` (déjà pré-remplis pour le projet myFridge).
   - `MYFRIDGE_EMAIL` / `MYFRIDGE_PASSWORD` : tes identifiants myFridge.

   Le serveur se connecte avec ces identifiants : **les RLS Supabase s'appliquent**, il ne voit donc que tes propres données (recettes, frigo, liste). Aucune clé `service_role` n'est utilisée.

   > ⚠️ Le compte doit disposer d'une connexion **email/mot de passe** (pas uniquement Google/Apple). `.env` est gitignoré — ne jamais committer le mot de passe.

## Installation & build

```powershell
npm install
npm run build      # compile vers ./build
```

## Démarrage / vérification

```powershell
# Lancer le serveur (stdio)
npm start

# Inspecter visuellement avec l'inspecteur officiel MCP
npm run inspect

# Test de fumée (handshake, sans appel base de données)
npx tsx src/smoke-test.ts
```

## Brancher le serveur sur un client MCP

### Claude Code (CLI)

```powershell
claude mcp add myfridge -- node C:\dev\myfridge\mcp-server\build\index.js
```

### Claude Desktop

Ajouter à `claude_desktop_config.json` :

```json
{
  "mcpServers": {
    "myfridge": {
      "command": "node",
      "args": ["C:\\dev\\myfridge\\mcp-server\\build\\index.js"]
    }
  }
}
```

Les variables sont lues depuis le `.env` du dossier `mcp-server`. (Alternative : les passer via une clé `"env"` dans la config du client.)

## Notes

- La donnée vient en temps réel de Supabase ; aucune copie locale.
- Transport **stdio** (standard pour un serveur MCP local).
- Aligné sur le schéma SQL de l'app myFridge (rayons : `frais`, `epicerie`, `surgeles`, `boissons`, `hygiene`, `autre`).
