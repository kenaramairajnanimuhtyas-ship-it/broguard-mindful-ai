import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Users, FileQuestion, Activity, AlertTriangle } from "lucide-react";
import { riskBadge } from "@/lib/broguard";

export const Route = createFileRoute("/dashboard/")({ component: Overview });

type ClassRow = { className: string; total: number; avg: number; rendah: number; sedang: number; tinggi: number; sangat_tinggi: number };

function Overview() {
  const [stats, setStats] = useState({ students: 0, questionnaires: 0, sessions: 0, highRisk: 0 });
  const [recent, setRecent] = useState<any[]>([]);
  const [classRows, setClassRows] = useState<ClassRow[]>([]);

  useEffect(() => { void load(); }, []);
  async function load() {
    const [s, q, ses, hr, rec, perClass] = await Promise.all([
      supabase.from("students").select("*", { count: "exact", head: true }),
      supabase.from("questionnaires").select("*", { count: "exact", head: true }),
      supabase.from("sessions").select("*", { count: "exact", head: true }),
      supabase.from("analyses").select("*", { count: "exact", head: true }).in("risk_level", ["tinggi", "sangat_tinggi"]),
      supabase.from("analyses").select("id, risk_level, risk_score, created_at, session:sessions(id, student_name, student_class, questionnaire:questionnaires(title))").order("created_at", { ascending: false }).limit(6),
      supabase.from("analyses").select("risk_level, risk_score, session:sessions!inner(student_class)"),
    ]);
    setStats({ students: s.count ?? 0, questionnaires: q.count ?? 0, sessions: ses.count ?? 0, highRisk: hr.count ?? 0 });
    setRecent(rec.data ?? []);

    const map = new Map<string, ClassRow>();
    (perClass.data ?? []).forEach((r: any) => {
      const cls = r.session?.student_class?.trim() || "Tanpa kelas";
      const row = map.get(cls) ?? { className: cls, total: 0, avg: 0, rendah: 0, sedang: 0, tinggi: 0, sangat_tinggi: 0 };
      row.total += 1;
      row.avg += r.risk_score || 0;
      if (row[r.risk_level as keyof ClassRow] !== undefined) (row as any)[r.risk_level] += 1;
      map.set(cls, row);
    });
    const rows = Array.from(map.values()).map(r => ({ ...r, avg: r.total ? Math.round(r.avg / r.total) : 0 }));
    rows.sort((a, b) => (b.tinggi + b.sangat_tinggi) - (a.tinggi + a.sangat_tinggi) || b.avg - a.avg);
    setClassRows(rows);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Beranda</h1>
        <p className="text-muted-foreground">Ringkasan aktivitas BroGuardAI di sekolah Anda.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Siswa terdaftar" value={stats.students} tone="primary" />
        <StatCard icon={FileQuestion} label="Kuesioner" value={stats.questionnaires} tone="accent" />
        <StatCard icon={Activity} label="Sesi pengisian" value={stats.sessions} tone="warm" />
        <StatCard icon={AlertTriangle} label="Risiko tinggi" value={stats.highRisk} tone="destructive" />
      </div>

      <Card className="bg-card-gradient p-6 shadow-card">
        <h2 className="mb-1 font-display text-xl font-semibold">Prioritas penanganan per kelas</h2>
        <p className="mb-4 text-sm text-muted-foreground">Kelas diurutkan berdasar jumlah siswa risiko tinggi & rerata skor.</p>
        {classRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada data analisis.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-left text-xs uppercase text-muted-foreground">
                <tr><th className="p-2">Kelas</th><th className="p-2">Sesi</th><th className="p-2">Rerata skor</th><th className="p-2">Rendah</th><th className="p-2">Sedang</th><th className="p-2">Tinggi</th><th className="p-2">Sangat tinggi</th></tr>
              </thead>
              <tbody>
                {classRows.map(r => (
                  <tr key={r.className} className="border-b border-border/40 last:border-0">
                    <td className="p-2 font-medium">{r.className}</td>
                    <td className="p-2">{r.total}</td>
                    <td className="p-2 font-semibold">{r.avg}</td>
                    <td className="p-2"><span className="rounded-full bg-success/20 px-2 py-0.5 text-xs">{r.rendah}</span></td>
                    <td className="p-2"><span className="rounded-full bg-warm/40 px-2 py-0.5 text-xs">{r.sedang}</span></td>
                    <td className="p-2"><span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs text-destructive">{r.tinggi}</span></td>
                    <td className="p-2"><span className="rounded-full bg-destructive px-2 py-0.5 text-xs text-destructive-foreground">{r.sangat_tinggi}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="bg-card-gradient p-6 shadow-card">
        <h2 className="mb-4 font-display text-xl font-semibold">Hasil analisis terbaru</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada hasil. Buat kuesioner dan bagikan kodenya kepada siswa.</p>
        ) : (
          <div className="divide-y divide-border/60">
            {recent.map((r) => {
              const b = riskBadge(r.risk_level);
              return (
                <Link key={r.id} to="/dashboard/results/$sessionId" params={{ sessionId: r.session.id }} className="flex items-center justify-between gap-3 py-3 hover:bg-muted/40 -mx-2 px-2 rounded-lg">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.session.student_name} <span className="text-muted-foreground font-normal">· {r.session.student_class || "-"}</span></p>
                    <p className="truncate text-xs text-muted-foreground">{r.session.questionnaire.title}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{r.risk_score}</span>
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${b.cls}`}>{b.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: any) {
  const tones: Record<string, string> = {
    primary: "bg-primary/15 text-primary",
    accent: "bg-accent/40 text-accent-foreground",
    warm: "bg-warm/40 text-warm-foreground",
    destructive: "bg-destructive/15 text-destructive",
  };
  return (
    <Card className="flex items-center gap-4 bg-card-gradient p-5 shadow-card">
      <div className={`grid h-11 w-11 place-items-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-display text-2xl font-bold">{value}</p>
      </div>
    </Card>
  );
}
