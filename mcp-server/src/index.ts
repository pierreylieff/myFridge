#!/usr/bin/env node
import 'dotenv/config'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import {
  getRecipes,
  getRecipe,
  getFridge,
  getShoppingList,
  addShoppingItem,
  addRecipeToShoppingList,
  addToStock,
  setPantryTarget,
  setRestock,
  syncListFromInventory,
  restockDeficit,
  type Rayon,
  type PantryItem,
  type ListItem,
  type Recipe,
} from './supabase.js'

const RAYONS = ['frais', 'epicerie', 'surgeles', 'boissons', 'hygiene', 'autre'] as const

// ---------------------------------------------------------------------------
// Helpers de formatage
// ---------------------------------------------------------------------------

const qty = (n: number | string, unit: string) => `${Number(n)} ${unit}`

function groupByRayon<T extends { rayon: Rayon }>(items: T[]): Record<string, T[]> {
  const out: Record<string, T[]> = {}
  for (const it of items) (out[it.rayon] ??= []).push(it)
  return out
}

function fridgeToText(items: PantryItem[]): string {
  if (items.length === 0) return 'Le garde-manger est vide (ou aucun produit ne correspond au filtre).'
  const groups = groupByRayon(items)
  const toBuy = items.filter((i) => restockDeficit(i) > 0).length
  const header = toBuy > 0 ? ` — ${toBuy} à racheter` : ''
  const lines: string[] = [`🧊 Garde-manger — ${items.length} produit(s)${header}\n`]
  for (const rayon of Object.keys(groups).sort()) {
    lines.push(`▸ ${rayon}`)
    for (const it of groups[rayon]) {
      const exp = it.expiry_date ? ` — péremption ${it.expiry_date}` : ''
      // « ce que j'ai » + éventuelle cible et manque associé.
      const deficit = restockDeficit(it)
      let stock = `j'ai ${qty(it.quantity, it.unit)}`
      if (it.target_qty != null) stock += `, cible ${it.target_qty}`
      const flag = deficit > 0 ? ` ⚠️ manque ${qty(deficit, it.unit)}` : ''
      lines.push(`   • ${it.name} (${stock})${flag}${exp} [id: ${it.id}]`)
    }
  }
  return lines.join('\n')
}

function listToText(items: ListItem[]): string {
  if (items.length === 0) return 'La liste de courses est vide.'
  const groups = groupByRayon(items)
  const lines: string[] = [`🛒 Liste de courses — ${items.length} article(s)\n`]
  for (const rayon of Object.keys(groups).sort()) {
    lines.push(`▸ ${rayon}`)
    for (const it of groups[rayon]) {
      const box = it.checked ? '☑' : '☐'
      lines.push(`   ${box} ${it.name} (${qty(it.quantity, it.unit)}) [${it.origin}]`)
    }
  }
  return lines.join('\n')
}

function recipesToText(recipes: Recipe[]): string {
  if (recipes.length === 0) return 'Aucune recette trouvée.'
  return [
    `📖 ${recipes.length} recette(s)\n`,
    ...recipes.map((r) => {
      const star = r.favorite ? '⭐ ' : ''
      const n = r.recipe_ingredients?.length ?? 0
      return `• ${star}${r.title} — ${n} ingrédient(s) [id: ${r.id}]`
    }),
  ].join('\n')
}

function recipeDetailToText(r: Recipe): string {
  const lines = [`📖 ${r.favorite ? '⭐ ' : ''}${r.title}`, `id: ${r.id}`]
  if (r.source_url) lines.push(`source: ${r.source_url}`)
  lines.push('\nIngrédients :')
  for (const i of r.recipe_ingredients ?? []) {
    lines.push(`   • ${i.name} (${qty(i.quantity, i.unit)}) — ${i.rayon}`)
  }
  if (r.steps?.length) {
    lines.push('\nÉtapes :')
    r.steps.forEach((s, idx) => lines.push(`   ${idx + 1}. ${s}`))
  }
  return lines.join('\n')
}

/** Construit un résultat MCP : texte lisible + JSON structuré dans le même payload. */
function result(text: string, data: unknown) {
  return {
    content: [
      { type: 'text' as const, text },
      { type: 'text' as const, text: '```json\n' + JSON.stringify(data, null, 2) + '\n```' },
    ],
  }
}

function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  return {
    isError: true,
    content: [{ type: 'text' as const, text: `Erreur : ${message}` }],
  }
}

// ---------------------------------------------------------------------------
// Serveur
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: 'myfridge',
  version: '1.0.0',
})

// ----- RECETTES -----------------------------------------------------------

