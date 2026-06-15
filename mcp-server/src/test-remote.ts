// Test end-to-end du serveur MCP DISTANT (Edge Function), chemin authentifié.
//
// Se connecte à Supabase avec email/mot de passe pour obtenir un access token,
// puis appelle le endpoint MCP distant via Streamable HTTP (comme le ferait
// Claude une fois l'OAuth terminé) et exécute initialize + tools/list + un appel.
//
//   MCP_URL=... MYFRIDGE_PASSWORD=... npx tsx src/test-remote.ts
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const SUPABASE_URL = process.env.SUPABASE_URL!
const ANON_KEY = process.env.SUPABASE_ANON_KEY!
const EMAIL = process.env.MYFRIDGE_EMAIL!
const PASSWORD = process.env.MYFRIDGE_PASSWORD!
const MCP_URL = process.env.MCP_URL ?? `${SUPABASE_URL}/functions/v1/mcp`

// 1) Connexion -> access token (le JWT que Claude obtiendrait via OAuth).
const supabase = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
const { data, error } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
if (error) throw new Error(`Connexion échouée : ${error.message}`)
const token = data.session!.access_token
console.log(`Connecté en tant que ${EMAIL}`)

// 2) Connexion au serveur MCP distant avec le Bearer token.
const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
  requestInit: { headers: { Authorization: `Bearer ${token}` } },
})
const client = new Client({ name: 'test-remote', version: '1.0.0' })
await client.connect(transport)
console.log('Handshake MCP distant OK.')

// 3) Liste des tools.
const tools = await client.listTools()
console.log('TOOLS:', tools.tools.map((t) => t.name).join(', '))

// 4) Appel d'un tool en lecture (recettes) -> prouve l'isolation RLS par utilisateur.
const res = await client.callTool({ name: 'list_recipes', arguments: {} })
const first = (res.content as Array<{ type: string; text?: string }>).find((c) => c.type === 'text')
console.log('\n--- list_recipes ---\n' + (first?.text ?? '(vide)'))

await client.close()
console.log('\nOK: test distant réussi.')
