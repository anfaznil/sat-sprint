import { Suspense } from "react";
import { requireMember } from "@/lib/auth";
import { getSkillMap } from "@/lib/data/skills";
import { ErrorForm } from "./error-form";

export default function NewErrorPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Log a miss</h1>
        <p className="mt-1 text-sm text-muted">Every miss you log is a point you can win back. It comes back for review tomorrow.</p>
      </div>
      <Suspense fallback={<div className="card h-96 animate-pulse" />}>
        <FormLoader />
      </Suspense>
    </div>
  );
}

async function FormLoader() {
  await requireMember();
  const { domains, skills } = await getSkillMap();
  return <ErrorForm domains={domains} skills={skills} />;
}
