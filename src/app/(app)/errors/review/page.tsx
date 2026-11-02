import Link from "next/link";
import { Suspense } from "react";
import { requireMember } from "@/lib/auth";
import { getDueErrors, signScreenshots } from "@/lib/data/errors";
import { ReviewSession } from "./review-session";

export default function ReviewPage() {
  return (
    <div className="space-y-4">
      <Link href="/errors" className="text-sm text-muted">
        ← Error log
      </Link>
      <Suspense fallback={<div className="card h-80 animate-pulse" />}>
        <Loader />
      </Suspense>
    </div>
  );
}

async function Loader() {
  await requireMember();
  const items = await getDueErrors();
  const urls = await signScreenshots(items.map((i) => i.screenshot_path));
  return <ReviewSession items={items} screenshotUrls={urls} />;
}
