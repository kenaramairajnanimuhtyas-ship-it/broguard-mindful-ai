import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, CheckCircle2 } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/q/$code/done")({
  validateSearch: z.object({ sid: z.string().optional() }),
  component: Done,
});

function Done() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="max-w-md bg-card-gradient p-8 text-center shadow-soft">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-success/20 text-success-foreground">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h1 className="font-display text-2xl font-bold">Terima kasih sudah jujur ✨</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Jawabanmu sudah tersimpan dan akan dianalisis. Guru BK akan menindaklanjuti bila perlu. Ingat, kamu tidak sendiri 💛
        </p>
        <div className="mt-5 rounded-xl bg-warm/30 p-3 text-xs text-warm-foreground">
          <Heart className="mr-1 inline h-3.5 w-3.5" /> Jika kamu sedang merasa sangat tidak baik, segera bicara ke guru BK, orang tua, atau hubungi 119 ext 8.
        </div>
        <Link to="/"><Button variant="outline" className="mt-5">Kembali ke beranda</Button></Link>
      </Card>
    </div>
  );
}
