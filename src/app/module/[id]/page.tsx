import { redirect, notFound } from "next/navigation";
import { Suspense } from "react";
import { requireMember } from "@/lib/auth";
import { getModule, getRunItems, serverTime, submitModule, timeIsUp } from "@/lib/data/modules";
import { FORMAT } from "@/lib/modules/blueprint";
import { ModuleRunner } from "./runner";

// The timed screen, full-screen without the app's bottom bar, like Bluebook.
export default function TakeModulePage({ params }: PageProps<"/module/[id]">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg" />}>
      <Take params={params} />
    </Suspense>
  );
}

async function Take({ params }: { params: Promise<{ id: string }> }) {
  await requireMember();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const mod = await getModule(id);
  if (!mod) notFound();
  if (mod.status === "submitted") redirect(`/modules/${id}`);
  if (mod.status !== "in_progress" || !mod.deadline_at) redirect("/drill");
  // Came back after time ran out: grade what was answered.
  if (timeIsUp(mod)) {
    await submitModule(id);
    redirect(`/modules/${id}`);
  }

  const items = await getRunItems(id);
  const section = mod.section === "rw" ? 1 : 2;
  const title = `Section ${section}, Module ${mod.module_no}: ${FORMAT[mod.section].label}`;
  return <ModuleRunner moduleId={id} title={title} items={items} deadline={mod.deadline_at} serverNow={serverTime()} />;
}
