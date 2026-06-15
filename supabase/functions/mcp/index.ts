// myFridge — serveur MCP distant, hébergé sur Supabase Edge Functions.
//
// - Transport : Streamable HTTP (Web standard) -> compatible Claude.ai / claude chat.
// - Auth      : ressource protégée OAuth 2.1. Supabase Auth est le serveur
//               d'autorisation (email/mot de passe + Google/Apple via DCR + PKCE).
//               Chaque requête MCP porte un Bearer = JWT Supabase de l'utilisateur ;
//               les RLS isolent automatiquement ses données.
//
// Déployé sous le nom "mcp" => URL : https://<ref>.supabase.co/functions/v1/mcp
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { McpServer } from 'npm:@modelcontextprotocol/sdk@1.25.3/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from 'npm:@modelcontextprotocol/sdk@1.25.3/server/webStandardStreamableHttp.js'
import { Hono } from 'npm:hono@^4.9.7'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@^4.1.13'

// --- Environnement (injecté automatiquement par Supabase) -------------------
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

// URL publique de cette fonction (= la "ressource" au sens OAuth).
const RESOURCE_URL = `${SUPABASE_URL}/functions/v1/mcp`
// Serveur d'autorisation = Supabase Auth.
const AUTH_SERVER = `${SUPABASE_URL}/auth/v1`
const PRM_URL = `${RESOURCE_URL}/.well-known/oauth-protected-resource`

// --- Types domaine (alignés sur le schéma SQL myFridge) ---------------------
type Rayon = 'frais' | 'epicerie' | 'surgeles' | 'boissons' | 'hygiene' | 'autre'
const RAYONS = ['frais', 'epicerie', 'surgeles', 'boissons', 'hygiene', 'autre'] as const

// --- Helpers de formatage ---------------------------------------------------
const qty = (n: number | string, unit: string) => `${Number(n)} ${unit}`

function groupByRayon<T extends { rayon: Rayon }>(items: T[]): Record<string, T[]> {
  const out: Record<string, T[]> = {}
  for (const it of items) (out[it.rayon] ??= []).push(it)
  return out
}

function jsonResult(text: string, data: unknown) {
  return {
    content: [
      { type: 'text' as const, text },
      { type: 'text' as const, text: '```json\n' + JSON.stringify(data, null, 2) + '\n```' },
    ],
  }
}

function errResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  return { isError: true, content: [{ type: 'text' as const, text: `Erreur : ${message}` }] }
}

// --- Accès données (toujours via le client scopté à l'utilisateur, RLS ON) --
async function getActiveListId(db: SupabaseClient): Promise<string | null> {
  const { data, error } = await db
    .from('shopping_lists')
    .select('id')
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data?.id ?? null
}

