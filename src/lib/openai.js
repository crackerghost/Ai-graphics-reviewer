export async function scoreImageWithOpenAI({
  apiKey,
  imageUrl,
  brief = "",
  model = "gpt-4o-mini",
  abortSignal,
}) {
  if (!apiKey) throw new Error("Missing OpenAI API key");
  if (!imageUrl) throw new Error("Missing image URL/data URL");

  const categories = [
    { key: "compositionLayout", label: "Composition & Layout" },
    { key: "colourUsage", label: "Colour Usage" },
    { key: "typography", label: "Typography" },
    { key: "visualHierarchy", label: "Visual Hierarchy" },
    { key: "creativity", label: "Creativity" },
    { key: "technicalExecution", label: "Technical Execution" },
    { key: "briefAlignment", label: "Brief Alignment" },
    { key: "accessibility", label: "Accessibility" },
    { key: "overallClarity", label: "Overall Clarity" },
  ];

  const donts = {
    compositionLayout: "Crowding, imbalance, no focal point, awkward empty space",
    colourUsage: "Clashing hues, insufficient contrast, colour overload, off-brand palette",
    typography: "Too many fonts, illegible sizes, poor kerning/leading, decorative abuse",
    visualHierarchy: "Competing elements, unclear reading order, equal emphasis on everything",
    creativity: "Clichéd stock imagery, copy-paste icons, lack of original concept",
    technicalExecution: "Pixelation, jagged edges, inconsistent shadows, low-res exports",
    briefAlignment: "Ignoring the objective, wrong dimensions, missing mandatory logos/text",
    accessibility: "Tiny text, colour-blind traps, low readability, flashing elements",
    overallClarity: "Message muddled, too much text, visual noise distracting from intent",
  };

  const instruction = `You are a senior graphic design reviewer. Score the provided graphic 0-10 (integer) in each category. Consider these specific “Don'ts” and penalize when present. If a category is not applicable, still return a score.
Return strictly JSON with this shape:
{
  "compositionLayout": {"score": 0, "notes": ""},
  "colourUsage": {"score": 0, "notes": ""},
  "typography": {"score": 0, "notes": ""},
  "visualHierarchy": {"score": 0, "notes": ""},
  "creativity": {"score": 0, "notes": ""},
  "technicalExecution": {"score": 0, "notes": ""},
  "briefAlignment": {"score": 0, "notes": ""},
  "accessibility": {"score": 0, "notes": ""},
  "overallClarity": {"score": 0, "notes": ""}
}`;

  const textPrompt = [
    instruction,
    "\nCategories and Don'ts:",
    ...categories.map(c => `- ${c.label}: ${donts[c.key]}`),
    brief ? `\nDesign brief/context: ${brief}` : "",
  ].filter(Boolean).join("\n");

  const body = {
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: textPrompt },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: abortSignal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenAI error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const message = data.choices?.[0]?.message?.content;
  if (!message) throw new Error("No content returned from OpenAI");

  // content may be a string already (json_object format)
  const json = typeof message === "string" ? message : message[0]?.text || "{}";
  return JSON.parse(json);
}

