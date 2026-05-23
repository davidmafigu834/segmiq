import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessClient } from "@/lib/auth/permissions";
import { callClaude } from "@/lib/ai/claude";

export async function POST(
  req: Request,
  { params }: { params: { clientId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as { industry?: string; additionalContext?: string };
  const { industry, additionalContext } = body;

  if (!industry) {
    return NextResponse.json({ error: "Industry is required" }, { status: 400 });
  }

  try {
    const result = await callClaude({
      system: `You are an expert sales consultant who designs lead capture forms for service businesses in Africa.
You understand construction, solar installation, landscaping, electrical, plumbing, roofing, interior design, and other trade businesses.
You know what information a salesperson needs to qualify a lead and give an accurate quote.
You write questions that feel conversational and helpful — not interrogative.
Respond with JSON only. No preamble. No explanation. No markdown.
The JSON must be an array of question objects with this exact structure:
[
  {
    "label": "The question text as shown to the prospect",
    "field_type": "short_text|long_text|phone|email|dropdown|radio|checkboxes",
    "placeholder": "placeholder text if applicable",
    "options": ["option1", "option2"],
    "required": true,
    "maps_to": "name|phone|email|budget|project_type|location|timeline|notes|other"
  }
]
Generate 6 to 8 questions. Always include name and phone as the first two questions.
The questions should help the salesperson understand: what they need, where they are, their timeline, and their budget.
Use field types exactly from this list: short_text, long_text, phone, email, dropdown, radio, checkboxes.`,
      userMessage: `Generate lead capture form questions for a ${industry} business in Africa.${
        additionalContext ? ` Additional context: ${additionalContext}` : ""
      }`,
      maxTokens: 1000,
    });

    const cleaned = result
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const questions = JSON.parse(cleaned) as unknown[];

    if (!Array.isArray(questions)) {
      throw new Error("Invalid response format");
    }

    return NextResponse.json({ questions });
  } catch (err) {
    console.error("[generate-questions] Claude call failed:", err);
    return NextResponse.json({ error: "Failed to generate questions" }, { status: 503 });
  }
}
