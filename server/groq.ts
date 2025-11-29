interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface GroqResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

export async function generateWithGroq(
  model: string,
  prompt: string,
  context?: string
): Promise<string> {
  const systemPrompt = `You are an expert GDScript developer for Godot 4.4. Generate clean, efficient, and well-commented GDScript code based on user requests.

Rules:
1. Use Godot 4.4 syntax and best practices
2. Include appropriate type hints
3. Use @export and @onready annotations correctly
4. Add brief comments explaining key parts
5. Structure code logically with proper indentation
6. Only output GDScript code, no explanations outside of code comments
7. Use the latest Godot 4.4 API (no deprecated methods)
8. Prefer simple, readable code over complex solutions

${context ? `Context: ${context}` : ""}`;

  const messages: GroqMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Generate GDScript code for: ${prompt}` },
  ];

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model || "llama-3.3-70b-versatile",
      messages,
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq API error: ${error}`);
  }

  const data = (await response.json()) as GroqResponse;
  const text = data.choices[0]?.message?.content || "";

  let code = text;
  const codeBlockMatch = text.match(/```(?:gdscript|gd)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    code = codeBlockMatch[1].trim();
  }

  return code;
}