// --- Fabrique du serveur MCP, lié à un utilisateur authentifié --------------
function buildServer(db: SupabaseClient, userId: string): McpServer {
  const server = new McpServer({ name: 'myfridge', version: '1.0.0' })

  // ----- RECETTES -----
  server.registerTool(
    'list_recipes',
    {
      title: 'Lister les recettes',
      description:
        'Liste les recettes enregistrées. Filtre optionnel par texte (titre ou ingrédient) et/ou favoris.',
      inputSchema: {
        search: z.string().optional(),
        favorites_only: z.boolean().optional(),
      },
    },
    async ({ search, favorites_only }) => {
      try {
        let q = db
          .from('recipes')
          .select('*, recipe_ingredients(*)')
          .order('favorite', { ascending: false })
          .order('created_at', { ascending: false })
        if (favorites_only) q = q.eq('favorite', true)
        const { data, error } = await q
        if (error) throw error
        let recipes = data ?? []
        if (search) {
          const s = search.toLowerCase()
          recipes = recipes.filter(
            (r: any) =>
              r.title.toLowerCase().includes(s) ||
              (r.recipe_ingredients ?? []).some((i: any) => i.name.toLowerCase().includes(s)),
          )
        }
        const text =
          recipes.length === 0
            ? 'Aucune recette trouvée.'
            : `📖 ${recipes.length} recette(s)\n` +
              recipes
                .map(
                  (r: any) =>
                    `• ${r.favorite ? '⭐ ' : ''}${r.title} — ${r.recipe_ingredients?.length ?? 0} ingrédient(s) [id: ${r.id}]`,
                )
                .join('\n')
        return jsonResult(text, recipes)
      } catch (err) {
        return errResult(err)
      }
    },
  )

  server.registerTool(
    'get_recipe',
    {
      title: 'Détail d’une recette',
      description: 'Retourne le détail complet d’une recette (ingrédients + étapes) par id.',
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      try {
        const { data, error } = await db
          .from('recipes')
          .select('*, recipe_ingredients(*)')
          .eq('id', id)
          .maybeSingle()
        if (error) throw error
        if (!data) return errResult(new Error(`Recette introuvable : ${id}`))
        const r: any = data
        const lines = [`📖 ${r.favorite ? '⭐ ' : ''}${r.title}`, `id: ${r.id}`]
        if (r.source_url) lines.push(`source: ${r.source_url}`)
        lines.push('\nIngrédients :')
        for (const i of r.recipe_ingredients ?? []) lines.push(`   • ${i.name} (${qty(i.quantity, i.unit)}) — ${i.rayon}`)
        if (r.steps?.length) {
          lines.push('\nÉtapes :')
          r.steps.forEach((s: string, idx: number) => lines.push(`   ${idx + 1}. ${s}`))
        }
        return jsonResult(lines.join('\n'), r)
      } catch (err) {
        return errResult(err)
      }
    },
  )

  // ----- GARDE-MANGER / FRIGO -----
  server.registerTool(
    'list_fridge',
    {
      title: 'Contenu du frigo / garde-manger',
      description:
        'Liste les produits du garde-manger. Filtres optionnels : rayon, et péremption sous X jours.',
      inputSchema: {
        rayon: z.enum(RAYONS).optional(),
        expiring_within_days: z.number().int().positive().optional(),
      },
    },
    async ({ rayon, expiring_within_days }) => {
      try {
        let q = db
          .from('pantry_items')
          .select('*')
          .order('rayon', { ascending: true })
          .order('name', { ascending: true })
        if (rayon) q = q.eq('rayon', rayon)
        const { data, error } = await q
        if (error) throw error
        let items = data ?? []
        if (typeof expiring_within_days === 'number') {
          const limit = new Date()
          limit.setDate(limit.getDate() + expiring_within_days)
          items = items.filter((i: any) => i.expiry_date != null && new Date(i.expiry_date) <= limit)
        }
        let text: string
        if (items.length === 0) {
          text = 'Le garde-manger est vide (ou aucun produit ne correspond au filtre).'
        } else {
          const groups = groupByRayon(items as any)
          const out = [`🧊 Garde-manger — ${items.length} produit(s)\n`]
          for (const r of Object.keys(groups).sort()) {
            out.push(`▸ ${r}`)
            for (const it of groups[r] as any[]) {
              const exp = it.expiry_date ? ` — péremption ${it.expiry_date}` : ''
              out.push(`   • ${it.name} (${qty(it.quantity, it.unit)})${exp}`)
            }
          }
          text = out.join('\n')
        }
        return jsonResult(text, items)
      } catch (err) {
        return errResult(err)
      }
    },
  )

  // ----- LISTE DE COURSES -----
  server.registerTool(
    'list_shopping_list',
    {
      title: 'Liste de courses',
      description: 'Liste de courses active, groupée par rayon. Masque les articles cochés par défaut.',
      inputSchema: { include_checked: z.boolean().optional() },
    },
    async ({ include_checked }) => {
      try {
        const listId = await getActiveListId(db)
        if (!listId) return jsonResult('La liste de courses est vide.', [])
        let q = db
          .from('list_items')
          .select('*')
          .eq('list_id', listId)
          .order('checked', { ascending: true })
          .order('created_at', { ascending: true })
        if (!include_checked) q = q.eq('checked', false)
        const { data, error } = await q
        if (error) throw error
        const items = data ?? []
        let text: string
        if (items.length === 0) {
          text = 'La liste de courses est vide.'
        } else {
          const groups = groupByRayon(items as any)
          const out = [`🛒 Liste de courses — ${items.length} article(s)\n`]
          for (const r of Object.keys(groups).sort()) {
            out.push(`▸ ${r}`)
            for (const it of groups[r] as any[]) {
              out.push(`   ${it.checked ? '☑' : '☐'} ${it.name} (${qty(it.quantity, it.unit)}) [${it.origin}]`)
            }
          }
          text = out.join('\n')
        }
        return jsonResult(text, items)
      } catch (err) {
        return errResult(err)
      }
    },
  )

  server.registerTool(
    'add_shopping_item',
    {
      title: 'Ajouter un article à la liste',
      description:
        'Ajoute un article à la liste active (dédoublonnage : même nom + même unité => quantité cumulée).',
      inputSchema: {
        name: z.string(),
        rayon: z.enum(RAYONS).default('autre'),
        quantity: z.number().positive().default(1),
        unit: z.string().default('piece'),
      },
    },
    async ({ name, rayon, quantity, unit }) => {
      try {
        const item = await addItem(db, userId, { name, rayon, quantity, unit, origin: 'manuel' })
        return jsonResult(`✅ Ajouté : ${item.name} (${qty(item.quantity, item.unit)})`, item)
      } catch (err) {
        return errResult(err)
      }
    },
  )

  server.registerTool(
    'add_recipe_to_shopping_list',
    {
      title: 'Ajouter les ingrédients d’une recette à la liste',
      description: 'Ajoute tous les ingrédients d’une recette à la liste de courses active.',
      inputSchema: { recipe_id: z.string() },
    },
    async ({ recipe_id }) => {
      try {
        const { data: recipe, error } = await db
          .from('recipes')
          .select('*, recipe_ingredients(*)')
          .eq('id', recipe_id)
          .maybeSingle()
        if (error) throw error
        if (!recipe) return errResult(new Error(`Recette introuvable : ${recipe_id}`))
        const ings = (recipe as any).recipe_ingredients ?? []
        for (const ing of ings) {
          await addItem(db, userId, {
            name: ing.name,
            rayon: ing.rayon ?? 'autre',
            quantity: Number(ing.quantity) || 1,
            unit: ing.unit || 'piece',
            origin: 'recette',
          })
        }
        return jsonResult(`✅ ${ings.length} ingrédient(s) ajouté(s) à la liste.`, { added: ings.length })
      } catch (err) {
        return errResult(err)
      }
    },
  )

  return server
}

