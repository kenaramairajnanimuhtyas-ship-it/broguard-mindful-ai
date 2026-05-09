import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { generateAccessCode } from "@/lib/broguard";
import { Plus, Sparkles, Copy, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/questionnaires")({ component: Questionnaires });

function Questionnaires() {
  const [list, setList] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiContext, setAiContext] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualDesc, setManualDesc] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { void load(); }, []);
  async function load() {
    const { data } = await supabase.from("questionnaires").select("*, sessions(count)").order("created_at", { ascending: false });
    setList(data ?? []);
  }

  async function createWithAI() {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-questionnaire", { body: { topic: aiTopic, context: aiContext } });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      const { data: { user } } = await supabase.auth.getUser();
      const code = generateAccessCode();
      const { data: q, error: qerr } = await supabase.from("questionnaires").insert({
        title: data.title, description: data.description, access_code: code, created_by: user!.id,
      }).select().single();
      if (qerr) throw qerr;
      const rows: any[] = [];
      data.multiple_choice.forEach((m: any, i: number) => rows.push({
        questionnaire_id: q.id, type: "multiple_choice", text: m.text, options: m.options, order_index: i,
      }));
      data.essay.forEach((t: string, i: number) => rows.push({
        questionnaire_id: q.id, type: "essay", text: t, order_index: 100 + i,
      }));
      const { error: qserr } = await supabase.from("questions").insert(rows);
      if (qserr) throw qserr;
      toast.success("Kuesioner dibuat dengan AI 🎉");
      setOpen(false); setAiTopic(""); setAiContext("");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Gagal membuat kuesioner");
    } finally { setBusy(false); }
  }

  async function createManual() {
    if (!manualTitle.trim()) return toast.error("Judul wajib diisi");
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("questionnaires").insert({
        title: manualTitle, description: manualDesc, access_code: generateAccessCode(), created_by: user!.id,
      });
      if (error) throw error;
      toast.success("Kuesioner kosong dibuat. Tambahkan soal manual.");
      setOpen(false); setManualTitle(""); setManualDesc("");
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  function copyLink(code: string) {
    const url = `${window.location.origin}/q/${code}`;
    navigator.clipboard.writeText(url);
    toast.success("Link disalin");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Kuesioner</h1>
          <p className="text-muted-foreground">Kelola kuesioner deteksi risiko psikologis siswa.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Buat baru</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Buat kuesioner</DialogTitle></DialogHeader>
            <Tabs defaultValue="ai">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="ai" className="gap-2"><Sparkles className="h-3.5 w-3.5" /> Generate AI</TabsTrigger>
                <TabsTrigger value="manual">Manual</TabsTrigger>
              </TabsList>
              <TabsContent value="ai" className="space-y-3 pt-3">
                <div><Label>Topik fokus</Label><Input value={aiTopic} onChange={e=>setAiTopic(e.target.value)} placeholder="mis. Kecemasan menjelang ujian" /></div>
                <div><Label>Konteks tambahan (opsional)</Label><Textarea value={aiContext} onChange={e=>setAiContext(e.target.value)} placeholder="Latar belakang siswa, isu kelas, dll" /></div>
                <p className="text-xs text-muted-foreground">AI akan membuat 10 soal pilihan ganda + 5 soal esai.</p>
                <DialogFooter>
                  <Button onClick={createWithAI} disabled={busy} className="gap-2">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Generate</Button>
                </DialogFooter>
              </TabsContent>
              <TabsContent value="manual" className="space-y-3 pt-3">
                <div><Label>Judul</Label><Input value={manualTitle} onChange={e=>setManualTitle(e.target.value)} /></div>
                <div><Label>Deskripsi</Label><Textarea value={manualDesc} onChange={e=>setManualDesc(e.target.value)} /></div>
                <DialogFooter>
                  <Button onClick={createManual} disabled={busy}>Buat</Button>
                </DialogFooter>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {list.map((q) => (
          <Card key={q.id} className="bg-card-gradient p-5 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link to="/dashboard/questionnaires/$id" params={{ id: q.id }} className="font-display text-lg font-semibold hover:underline">{q.title}</Link>
                <p className="line-clamp-2 text-sm text-muted-foreground">{q.description || "Tanpa deskripsi"}</p>
              </div>
              <span className="rounded-full bg-accent/40 px-2.5 py-0.5 text-xs font-medium text-accent-foreground">{q.status}</span>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <code className="rounded-lg bg-background px-2 py-1 text-sm font-semibold tracking-wider">{q.access_code}</code>
              <Button size="sm" variant="ghost" onClick={() => copyLink(q.access_code)}><Copy className="h-3.5 w-3.5" /></Button>
              <a href={`/q/${q.access_code}`} target="_blank" rel="noreferrer">
                <Button size="sm" variant="ghost"><ExternalLink className="h-3.5 w-3.5" /></Button>
              </a>
              <span className="ml-auto text-xs text-muted-foreground">{q.sessions?.[0]?.count ?? 0} sesi</span>
            </div>
          </Card>
        ))}
        {list.length === 0 && <Card className="col-span-full p-10 text-center text-sm text-muted-foreground">Belum ada kuesioner. Klik "Buat baru" untuk memulai.</Card>}
      </div>
    </div>
  );
}
