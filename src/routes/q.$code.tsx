import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Shield, Loader2, Heart } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/q/$code")({ component: PublicQuestionnaire });

function PublicQuestionnaire() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const [q, setQ] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [stage, setStage] = useState<"identity" | "fill">("identity");
  const [identity, setIdentity] = useState({ name: "", nis: "", className: "" });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: qd } = await supabase.from("questionnaires").select("*").eq("access_code", code).eq("status","active").maybeSingle();
      if (!qd) { setLoading(false); return; }
      setQ(qd);
      const { data: qs } = await supabase.from("questions").select("*").eq("questionnaire_id", qd.id).order("order_index");
      setQuestions(qs ?? []);
      setLoading(false);
    })();
  }, [code]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!q) return <div className="flex min-h-screen items-center justify-center p-6 text-center"><div><h1 className="font-display text-2xl font-bold">Kode tidak ditemukan</h1><p className="text-muted-foreground">Periksa kembali kode dari guru BK Anda.</p></div></div>;

  const answered = questions.filter(qq => answers[qq.id]?.trim()).length;
  const progress = questions.length ? (answered / questions.length) * 100 : 0;

  async function submit() {
    if (questions.some(qq => qq.type === "multiple_choice" && !answers[qq.id])) return toast.error("Lengkapi semua pertanyaan pilihan ganda");
    setSubmitting(true);
    try {
      const { data: ses, error } = await supabase.from("sessions").insert({
        questionnaire_id: q.id,
        student_name: identity.name,
        student_nis: identity.nis || null,
        student_class: identity.className || null,
      }).select().single();
      if (error) throw error;
      const rows = questions.map(qq => ({ session_id: ses.id, question_id: qq.id, answer: answers[qq.id] || "" }));
      const { error: rerr } = await supabase.from("responses").insert(rows);
      if (rerr) throw rerr;
      // Trigger AI analysis (fire & forget will still complete server-side)
      supabase.functions.invoke("analyze-session", { body: { sessionId: ses.id } }).catch(()=>{});
      navigate({ to: "/q/$code/done", params: { code }, search: { sid: ses.id } as any });
    } catch (e: any) { toast.error(e.message); } finally { setSubmitting(false); }
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <div className="mb-6 flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-soft"><Shield className="h-5 w-5" /></div>
        <span className="font-display text-xl font-bold">BroGuardAI</span>
      </div>

      {stage === "identity" ? (
        <Card className="bg-card-gradient p-6 shadow-soft">
          <h1 className="font-display text-2xl font-bold">{q.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{q.description}</p>
          <div className="mt-5 space-y-3">
            <div><Label>Nama lengkap *</Label><Input value={identity.name} onChange={e=>setIdentity({...identity, name: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>NIS</Label><Input value={identity.nis} onChange={e=>setIdentity({...identity, nis: e.target.value})} /></div>
              <div><Label>Kelas</Label><Input value={identity.className} onChange={e=>setIdentity({...identity, className: e.target.value})} /></div>
            </div>
          </div>
          <p className="mt-4 rounded-xl bg-accent/30 p-3 text-xs text-accent-foreground">
            <Heart className="mr-1 inline h-3.5 w-3.5" /> Jawablah dengan jujur. Tidak ada jawaban benar/salah. Hasil akan dilihat oleh guru BK untuk membantu kamu.
          </p>
          <Button className="mt-4 w-full" disabled={!identity.name.trim()} onClick={()=>setStage("fill")}>Mulai mengisi</Button>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="sticky top-0 z-10 -mx-2 rounded-xl bg-background/90 p-3 backdrop-blur">
            <div className="mb-2 flex items-center justify-between text-xs"><span className="font-medium">{answered}/{questions.length} terjawab</span><span className="text-muted-foreground">{q.title}</span></div>
            <Progress value={progress} />
          </div>

          {questions.map((qq, i) => (
            <Card key={qq.id} className="bg-card-gradient p-5 shadow-card">
              <p className="text-xs font-semibold text-muted-foreground">Soal {i+1} · {qq.type === "multiple_choice" ? "Pilih satu" : "Cerita kamu"}</p>
              <p className="mt-1 font-medium">{qq.text}</p>
              {qq.type === "multiple_choice" ? (
                <RadioGroup className="mt-3" value={answers[qq.id] || ""} onValueChange={(v)=>setAnswers({...answers, [qq.id]: v})}>
                  {(qq.options as string[]).map((o, j) => (
                    <label key={j} className={`flex cursor-pointer items-center gap-3 rounded-xl border border-border/60 bg-background/60 p-3 transition-colors hover:bg-background ${answers[qq.id]===o ? "border-primary/50 bg-primary/5" : ""}`}>
                      <RadioGroupItem value={o} />
                      <span className="text-sm">{o}</span>
                    </label>
                  ))}
                </RadioGroup>
              ) : (
                <Textarea className="mt-3 bg-background/70" rows={4} value={answers[qq.id] || ""} onChange={e=>setAnswers({...answers, [qq.id]: e.target.value})} placeholder="Tuliskan ceritamu di sini..." />
              )}
            </Card>
          ))}

          <Button className="w-full shadow-soft" size="lg" disabled={submitting} onClick={submit}>{submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mengirim...</> : "Kirim jawaban"}</Button>
        </div>
      )}
    </div>
  );
}
