// Analyzes a completed session and stores risk level + recommendations
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { sessionId } = await req.json();
    if (!sessionId) throw new Error("sessionId required");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: session } = await supabase.from("sessions").select("*, questionnaire:questionnaires(title, description)").eq("id", sessionId).single();
    if (!session) throw new Error("Session not found");

    const { data: responses } = await supabase
      .from("responses")
      .select("answer, question:questions(text, type, options, order_index)")
      .eq("session_id", sessionId);

    const formatted = (responses || [])
      .sort((a: any, b: any) => (a.question?.order_index ?? 0) - (b.question?.order_index ?? 0))
      .map((r: any, i: number) => {
        if (r.question?.type === "multiple_choice") {
          return `${i + 1}. [Pilihan Ganda] ${r.question.text}\n   Jawaban: ${r.answer}`;
        }
        return `${i + 1}. [Esai] ${r.question?.text}\n   Jawaban: ${r.answer || "(kosong)"}`;
      })
      .join("\n\n");

    const systemPrompt = `Anda adalah psikolog sekolah berpengalaman menganalisis hasil kuesioner risiko psikologis siswa remaja (SMP/SMA). Berikan analisis empatik, profesional, berbahasa Indonesia. Klasifikasikan risiko: rendah / sedang / tinggi / sangat_tinggi.`;
    const userPrompt = `Kuesioner: ${session.questionnaire?.title}
Siswa: ${session.student_name} (${session.student_class || "-"})

Jawaban:
${formatted}

Analisis indikasi psikologis siswa, beri skor risiko 0-100, level, ringkasan, dan rekomendasi tindak lanjut untuk guru BK.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "submit_analysis",
            description: "Submit risk analysis",
            parameters: {
              type: "object",
              properties: {
                risk_level: { type: "string", enum: ["rendah", "sedang", "tinggi", "sangat_tinggi"] },
                risk_score: { type: "integer", minimum: 0, maximum: 100 },
                summary: { type: "string", description: "Ringkasan kondisi siswa, 2-4 kalimat" },
                indicators: { type: "array", items: { type: "string" }, description: "Indikator yang teridentifikasi" },
                recommendations: { type: "string", description: "Rekomendasi tindak lanjut, gunakan markdown bullet" },
              },
              required: ["risk_level", "risk_score", "summary", "indicators", "recommendations"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "submit_analysis" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limit" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "Kredit habis" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI failed");
    }
    const aiData = await aiResp.json();
    const args = aiData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = JSON.parse(args);

    const summary = parsed.summary + (parsed.indicators?.length ? `\n\nIndikator: ${parsed.indicators.join(", ")}` : "");

    const { data: analysis, error } = await supabase
      .from("analyses")
      .upsert({
        session_id: sessionId,
        risk_level: parsed.risk_level,
        risk_score: parsed.risk_score,
        summary,
        recommendations: parsed.recommendations,
        raw_ai: parsed,
      }, { onConflict: "session_id" })
      .select()
      .single();

    if (error) throw error;

    await supabase.from("sessions").update({ completed_at: new Date().toISOString() }).eq("id", sessionId);

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
