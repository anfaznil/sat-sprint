import { Suspense } from "react";
import { requireMember } from "@/lib/auth";
import { getSkillMap } from "@/lib/data/skills";
import { today } from "@/lib/dates";
import { ResultsForm } from "./results-form";

export default function NewTestPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Add Bluebook results</h1>
        <p className="mt-1 text-sm text-muted">
          In Bluebook, open the test&apos;s score details and review the questions. Each one lists its skill. Count
          correct / total per skill. Leave a skill blank if it wasn&apos;t on the test or you didn&apos;t track it.
        </p>
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
  return <ResultsForm domains={domains} skills={skills} defaultDate={today()} />;
}