server.registerTool(
  'list_recipes',
  {
    title: 'Lister les recettes',
    description:
      'Liste les recettes enregistrées. Filtre optionnel par texte (titre ou nom d’ingrédient) et/ou favoris uniquement.',
    inputSchema: {
      search: z.string().optional().describe('Texte à chercher dans le titre ou les ingrédients'),
      favorites_only: z.boolean().optional().describe('Ne retourner que les recettes favorites'),
    },
  },
  async ({ search, favorites_only }) => {
    try {
      const recipes = await getRecipes({ search, favoritesOnly: favorites_only })
      return result(recipesToText(recipes), recipes)
    } catch (err) {
      return errorResult(err)
    }
  },
)

server.registerTool(
  'get_recipe',
  {
    title: 'Détail d’une recette',
    description: 'Retourne le détail complet d’une recette (ingrédients + étapes) à partir de son id.',
    inputSchema: {
      id: z.string().describe('Identifiant (uuid) de la recette'),
    },
  },
  async ({ id }) => {
    try {
      const recipe = await getRecipe(id)
      if (!recipe) return errorResult(new Error(`Recette introuvable : ${id}`))
      return result(recipeDetailToText(recipe), recipe)
    } catch (err) {
      return errorResult(err)
    }
  },
)

// ----- GARDE-MANGER / FRIGO ----------------------------------------------

server.registerTool(
  'list_fridge',
  {
    title: 'Contenu du frigo / garde-manger',
    description:
      'Liste les produits présents dans le garde-manger (frigo, armoires, congélateur). Filtres optionnels par rayon et/ou produits proches de la péremption.',
    inputSchema: {
      rayon: z.enum(RAYONS).optional().describe('Filtrer par rayon'),
      expiring_within_days: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Ne garder que les produits dont la péremption est dans X jours ou moins'),
    },
  },
  async ({ rayon, expiring_within_days }) => {
    try {
      const items = await getFridge({ rayon, expiringWithinDays: expiring_within_days })
      return result(fridgeToText(items), items)
    } catch (err) {
      return errorResult(err)
    }
  },
)

// ----- LISTE DE COURSES ---------------------------------------------------

server.registerTool(
  'list_shopping_list',
  {
    title: 'Liste de courses',
    description:
      'Retourne la liste de courses active, regroupée par rayon. Par défaut, masque les articles déjà cochés.',
    inputSchema: {
      include_checked: z.boolean().optional().describe('Inclure aussi les articles déjà cochés'),
    },
  },
  async ({ include_checked }) => {
    try {
      const { items } = await getShoppingList({ includeChecked: include_checked })
      return result(listToText(items), items)
    } catch (err) {
      return errorResult(err)
    }
  },
)

server.registerTool(
  'add_shopping_item',
  {
    title: 'Ajouter un article à la liste',
    description:
      'Ajoute un article à la liste de courses active (dédoublonnage : même nom + même unité => quantité cumulée). Nécessite un utilisateur ciblé.',
    inputSchema: {
      name: z.string().describe('Nom du produit'),
      rayon: z.enum(RAYONS).default('autre').describe('Rayon du produit'),
      quantity: z.number().positive().default(1).describe('Quantité'),
      unit: z.string().default('piece').describe('Unité (piece, g, kg, mL, L...)'),
    },
  },
  async ({ name, rayon, quantity, unit }) => {
    try {
      const item = await addShoppingItem({ name, rayon, quantity, unit })
      return result(`✅ Ajouté : ${item.name} (${qty(item.quantity, item.unit)})`, item)
    } catch (err) {
      return errorResult(err)
    }
  },
)

server.registerTool(
  'add_recipe_to_shopping_list',
  {
    title: 'Ajouter les ingrédients d’une recette à la liste',
    description:
      'Ajoute tous les ingrédients d’une recette à la liste de courses active (US9). Nécessite un utilisateur ciblé.',
    inputSchema: {
      recipe_id: z.string().describe('Identifiant (uuid) de la recette'),
    },
  },
  async ({ recipe_id }) => {
    try {
      const count = await addRecipeToShoppingList(recipe_id)
      return result(`✅ ${count} ingrédient(s) ajouté(s) à la liste de courses.`, { added: count })
    } catch (err) {
      return errorResult(err)
    }
  },
)

// ----- GESTION DU STOCK (cible / réassort) --------------------------------

