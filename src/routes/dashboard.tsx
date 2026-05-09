import { createFileRoute } from "@tanstack/react-router";
import { StaffShell } from "@/components/StaffShell";

export const Route = createFileRoute("/dashboard")({ component: StaffShell });
