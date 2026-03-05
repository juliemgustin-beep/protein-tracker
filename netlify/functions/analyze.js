export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { image_data_url } = JSON.parse(event.body || "{}");
    if (!image_data_url || typeof image_data_url !== "string") {
      return { statusCode: 400, body: "Missing image_data_url" };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing OPENAI_API_KEY" })
      };
    }

    const prompt = `
Analyze this meal photo.
Estimate the protein in grams.

Return valid JSON only in exactly this shape:
{
  "foods": [
    { "name": "food item", "protein_g": 0 }
  ],
  "total_protein_g": 0,
  "notes": "short note"
}

Rules:
- Estimate visible foods only.
- Use reasonable portion assumptions.
- protein_g and total_protein_g must be numbers, not strings.
- Return JSON only.
`.trim();

    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "user",
            content: [
		content: [
  { type: "input_text", text: prompt },
  {
    type: "input_image",
    image_url: {
      url: image_data_url
    }
  }
]
            ]
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "protein_estimate",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                foods: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      name: { type: "string" },
                      protein_g: { type: "number" }
                    },
                    required: ["name", "protein_g"]
                  }
                },
                total_protein_g: { type: "number" },
                notes: { type: "string" }
              },
              required: ["foods", "total_protein_g", "notes"]
            }
          }
        }
      })
    });

    const data = await resp.json();

    if (!resp.ok) {
      return {
        statusCode: resp.status,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: data?.error?.message || "OpenAI request failed"
        })
      };
    }

    const text =
      data.output_text ||
      (data.output || [])
        .flatMap(item => item.content || [])
        .find(c => c.type === "output_text")?.text ||
      "";

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Could not parse model output",
          raw: text
        })
      };
    }

    if (
      typeof parsed.total_protein_g !== "number" ||
      !Array.isArray(parsed.foods)
    ) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Model returned invalid shape",
          parsed
        })
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed)
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: e?.message || "Server error"
      })
    };
  }
}
