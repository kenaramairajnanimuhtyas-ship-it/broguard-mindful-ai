import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { riskBadge } from "@/lib/broguard";
import { ArrowLeft, Loader2, Sparkles, Download } from "lucide-react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import { format } from "date-fns";

export const Route = createFileRoute("/dashboard/results/$sessionId")({ component: Detail });

function Detail() {
  const { sessionId } = Route.useParams();
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { void load(); }, [sessionId]);
  async function load() {
    const { data: s } = await supabase
      .from("sessions")
      .select("*, questionnaire:questionnaires(title, description), analysis:analyses(*), responses(answer, question:questions(text, type, order_index, options))")
      .eq("id", sessionId).single();
    setData(s);
  }
  async function reanalyze() {
    setBusy(true);
    try {
      const { data: r, error } = await supabase.functions.invoke("analyze-session", { body: { sessionId } });
      if (error) throw error;
      if (r.error) throw new Error(r.error);
      toast.success("Analisis ulang selesai");
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  function exportPDF() {
    if (!data) return;
    const a = data.analysis?.[0];
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 48;
    let y = margin;
    const writeLine = (t: string, opts: { size?: number; bold?: boolean; color?: [number, number, number]; gap?: number } = {}) => {
      doc.setFont("helvetica", opts.bold ? "bold" : "normal");
      doc.setFontSize(opts.size ?? 11);
      doc.setTextColor(...(opts.color ?? [30, 30, 30] as [number, number, number]));
      const lines = doc.splitTextToSize(t, pageW - margin * 2);
      lines.forEach((ln: string) => {
        if (y > 780) { doc.addPage(); y = margin; }
        doc.text(ln, margin, y);
        y += (opts.size ?? 11) * 1.35;
      });
      y += opts.gap ?? 0;
    };

    writeLine("BroGuardAI", { size: 10, color: [120, 120, 120] });
    writeLine("Laporan Analisis Risiko Psikologis", { size: 18, bold: true, gap: 8 });
    writeLine(`Nama   : ${data.student_name}`);
    writeLine(`Kelas  : ${data.student_class || "-"}    NIS: ${data.student_nis || "-"}`);
    writeLine(`Kuesioner: ${data.questionnaire?.title || "-"}`);
    writeLine(`Tanggal: ${format(new Date(data.created_at), "dd MMM yyyy HH:mm")}`, { gap: 12 });

    if (a) {
      const labels: Record<string, string> = { rendah: "Risiko Rendah", sedang: "Risiko Sedang", tinggi: "Risiko Tinggi", sangat_tinggi: "Risiko Sangat Tinggi" };
      writeLine(`Tingkat Risiko: ${labels[a.risk_level] || a.risk_level}`, { bold: true, size: 13 });
      writeLine(`Skor Risiko: ${a.risk_score} / 100`, { bold: true, gap: 10 });
      writeLine("Ringkasan", { bold: true, size: 13 });
      writeLine(a.summary || "-", { gap: 8 });
      writeLine("Rekomendasi", { bold: true, size: 13 });
      writeLine(a.recommendations || "-", { gap: 12 });
    } else {
      writeLine("Analisis belum tersedia.", { gap: 12 });
    }

    writeLine("Jawaban Siswa", { bold: true, size: 13, gap: 4 });
    responses.forEach((r: any, i: number) => {
      writeLine(`${i + 1}. ${r.question?.text || ""}`, { bold: true });
      writeLine(`Jawab: ${r.answer || "(kosong)"}`, { gap: 6 });
    });

    const safeName = data.student_name.replace(/[^a-z0-9]+/gi, "_");
    doc.save(`BroGuardAI_${safeName}_${sessionId.slice(0, 6)}.pdf`);
  }

  if (!data) return <p>Memuat...</p>;
  const a = data.analysis?.[0];
  const b = a ? riskBadge(a.risk_level) : null;
  const responses = (data.responses || []).sort((x:any,y:any)=>(x.question?.order_index??0)-(y.question?.order_index??0));

  return (
    <div className="space-y-6">
      <Link to="/dashboard/results" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Kembali</Link>

      <Card className="bg-card-gradient p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold">{data.student_name}</h1>
            <p className="text-sm text-muted-foreground">{data.student_class || "-"} · NIS {data.student_nis || "-"}</p>
            <p className="mt-1 text-sm">Kuesioner: <span className="font-medium">{data.questionnaire?.title}</span></p>
          </div>
          <Button size="sm" variant="outline" onClick={reanalyze} disabled={busy} className="gap-2">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Analisis ulang</Button>
        </div>
      </Card>

      {a ? (
        <Card className="bg-card-gradient p-6 shadow-card">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${b!.cls}`}>{b!.label}</span>
            <span className="text-3xl font-bold">{a.risk_score}<span className="text-base text-muted-foreground">/100</span></span>
          </div>
          <h3 className="mt-5 font-display text-lg font-semibold">Ringkasan</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm">{a.summary}</p>
          <h3 className="mt-5 font-display text-lg font-semibold">Rekomendasi</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm">{a.recommendations}</p>
        </Card>
      ) : (
        <Card className="bg-card-gradient p-6 text-center text-sm text-muted-foreground shadow-card">Belum ada analisis. Klik "Analisis ulang".</Card>
      )}

      <Card className="bg-card-gradient p-6 shadow-card">
        <h3 className="mb-4 font-display text-lg font-semibold">Jawaban siswa</h3>
        <div className="space-y-4">
          {responses.map((r:any, i:number) => (
            <div key={i} className="rounded-xl bg-background/60 p-4">
              <p className="text-xs font-semibold text-muted-foreground">#{i+1} · {r.question?.type === "multiple_choice" ? "Pilihan ganda" : "Esai"}</p>
              <p className="mt-1 font-medium">{r.question?.text}</p>
              <p className="mt-2 text-sm text-foreground/80">{r.answer || <em className="text-muted-foreground">tidak dijawab</em>}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
