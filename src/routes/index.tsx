import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Brain, Shield, Sparkles, HeartHandshake, FileQuestion, BarChart3, ArrowRight } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-soft">
            <Shield className="h-5 w-5" />
          </div>
          <div className="font-display text-xl font-bold">BroGuardAI</div>
        </Link>
        <nav className="flex items-center gap-2">
          <Link to="/auth"><Button variant="ghost">Masuk Guru BK</Button></Link>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-8 md:pt-16">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Didukung AI & Data Mining
            </span>
            <h1 className="mt-5 font-display text-4xl font-bold leading-tight md:text-6xl">
              Pendamping cerdas untuk <span className="bg-gradient-to-r from-primary via-warm to-secondary bg-clip-text text-transparent">kesehatan mental siswa</span>
            </h1>
            <p className="mt-5 max-w-lg text-base text-muted-foreground md:text-lg">
              BroGuardAI membantu guru BK mendeteksi dini risiko psikologis siswa lewat kuesioner adaptif yang dianalisis oleh AI — lengkap dengan rekomendasi tindak lanjut yang empatik.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/auth"><Button size="lg" className="gap-2 shadow-soft">Mulai sebagai Guru BK <ArrowRight className="h-4 w-4" /></Button></Link>
            </div>

            <Card className="mt-8 border-warm/40 bg-card-gradient p-5 shadow-card">
              <p className="mb-2 text-sm font-medium">Saya seorang siswa — masuk ke kuesioner</p>
              <form
                className="flex gap-2"
                onSubmit={(e) => { e.preventDefault(); if (code.trim()) navigate({ to: "/q/$code", params: { code: code.trim().toUpperCase() } }); }}
              >
                <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Masukkan kode (mis. AB12CD)" className="bg-background uppercase" maxLength={10} />
                <Button type="submit" variant="secondary">Lanjut</Button>
              </form>
            </Card>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 -z-10 rounded-3xl bg-hero-gradient blur-2xl opacity-60" />
            <Card className="bg-card-gradient p-7 shadow-soft">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-foreground"><Brain className="h-5 w-5" /></div>
                <div>
                  <p className="font-display text-lg font-semibold">Analisis AI</p>
                  <p className="text-sm text-muted-foreground">Skor risiko, indikator, & rekomendasi tindak lanjut dalam hitungan detik.</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Stat label="Pilihan ganda" value="10 soal" />
                <Stat label="Esai reflektif" value="5 soal" />
                <Stat label="Privasi" value="Terjaga" />
                <Stat label="Bahasa" value="Indonesia" />
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-5 md:grid-cols-3">
          <Feature icon={FileQuestion} title="Buat kuesioner instan" desc="Generate 10 pilihan ganda + 5 esai dengan AI, atau susun manual sesuai kebutuhan kelas Anda." />
          <Feature icon={Brain} title="Analisis cerdas" desc="Mesin AI mengidentifikasi indikator risiko, skor 0–100, dan tingkat keparahan secara empatik." />
          <Feature icon={HeartHandshake} title="Rekomendasi tindak lanjut" desc="Saran konkret untuk konseling, observasi, dan komunikasi dengan orang tua." />
        </div>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} BroGuardAI · Dibangun dengan empati untuk siswa Indonesia.
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background/70 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-base font-semibold">{value}</p>
    </div>
  );
}

function Feature({ icon: Icon, title, desc }: any) {
  return (
    <Card className="bg-card-gradient p-6 shadow-card">
      <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary"><Icon className="h-5 w-5" /></div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </Card>
  );
}
