import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, ArrowLeft, Copy, Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/questionnaires/$id")({ component: QDetail });

function QDetail() {
  const { id } = Route.useParams();
  const [q, setQ] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [editMeta, setEditMeta] = useState(false);
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDesc, setMetaDesc] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editOptions, setEditOptions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"multiple_choice" | "essay">("multiple_choice");
  const [text, setText] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);

  useEffect(() => { void load(); }, [id]);
  async function load() {
    const [{ data: qd }, { data: qs }] = await Promise.all([
      supabase.from("questionnaires").select("*").eq("id", id).single(),
      supabase.from("questions").select("*").eq("questionnaire_id", id).order("order_index"),
    ]);
    setQ(qd); setQuestions(qs ?? []);
  }

  async function addQuestion() {
    if (!text.trim()) return toast.error("Isi pertanyaan");
    const mcCount = questions.filter(x => x.type === "multiple_choice").length;
    const esCount = questions.filter(x => x.type === "essay").length;
    const order = type === "multiple_choice" ? mcCount : 100 + esCount;
    const payload: any = { questionnaire_id: id, type, text, order_index: order };
    if (type === "multiple_choice") {
      if (options.some(o => !o.trim())) return toast.error("Lengkapi 4 opsi");
      payload.options = options;
    }
    const { error } = await supabase.from("questions").insert(payload);
    if (error) return toast.error(error.message);
    setOpen(false); setText(""); setOptions(["","","",""]);
    toast.success("Soal ditambahkan");
    await load();
  }

  async function delQuestion(qid: string) {
    if (!confirm("Hapus soal ini?")) return;
    await supabase.from("questions").delete().eq("id", qid);
    await load();
  }

  function startEdit(qq: any) {
    setEditingId(qq.id);
    setEditText(qq.text);
    setEditOptions(qq.options ? [...qq.options] : []);
  }
  async function saveEdit(qq: any) {
    if (!editText.trim()) return toast.error("Pertanyaan kosong");
    const payload: any = { text: editText };
    if (qq.type === "multiple_choice") {
      if (editOptions.some(o => !o.trim())) return toast.error("Lengkapi semua opsi");
      payload.options = editOptions;
    }
    const { error } = await supabase.from("questions").update(payload).eq("id", qq.id);
    if (error) return toast.error(error.message);
    setEditingId(null);
    toast.success("Soal disimpan");
    await load();
  }

  async function saveMeta() {
    if (!metaTitle.trim()) return toast.error("Judul wajib");
    const { error } = await supabase.from("questionnaires").update({ title: metaTitle, description: metaDesc }).eq("id", id);
    if (error) return toast.error(error.message);
    setEditMeta(false);
    toast.success("Kuesioner disimpan");
    await load();
  }

  async function toggleStatus() {
    const next = q.status === "active" ? "inactive" : "active";
    await supabase.from("questionnaires").update({ status: next }).eq("id", id);
    toast.success(`Status: ${next}`);
    void load();
  }

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/q/${q.access_code}`);
    toast.success("Link disalin");
  }

  if (!q) return <p>Memuat...</p>;

  const mc = questions.filter(x => x.type === "multiple_choice");
  const es = questions.filter(x => x.type === "essay");

  return (
    <div className="space-y-6">
      <Link to="/dashboard/questionnaires" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Kembali</Link>

      <Card className="bg-card-gradient p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {editMeta ? (
              <div className="space-y-2">
                <Input value={metaTitle} onChange={e=>setMetaTitle(e.target.value)} className="font-display text-xl font-bold" />
                <Textarea value={metaDesc} onChange={e=>setMetaDesc(e.target.value)} rows={2} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveMeta} className="gap-1"><Save className="h-3.5 w-3.5" /> Simpan</Button>
                  <Button size="sm" variant="ghost" onClick={()=>setEditMeta(false)}>Batal</Button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="font-display text-2xl font-bold">{q.title}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{q.description}</p>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!editMeta && <Button size="sm" variant="ghost" onClick={()=>{ setMetaTitle(q.title); setMetaDesc(q.description||""); setEditMeta(true); }}><Pencil className="h-4 w-4" /></Button>}
            <code className="rounded-lg bg-background px-3 py-1.5 text-base font-semibold tracking-wider">{q.access_code}</code>
            <Button size="sm" variant="ghost" onClick={copyLink}><Copy className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" onClick={toggleStatus}>{q.status === "active" ? "Nonaktifkan" : "Aktifkan"}</Button>
          </div>
        </div>
        <div className="mt-3 flex gap-3 text-xs">
          <span className="rounded-full bg-primary/15 px-2.5 py-0.5 font-medium text-primary">{mc.length} pilihan ganda</span>
          <span className="rounded-full bg-warm/40 px-2.5 py-0.5 font-medium text-warm-foreground">{es.length} esai</span>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold">Daftar soal</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Tambah soal</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Tambah soal manual</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Tipe</Label>
                <Select value={type} onValueChange={(v: any) => setType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multiple_choice">Pilihan ganda</SelectItem>
                    <SelectItem value="essay">Esai / cerita</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Pertanyaan</Label><Textarea value={text} onChange={e=>setText(e.target.value)} /></div>
              {type === "multiple_choice" && (
                <div className="space-y-2">
                  <Label>4 Opsi (urut dari risiko rendah ke tinggi)</Label>
                  {options.map((o,i)=>(
                    <Input key={i} value={o} onChange={e=>{const n=[...options];n[i]=e.target.value;setOptions(n);}} placeholder={`Opsi ${i+1}`} />
                  ))}
                </div>
              )}
            </div>
            <DialogFooter><Button onClick={addQuestion}>Simpan</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {questions.map((qq, i) => (
          <Card key={qq.id} className="bg-card-gradient p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">#{i+1}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${qq.type === "multiple_choice" ? "bg-primary/15 text-primary" : "bg-warm/40 text-warm-foreground"}`}>
                    {qq.type === "multiple_choice" ? "Pilihan ganda" : "Esai"}
                  </span>
                </div>
                <p className="mt-2 font-medium">{qq.text}</p>
                {qq.options && (
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {(qq.options as string[]).map((o,j) => <li key={j}>• {o}</li>)}
                  </ul>
                )}
              </div>
              <Button size="icon" variant="ghost" onClick={() => delQuestion(qq.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </Card>
        ))}
        {questions.length === 0 && <Card className="p-10 text-center text-sm text-muted-foreground">Belum ada soal. Tambahkan manual atau buat ulang dengan AI.</Card>}
      </div>
    </div>
  );
}
