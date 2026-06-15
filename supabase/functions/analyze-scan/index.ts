import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")
const MODEL = "claude-sonnet-4-6"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const RAYONS = ["frais", "epicerie", "surgeles", "boissons", "hygiene", "autre"]

function promptFor(type: string): string {
  if (type === "ticket") {
    return `Tu analyses la photo d'un TICKET DE CAISSE de supermarché français. Extrais chaque article acheté.`
  }
  if (type === "congelateur") {
    return `Tu analyses la photo de l'intérieur d'un CONGÉLATEUR. Identifie les produits surgelés visibles. La plupart des produits ici sont du rayon \"surgeles\".`
  }
  return `Tu analyses la photo de l'intérieur d'un ${type === "armoire" ? "placard / armoire" : "frigo"}. Identifie les produits alimentaires et d'hygiène visibles.`
}

const tools = [
  {
    name: "report_products",
    description: "Retourne la liste structurée des produits détectés.",
    input_schema: {
      type: "object",
      properties: {
        products: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Nom du produit en français, ex. 'Lait demi-écrémé'" },
              rayon: { type: "string", enum: RAYONS, description: "Rayon du produit" },
              quantity: { type: "number", description: "Quantité estimée (défaut 1)" },
              unit: { type: "string", enum: ["piece", "g", "kg", "mL", "L"], description: "Unité normalisée" },
              confidence: { type: "number", description: "Confiance de la détection entre 0 et 1" },
            },
            required: ["name", "rayon", "quantity", "unit", "confidence"],
          },
        },
      },
      required: ["products"],
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

    const { type = "frigo", imageBase64, mediaType = "image/jpeg" } = await req.json()
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "missing_image" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64

    const body = {
      model: MODEL,
      max_tokens: 1500,
      tools,
      tool_choice: { type: "tool", name: "report_products" },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data } },
            { type: "text", text: `${promptFor(type)} Pour chaque produit, donne un nom court en français, le rayon, une quantité estimée, l'unité et un niveau de confiance (0 à 1). Sois prudent: si tu n'es pas sûr, baisse la confiance.` },
          ],
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
    const products = toolUse?.input?.products ?? []

    return new Response(JSON.stringify({ products }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: "internal", message: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