server.registerTool(
  'add_to_stock',
  {
    title: 'Ajouter un produit au stock',
    description:
      'Ajoute (ou fusionne) un produit dans le garde-manger : « ce que j’ai ». Déduplication par nom + unité (quantités cumulées). La cible est optionnelle.',
    inputSchema: {
      name: z.string().describe('Nom du produit'),
      rayon: z.enum(RAYONS).default('autre').describe('Rayon du produit'),
      quantity: z.number().nonnegative().default(1).describe('Quantité en stock (« ce que j’ai »)'),
      unit: z.string().default('piece').describe('Unité (piece, g, kg, mL, L...)'),
      target_qty: z
        .number()
        .positive()
        .optional()
        .describe('Quantité souhaitée (« ce que je devrais avoir »). Optionnel.'),
    },
  },
  async ({ name, rayon, quantity, unit, target_qty }) => {
    try {
      const item = await addToStock({ name, rayon, quantity, unit, target_qty })
      return result(`✅ Stock : ${item.name} (j'ai ${qty(item.quantity, item.unit)})`, item)
    } catch (err) {
      return errorResult(err)
    }
  },
)

server.registerTool(
  'set_pantry_target',
  {
    title: 'Définir la quantité cible d’un produit',
    description:
      'Définit la quantité souhaitée (« ce que je devrais avoir ») d’un produit du stock, par id. Passez null pour effacer la cible.',
    inputSchema: {
      id: z.string().describe('Identifiant (uuid) du produit du stock'),
      target_qty: z
        .number()
        .nonnegative()
        .nullable()
        .describe('Quantité cible, ou null pour effacer'),
    },
  },
  async ({ id, target_qty }) => {
    try {
      const item = await setPantryTarget(id, target_qty)
      const deficit = restockDeficit(item)
      const note = deficit > 0 ? ` — manque ${qty(deficit, item.unit)}` : ''
      return result(
        `🎯 Cible de ${item.name} : ${target_qty == null ? 'aucune' : target_qty}${note}`,
        item,
      )
    } catch (err) {
      return errorResult(err)
    }
  },
)

server.registerTool(
  'mark_restock',
  {
    title: 'Marquer un produit « à racheter »',
    description:
      'Marque (ou démarque) un produit du stock comme « à racheter ». Utile quand aucune cible n’est définie.',
    inputSchema: {
      id: z.string().describe('Identifiant (uuid) du produit du stock'),
      needs_restock: z.boolean().default(true).describe('true = à racheter, false = retire le marquage'),
    },
  },
  async ({ id, needs_restock }) => {
    try {
      const item = await setRestock(id, needs_restock)
      return result(
        `${needs_restock ? '🛒' : '✓'} ${item.name} ${needs_restock ? 'marqué à racheter' : 'retiré des produits à racheter'}.`,
        item,
      )
    } catch (err) {
      return errorResult(err)
    }
  },
)

server.registerTool(
  'sync_shopping_list',
  {
    title: 'Compléter la liste depuis le stock',
    description:
      'Pousse vers la liste de courses tout produit en déficit (cible − réel) ou marqué « à racheter ». Retourne le nombre d’articles ajoutés.',
    inputSchema: {},
  },
  async () => {
    try {
      const count = await syncListFromInventory()
      const text =
        count === 0
          ? 'Rien à racheter — le stock est complet 👍'
          : `✅ ${count} article(s) ajouté(s) à la liste de courses depuis le stock.`
      return result(text, { added: count })
    } catch (err) {
      return errorResult(err)
    }
  },
)

// ---------------------------------------------------------------------------
// Resources (accès en lecture, exposé comme contexte navigable)
// ---------------------------------------------------------------------------

server.registerResource(
  'recipes',
  'myfridge://recipes',
  {
    title: 'Recettes',
    description: 'Toutes les recettes enregistrées avec leurs ingrédients',
    mimeType: 'application/json',
  },
  async (uri) => {
    const recipes = await getRecipes({})
    return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(recipes, null, 2) }] }
  },
)

server.registerResource(
  'fridge',
  'myfridge://fridge',
  {
    title: 'Garde-manger',
    description: 'Contenu actuel du frigo / garde-manger',
    mimeType: 'application/json',
  },
  async (uri) => {
    const items = await getFridge({})
    return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(items, null, 2) }] }
  },
)

server.registerResource(
  'shopping-list',
  'myfridge://shopping-list',
  {
    title: 'Liste de courses',
    description: 'Liste de courses active (articles non cochés)',
    mimeType: 'application/json',
  },
  async (uri) => {
    const { items } = await getShoppingList({})
    return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(items, null, 2) }] }
  },
)

// ---------------------------------------------------------------------------
// Démarrage (transport stdio)
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  // Les logs vont sur stderr pour ne pas polluer le protocole stdio.
  console.error('myFridge MCP server démarré (stdio).')
}

main().catch((err) => {
  console.error('Échec du démarrage du serveur MCP myFridge :', err)
  process.exit(1)
})
