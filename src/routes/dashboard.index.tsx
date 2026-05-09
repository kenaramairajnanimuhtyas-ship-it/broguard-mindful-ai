import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Users, FileQuestion, Activity, AlertTriangle } from "lucide-react";
import { riskBadge } from "@/lib/broguard";

export const Route = createFileRoute("/dashboard/")({ component: Overview });

function Overview() {
  const [stats, setStats] = useState({ students: 0, questionnaires: 0, sessions: 0, highRisk: 0 });
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => { void load(); }, []);
  async function load() {
    const [s, q, ses, hr, rec] = await Promise.all([
      supabase.from("students").select("*", { count: "exact", head: true }),
      supabase.from("questionnaires").select("*", { count: "exact", head: true }),
      supabase.from("sessions").select("*", { count: "exact", head: true }),
      supabase.from("analyses").select("*", { count: "exact", head: true }).in("risk_level", ["tinggi", "sangat_tinggi"]),
      supabase.from("analyses").select("id, risk_level, risk_score, created_at, session:sessions(id, student_name, student_class, questionnaire:questionnaires(title))").order("created_at", { ascending: false }).limit(6),
    ]);
    setStats({ students: s.count ?? 0, questionnaires: q.count ?? 0, sessions: ses.count ?? 0, highRisk: hr.count ?? 0 });
    setRecent(rec.data ?? []);
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
