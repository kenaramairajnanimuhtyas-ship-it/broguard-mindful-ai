// Generates a psychological risk questionnaire using Lovable AI
// Returns 10 multiple-choice questions + 5 essay questions
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { topic, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const systemPrompt = `Anda adalah psikolog sekolah & guru BK ahli. Buat kuesioner deteksi risiko psikologis siswa (kecemasan, depresi, stres, bullying, kesulitan belajar, masalah keluarga). Bahasa Indonesia, sopan, sensitif, sesuai usia remaja SMP/SMA. Tidak menghakimi.`;

    const userPrompt = `Topik fokus: ${topic || "Kesehatan mental siswa secara umum"}
Konteks tambahan: ${context || "-"}

Buat tepat 10 soal pilihan ganda dan 5 soal esai/cerita reflektif.
- Pilihan ganda: 4 opsi dengan skala risiko (rendah ke tinggi).
- Esai: pertanyaan terbuka yang mengundang siswa bercerita.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            name: "create_questionnaire",
            description: "Return a structured questionnaire",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                multiple_choice: {
                  type: "array",
                  minItems: 10,
                  maxItems: 10,
                  items: {
                    type: "object",
                    properties: {
                      text: { type: "string" },
                      options: { type: "array", minItems: 4, maxItems: 4, items: { type: "string" } },
                    },
                    required: ["text", "options"],
                    additionalProperties: false,
                  },
                },
                essay: {
                  type: "array",
                  minItems: 5,
                  maxItems: 5,
                  items: { type: "string" },
                },
              },
              required: ["title", "description", "multiple_choice", "essay"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "create_questionnaire" } },
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) return new Response(JSON.stringify({ error: "Terlalu banyak permintaan, coba lagi sebentar." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (resp.status === 402) return new Response(JSON.stringify({ error: "Kredit AI workspace habis, mohon tambahkan kredit." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await resp.text();
      console.error("AI error", resp.status, t);
      return new Response(JSON.stringify({ error: "AI gagal membuat kuesioner" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await resp.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("No tool call returned");
    const parsed = JSON.parse(args);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
