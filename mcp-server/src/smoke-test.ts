// Test de fumée : démarre le serveur via stdio et vérifie le handshake MCP
// (liste des tools + resources). N'effectue aucun appel base de données.
//   npx tsx src/smoke-test.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ['--import', 'tsx', new URL('./index.ts', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')],
  env: {
    ...process.env,
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'dummy-key-for-handshake-test',
    MYFRIDGE_EMAIL: 'test@example.com',
    MYFRIDGE_PASSWORD: 'dummy',
  },
})

const client = new Client({ name: 'smoke-test', version: '1.0.0' })
await client.connect(transport)

const tools = await client.listTools()
console.log('TOOLS:', tools.tools.map((t) => t.name).join(', '))

const resources = await client.listResources()
console.log('RESOURCES:', resources.resources.map((r) => `${r.name} (${r.uri})`).join(', '))

await client.close()
console.log('OK: handshake MCP réussi.')
