import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, ArrowLeft, Copy, Pencil, Save, X, CheckCircle2, AlertCircle, Loader2, Bug, ChevronDown, ChevronUp, FileEdit } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/questionnaires/$id")({ component: QDetail });

type SaveState = "idle" | "saving" | "saved" | "error";
type LogEntry = { ts: string; level: "info" | "success" | "error"; msg: string; detail?: string };

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

  // Save status + debug log
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const metaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function pushLog(level: LogEntry["level"], msg: string, detail?: string) {
    const entry: LogEntry = { ts: new Date().toLocaleTimeString(), level, msg, detail };
    setLogs((l) => [entry, ...l].slice(0, 50));
    if (level === "error") console.error("[QDetail]", msg, detail);
    else console.log("[QDetail]", msg, detail ?? "");
  }

  useEffect(() => { void load(); }, [id]);
  async function load() {
    pushLog("info", "Memuat kuesioner & soal");
    const [{ data: qd, error: qe }, { data: qs, error: qse }] = await Promise.all([
      supabase.from("questionnaires").select("*").eq("id", id).single(),
      supabase.from("questions").select("*").eq("questionnaire_id", id).order("order_index"),
    ]);
    if (qe) pushLog("error", "Gagal memuat kuesioner", qe.message);
    if (qse) pushLog("error", "Gagal memuat soal", qse.message);
    setQ(qd); setQuestions(qs ?? []);
    if (qd) pushLog("success", `Termuat: ${qs?.length ?? 0} soal · status ${qd.status}`);
  }

  async function addQuestion() {
    if (!text.trim()) { pushLog("error", "Validasi gagal", "Pertanyaan kosong"); return toast.error("Isi pertanyaan"); }
    const mcCount = questions.filter(x => x.type === "multiple_choice").length;
    const esCount = questions.filter(x => x.type === "essay").length;
    const order = type === "multiple_choice" ? mcCount : 100 + esCount;
    const payload: any = { questionnaire_id: id, type, text, order_index: order };
    if (type === "multiple_choice") {
      if (options.some(o => !o.trim())) { pushLog("error", "Validasi gagal", "Salah satu opsi kosong"); return toast.error("Lengkapi 4 opsi"); }
      payload.options = options;
    }
    setSaveState("saving"); pushLog("info", "Menyimpan soal baru…");
    const { error } = await supabase.from("questions").insert(payload);
    if (error) { setSaveState("error"); pushLog("error", "Gagal simpan soal", error.message); return toast.error(error.message); }
    setSaveState("saved"); setLastSavedAt(new Date());
    pushLog("success", "Soal baru tersimpan");
    setOpen(false); setText(""); setOptions(["","","",""]);
    toast.success("Soal ditambahkan");
    await load();
  }

  async function delQuestion(qid: string) {
    if (!confirm("Hapus soal ini?")) return;
    setSaveState("saving"); pushLog("info", `Menghapus soal ${qid.slice(0,8)}…`);
    const { error } = await supabase.from("questions").delete().eq("id", qid);
    if (error) { setSaveState("error"); pushLog("error", "Gagal hapus", error.message); return toast.error(error.message); }
    setSaveState("saved"); setLastSavedAt(new Date());
    pushLog("success", "Soal dihapus");
    await load();
  }

  function startEdit(qq: any) {
    setEditingId(qq.id);
    setEditText(qq.text);
    setEditOptions(qq.options ? [...qq.options] : []);
    pushLog("info", `Mulai edit soal #${qq.id.slice(0,8)} (draft)`);
  }

  // Autosave saat editing — debounce 1.5s
  useEffect(() => {
    if (!editingId) return;
    const qq = questions.find((x) => x.id === editingId);
    if (!qq) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => { void autosaveEdit(qq); }, 1500);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editText, editOptions, editingId]);

  async function autosaveEdit(qq: any) {
    if (!editText.trim()) { pushLog("error", "Autosave dibatalkan", "Pertanyaan kosong"); return; }
    if (qq.type === "multiple_choice" && editOptions.some(o => !o.trim())) {
      pushLog("error", "Autosave dibatalkan", "Opsi belum lengkap");
      return;
    }
    const payload: any = { text: editText };
    if (qq.type === "multiple_choice") payload.options = editOptions;
    setSaveState("saving"); pushLog("info", `Autosave soal #${qq.id.slice(0,8)}…`);
    const { error } = await supabase.from("questions").update(payload).eq("id", qq.id);
    if (error) { setSaveState("error"); pushLog("error", "Autosave gagal", error.message); return; }
    setSaveState("saved"); setLastSavedAt(new Date());
    pushLog("success", `Autosave OK #${qq.id.slice(0,8)}`);
  }

  async function saveEdit(qq: any) {
    if (!editText.trim()) { pushLog("error", "Simpan ditolak", "Pertanyaan kosong"); return toast.error("Pertanyaan kosong"); }
    const payload: any = { text: editText };
    if (qq.type === "multiple_choice") {
      if (editOptions.some(o => !o.trim())) { pushLog("error", "Simpan ditolak", "Opsi kosong"); return toast.error("Lengkapi semua opsi"); }
      payload.options = editOptions;
    }
    setSaveState("saving"); pushLog("info", "Menyimpan perubahan…");
    const { error } = await supabase.from("questions").update(payload).eq("id", qq.id);
    if (error) { setSaveState("error"); pushLog("error", "Gagal simpan", error.message); return toast.error(error.message); }
    setSaveState("saved"); setLastSavedAt(new Date());
    pushLog("success", "Perubahan disimpan");
    setEditingId(null);
    toast.success("Soal disimpan");
    await load();
  }

  // Autosave meta (judul/deskripsi) saat editMeta aktif
  useEffect(() => {
    if (!editMeta || !q) return;
    if (metaTimer.current) clearTimeout(metaTimer.current);
    metaTimer.current = setTimeout(() => { void autosaveMeta(); }, 1500);
    return () => { if (metaTimer.current) clearTimeout(metaTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metaTitle, metaDesc, editMeta]);

  async function autosaveMeta() {
    if (!metaTitle.trim()) { pushLog("error", "Autosave meta dibatalkan", "Judul kosong"); return; }
    setSaveState("saving"); pushLog("info", "Autosave judul/deskripsi…");
    const { error } = await supabase.from("questionnaires").update({ title: metaTitle, description: metaDesc }).eq("id", id);
    if (error) { setSaveState("error"); pushLog("error", "Autosave meta gagal", error.message); return; }
    setSaveState("saved"); setLastSavedAt(new Date());
    pushLog("success", "Judul/deskripsi tersimpan");
  }

  async function saveMeta() {
    if (!metaTitle.trim()) return toast.error("Judul wajib");
    setSaveState("saving"); pushLog("info", "Menyimpan meta…");
    const { error } = await supabase.from("questionnaires").update({ title: metaTitle, description: metaDesc }).eq("id", id);
    if (error) { setSaveState("error"); pushLog("error", "Gagal simpan meta", error.message); return toast.error(error.message); }
    setSaveState("saved"); setLastSavedAt(new Date());
    pushLog("success", "Meta tersimpan");
    setEditMeta(false);
    toast.success("Kuesioner disimpan");
    await load();
  }

  async function setStatus(next: "draft" | "active" | "inactive") {
    setSaveState("saving"); pushLog("info", `Mengubah status → ${next}`);
    const { error } = await supabase.from("questionnaires").update({ status: next }).eq("id", id);
    if (error) { setSaveState("error"); pushLog("error", "Gagal ubah status", error.message); return toast.error(error.message); }
    setSaveState("saved"); setLastSavedAt(new Date());
    pushLog("success", `Status: ${next}`);
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
  const isDraft = q.status === "draft" || q.status === "inactive";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link to="/dashboard/questionnaires" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Kembali</Link>
        <SaveBadge state={saveState} lastSavedAt={lastSavedAt} />
      </div>

      {isDraft && (
        <div className="flex items-center gap-2 rounded-lg border border-warm bg-warm/30 px-3 py-2 text-sm text-warm-foreground">
          <FileEdit className="h-4 w-4" />
          <span>Mode <strong>draft</strong> — kuesioner belum dipublikasikan. Siswa tidak bisa mengakses sampai diaktifkan.</span>
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => setStatus("active")}>Publikasikan</Button>
        </div>
      )}

      <Card className="bg-card-gradient p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {editMeta ? (
              <div className="space-y-2">
                <Input value={metaTitle} onChange={e=>setMetaTitle(e.target.value)} className="font-display text-xl font-bold" />
                <Textarea value={metaDesc} onChange={e=>setMetaDesc(e.target.value)} rows={2} />
                <p className="text-xs text-muted-foreground">Autosimpan aktif · perubahan disimpan otomatis 1,5 detik setelah berhenti mengetik.</p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveMeta} className="gap-1"><Save className="h-3.5 w-3.5" /> Simpan & tutup</Button>
                  <Button size="sm" variant="ghost" onClick={()=>setEditMeta(false)}>Tutup</Button>
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
            {q.status === "active"
              ? <Button size="sm" variant="outline" onClick={() => setStatus("draft")}>Jadikan draft</Button>
              : <Button size="sm" variant="outline" onClick={() => setStatus("active")}>Aktifkan</Button>}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <span className="rounded-full bg-primary/15 px-2.5 py-0.5 font-medium text-primary">{mc.length} pilihan ganda</span>
          <span className="rounded-full bg-warm/40 px-2.5 py-0.5 font-medium text-warm-foreground">{es.length} esai</span>
          <span className={`rounded-full px-2.5 py-0.5 font-medium ${q.status === "active" ? "bg-green-500/15 text-green-700 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>status: {q.status}</span>
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
        {questions.map((qq, i) => {
          const isEditing = editingId === qq.id;
          return (
          <Card key={qq.id} className="bg-card-gradient p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">#{i+1}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${qq.type === "multiple_choice" ? "bg-primary/15 text-primary" : "bg-warm/40 text-warm-foreground"}`}>
                    {qq.type === "multiple_choice" ? "Pilihan ganda" : "Esai"}
                  </span>
                  {isEditing && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">draft · autosimpan</span>}
                </div>
                {isEditing ? (
                  <div className="mt-2 space-y-2">
                    <Textarea value={editText} onChange={e=>setEditText(e.target.value)} />
                    {qq.type === "multiple_choice" && editOptions.map((o, j) => (
                      <Input key={j} value={o} onChange={e=>{ const n=[...editOptions]; n[j]=e.target.value; setEditOptions(n); }} placeholder={`Opsi ${j+1}`} />
                    ))}
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={()=>saveEdit(qq)} className="gap-1"><Save className="h-3.5 w-3.5" /> Simpan & tutup</Button>
                      <Button size="sm" variant="ghost" onClick={()=>setEditingId(null)} className="gap-1"><X className="h-3.5 w-3.5" /> Tutup</Button>
                      <span className="ml-auto text-xs text-muted-foreground">Autosimpan tiap 1,5 detik</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="mt-2 font-medium">{qq.text}</p>
                    {qq.options && (
                      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                        {(qq.options as string[]).map((o,j) => <li key={j}>• {o}</li>)}
                      </ul>
                    )}
                  </>
                )}
              </div>
              {!isEditing && (
                <div className="flex flex-col gap-1">
                  <Button size="icon" variant="ghost" onClick={()=>startEdit(qq)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => delQuestion(qq.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              )}
            </div>
          </Card>
        );})}
        {questions.length === 0 && <Card className="p-10 text-center text-sm text-muted-foreground">Belum ada soal. Tambahkan manual atau buat ulang dengan AI.</Card>}
      </div>

      {/* Debug / Log panel */}
      <Card className="overflow-hidden">
        <button
          onClick={() => setLogOpen(o => !o)}
          className="flex w-full items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          <span className="inline-flex items-center gap-2"><Bug className="h-4 w-4" /> Panel log & debug ({logs.length})</span>
          {logOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {logOpen && (
          <div className="max-h-72 overflow-auto p-3 font-mono text-xs">
            {logs.length === 0 && <p className="text-muted-foreground">Belum ada aktivitas.</p>}
            {logs.map((l, i) => (
              <div key={i} className="flex gap-2 border-b border-border/50 py-1 last:border-0">
                <span className="text-muted-foreground">{l.ts}</span>
                <span className={
                  l.level === "error" ? "text-destructive" :
                  l.level === "success" ? "text-green-600 dark:text-green-400" :
                  "text-foreground"
                }>{l.level.toUpperCase()}</span>
                <span className="flex-1">
                  {l.msg}
                  {l.detail && <div className="text-muted-foreground">↳ {l.detail}</div>}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function SaveBadge({ state, lastSavedAt }: { state: SaveState; lastSavedAt: Date | null }) {
  if (state === "saving") return <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium"><Loader2 className="h-3 w-3 animate-spin" /> Menyimpan…</span>;
  if (state === "error") return <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-3 py-1 text-xs font-medium text-destructive"><AlertCircle className="h-3 w-3" /> Gagal simpan — lihat panel log</span>;
  if (state === "saved") return <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/15 px-3 py-1 text-xs font-medium text-green-700 dark:text-green-400"><CheckCircle2 className="h-3 w-3" /> Tersimpan {lastSavedAt ? lastSavedAt.toLocaleTimeString() : ""}</span>;
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">Siap</span>;
}
