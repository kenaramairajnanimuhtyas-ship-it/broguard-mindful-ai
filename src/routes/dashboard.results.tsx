import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { riskBadge } from "@/lib/broguard";
import { format } from "date-fns";

export const Route = createFileRoute("/dashboard/results")({ component: Results });

function Results() {
  const [list, setList] = useState<any[]>([]);
  useEffect(() => { void load(); }, []);
  async function load() {
    const { data } = await supabase
      .from("sessions")
      .select("id, student_name, student_class, student_nis, completed_at, created_at, questionnaire:questionnaires(title), analysis:analyses(risk_level, risk_score)")
      .order("created_at", { ascending: false });
    setList(data ?? []);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Hasil & Analisis</h1>
        <p className="text-muted-foreground">Semua sesi pengisian kuesioner siswa.</p>
      </div>
      <Card className="bg-card-gradient shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 text-left text-xs uppercase text-muted-foreground">
              <tr><th className="p-3">Siswa</th><th className="p-3">Kuesioner</th><th className="p-3">Tanggal</th><th className="p-3">Skor</th><th className="p-3">Risiko</th></tr>
            </thead>
            <tbody>
              {list.map(s => {
                const a = s.analysis?.[0];
                const b = a ? riskBadge(a.risk_level) : null;
                return (
                  <tr key={s.id} className="border-b border-border/40 last:border-0 hover:bg-muted/40">
                    <td className="p-3"><Link to="/dashboard/results/$sessionId" params={{ sessionId: s.id }} className="font-medium hover:underline">{s.student_name}</Link><div className="text-xs text-muted-foreground">{s.student_class || "-"}</div></td>
                    <td className="p-3">{s.questionnaire?.title}</td>
                    <td className="p-3 text-muted-foreground">{format(new Date(s.created_at), "dd MMM yyyy HH:mm")}</td>
                    <td className="p-3 font-semibold">{a?.risk_score ?? "-"}</td>
                    <td className="p-3">{b ? <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${b.cls}`}>{b.label}</span> : <span className="text-xs text-muted-foreground">{s.completed_at ? "Memproses..." : "Belum selesai"}</span>}</td>
                  </tr>
                );
              })}
              {list.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-muted-foreground">Belum ada sesi.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
