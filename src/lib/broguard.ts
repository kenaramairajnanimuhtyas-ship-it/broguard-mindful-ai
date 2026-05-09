export function riskBadge(level: string) {
  const map: Record<string, { label: string; cls: string }> = {
    rendah: { label: "Risiko Rendah", cls: "bg-success/20 text-success-foreground border-success/40" },
    sedang: { label: "Risiko Sedang", cls: "bg-warm/30 text-warm-foreground border-warm/50" },
    tinggi: { label: "Risiko Tinggi", cls: "bg-destructive/15 text-destructive border-destructive/40" },
    sangat_tinggi: { label: "Sangat Tinggi", cls: "bg-destructive text-destructive-foreground border-destructive" },
  };
  return map[level] ?? { label: level, cls: "bg-muted text-foreground border-border" };
}

export function generateAccessCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
