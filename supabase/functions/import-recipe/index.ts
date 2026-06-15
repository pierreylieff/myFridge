import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")
const MODEL = "claude-sonnet-4-6"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const RAYONS = ["frais", "epicerie", "surgeles", "boissons", "hygiene", "autre"]

const tools = [
  {
    name: "report_recipe",
    description: "Retourne la recette structurée extraite du texte.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Titre court de la recette en français" },
        ingredients: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Nom de l'ingrédient en français" },
              quantity: { type: "number", description: "Quantité (défaut 1)" },
              unit: { type: "string", enum: ["piece", "g", "kg", "mL", "L"], description: "Unité normalisée" },
              rayon: { type: "string", enum: RAYONS, description: "Rayon du produit" },
            },
            required: ["name", "quantity", "unit", "rayon"],
          },
        },
        steps: { type: "array", items: { type: "string" }, description: "Étapes de préparation, si disponibles" },
      },
      required: ["title", "ingredients", "steps"],
    },
  },
]

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "missing_api_key", message: "La clé ANTHROPIC_API_KEY n'est pas configurée sur le serveur." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const { text = "", url = "" } = await req.json()
    let content = String(text || "").trim()

    // Best-effort fetch if only a URL is provided. Instagram is usually gated,
    // so failures fall back to whatever text the user pasted.
    if (!content && url) {
      try {
        const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } })
        if (r.ok) {
          const html = await r.text()
          const og = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)/i)
          content = og ? og[1] : html.replace(/<[^>]+>/g, " ").slice(0, 4000)
        }
      } catch (_e) { /* ignore */ }
    }

    if (!content) {
      return new Response(
        JSON.stringify({ error: "no_content", message: "Aucun texte de recette à analyser. Collez la légende du post." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const body = {
      model: MODEL,
      max_tokens: 2000,
      tools,
      tool_choice: { type: "tool", name: "report_recipe" },
      messages: [
        {
          role: "user",
          content: `Voici le texte d'une recette (légende Instagram / Reel ou texte libre). Extrais le titre, la liste des ingrédients (avec quantité, unité normalisée et rayon de supermarché), et les étapes si présentes. Réponds en français.\n\n---\n${content}`,
        },
      ],
    }

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (!resp.ok) {
      const errText = await resp.text()
      return new Response(JSON.stringify({ error: "anthropic_error", detail: errText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const result = await resp.json()
    const toolUse = (result.content ?? []).find((c: { type: string }) => c.type === "tool_use")
    const recipe = toolUse?.input ?? { title: "", ingredients: [], steps: [] }

    return new Response(JSON.stringify({ recipe }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: "internal", message: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
