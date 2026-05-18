import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/students")({ component: Students });

function Students() {
  const [list, setList] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ nis: "", full_name: "", class_name: "", gender: "", birth_date: "", notes: "" });

  useEffect(() => { void load(); }, []);
  async function load() {
    const { data } = await supabase.from("students").select("*").order("created_at", { ascending: false });
    setList(data ?? []);
  }
  async function add() {
    if (!form.full_name.trim()) return toast.error("Nama wajib diisi");
    const { data: { user } } = await supabase.auth.getUser();
    const payload: any = { ...form, created_by: user!.id };
    if (!payload.birth_date) delete payload.birth_date;
    const { error } = await supabase.from("students").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Siswa ditambahkan");
    setOpen(false); setForm({ nis: "", full_name: "", class_name: "", gender: "", birth_date: "", notes: "" });
    await load();
  }
  async function del(id: string) {
    if (!confirm("Hapus siswa?")) return;
    await supabase.from("students").delete().eq("id", id);
    await load();
  }

  const filtered = list.filter(s => !q || s.full_name.toLowerCase().includes(q.toLowerCase()) || s.nis?.includes(q) || s.class_name?.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Siswa</h1>
          <p className="text-muted-foreground">Database siswa sekolah Anda.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Tambah siswa</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Tambah siswa</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nama lengkap *</Label><Input value={form.full_name} onChange={e=>setForm({...form, full_name: e.target.value})} /></div>
              <div><Label>NIS</Label><Input value={form.nis} onChange={e=>setForm({...form, nis: e.target.value})} /></div>
              <div><Label>Kelas</Label><Input value={form.class_name} onChange={e=>setForm({...form, class_name: e.target.value})} placeholder="mis. X IPA 1" /></div>
              <div><Label>Jenis kelamin</Label><Input value={form.gender} onChange={e=>setForm({...form, gender: e.target.value})} placeholder="L / P" /></div>
              <div><Label>Tanggal lahir</Label><Input type="date" value={form.birth_date} onChange={e=>setForm({...form, birth_date: e.target.value})} /></div>
              <div className="col-span-2"><Label>Catatan</Label><Textarea value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} /></div>
            </div>
            <DialogFooter><Button onClick={add}>Simpan</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Input value={q} onChange={e=>setQ(e.target.value)} placeholder="Cari nama, NIS, atau kelas..." className="max-w-sm bg-background" />

      <Card className="bg-card-gradient shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 text-left text-xs uppercase text-muted-foreground">
              <tr><th className="p-3">Nama</th><th className="p-3">NIS</th><th className="p-3">Kelas</th><th className="p-3">JK</th><th className="p-3"></th></tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className="border-b border-border/40 last:border-0">
                  <td className="p-3 font-medium">{s.full_name}</td>
                  <td className="p-3 text-muted-foreground">{s.nis || "-"}</td>
                  <td className="p-3">{s.class_name || "-"}</td>
                  <td className="p-3">{s.gender || "-"}</td>
                  <td className="p-3 text-right"><Button size="icon" variant="ghost" onClick={()=>del(s.id)} aria-label={`Hapus siswa ${s.full_name}`}><Trash2 className="h-4 w-4 text-destructive" /></Button></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-muted-foreground">Belum ada siswa.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