// Insertion avec déduplication (règle métier PRD).
async function addItem(
  db: SupabaseClient,
  userId: string,
  item: { name: string; rayon: Rayon; quantity: number; unit: string; origin: string },
): Promise<any> {
  let listId = await getActiveListId(db)
  if (!listId) {
    const { data, error } = await db
      .from('shopping_lists')
      .insert({ user_id: userId, status: 'active' })
      .select('id')
      .single()
    if (error) throw error
    listId = data.id
  }
  const { data: dupes } = await db
    .from('list_items')
    .select('*')
    .eq('list_id', listId)
    .eq('checked', false)
    .ilike('name', item.name.trim())
  const dupe = (dupes as any[] | null)?.find((d) => d.unit === item.unit)
  if (dupe) {
    const { data, error } = await db
      .from('list_items')
      .update({ quantity: Number(dupe.quantity) + item.quantity })
      .eq('id', dupe.id)
      .select('*')
      .single()
    if (error) throw error
    return data
  }
  const { data, error } = await db
    .from('list_items')
    .insert({
      list_id: listId,
      user_id: userId,
      name: item.name.trim(),
      rayon: item.rayon,
      quantity: item.quantity,
      unit: item.unit,
      origin: item.origin,
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

// --- En-têtes CORS -----------------------------------------------------------
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, mcp-protocol-version, mcp-session-id',
  'Access-Control-Expose-Headers': 'WWW-Authenticate, mcp-session-id, mcp-protocol-version',
}

// --- Routeur HTTP (basePath = nom de la fonction) ---------------------------
const app = new Hono().basePath('/mcp')

app.options('*', (c) => c.body(null, 204, CORS))

// Métadonnée de ressource protégée (RFC 9728) : indique le serveur d'autorisation.
const prmHandler = (c: any) =>
  c.json(
    {
      resource: RESOURCE_URL,
      authorization_servers: [AUTH_SERVER],
      bearer_methods_supported: ['header'],
      scopes_supported: ['openid', 'email', 'profile'],
    },
    200,
    CORS,
  )
app.get('/.well-known/oauth-protected-resource', prmHandler)
// Variante tolérante si le client suffixe le chemin de la ressource.
app.get('/.well-known/oauth-protected-resource/*', prmHandler)

// Réponse 401 normalisée qui amorce le flux OAuth côté client.
function unauthorized(c: any) {
  return c.json(
    { jsonrpc: '2.0', error: { code: -32001, message: 'Authentication required' }, id: null },
    401,
    {
      ...CORS,
      'WWW-Authenticate': `Bearer resource_metadata="${PRM_URL}", error="invalid_token", error_description="Authentification Supabase requise"`,
    },
  )
}

// Endpoint MCP.
app.all('/', async (c) => {
  const auth = c.req.header('authorization') ?? ''
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''
  if (!token) return unauthorized(c)

  // Validation du JWT Supabase + récupération de l'utilisateur.
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
  const { data: userData, error: userErr } = await anon.auth.getUser(token)
  if (userErr || !userData?.user) return unauthorized(c)
  const userId = userData.user.id

  // Client scopté à l'utilisateur : toutes les requêtes passent par les RLS.
  const db = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const server = buildServer(db, userId)
  const transport = new WebStandardStreamableHTTPServerTransport()
  await server.connect(transport)
  const res = await transport.handleRequest(c.req.raw)
  for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v)
  return res
})

Deno.serve(app.fetch)
