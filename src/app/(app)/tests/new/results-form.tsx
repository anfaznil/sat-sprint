"use client";

import { useActionState, useState } from "react";
import { SECTION_LABEL, type Domain, type Section, type Skill } from "@/lib/skills";
import { saveTest, type SaveTestState } from "../actions";

type Entry = { c: string; t: string };

export function ResultsForm({ domains, skills, defaultDate }: { domains: Domain[]; skills: Skill[]; defaultDate: string }) {
  const [state, action, saving] = useActionState<SaveTestState, FormData>(saveTest, {});
  const [section, setSection] = useState<Section>("rw");
  // Controlled so a failed save never wipes what she typed.
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [meta, setMeta] = useState({ label: "", taken_on: defaultDate, rw_score: "", math_score: "" });

  const set = (id: string, key: keyof Entry, value: string) =>
    setEntries((prev) => ({ ...prev, [id]: { ...{ c: "", t: "" }, ...prev[id], [key]: value.replace(/\D/g, "") } }));

  const totals = (s: Section) => {
    let c = 0, t = 0, n = 0;
    for (const d of domains.filter((d) => d.section === s)) {
      for (const sk of skills.filter((sk) => sk.domain_id === d.id)) {
        const e = entries[sk.id];
        if (e?.c && e?.t && Number(e.c) <= Number(e.t)) { c += Number(e.c); t += Number(e.t); n++; }
      }
    }
    return { c, t, n };
  };

  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-4">
      <section className="card space-y-3 p-4">
        <label className="block">
          <span className="text-sm font-medium text-muted">Name</span>
          <input
            name="label"
            className="field mt-1"
            placeholder="e.g. Bluebook Practice Test 4"
            value={meta.label}
            onChange={(e) => setMeta({ ...meta, label: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-muted">Date taken</span>
          <input
            name="taken_on"
            type="date"
            required
            className="field mt-1"
            value={meta.taken_on}
            onChange={(e) => setMeta({ ...meta, taken_on: e.target.value })}
          />
          {fieldErrors.taken_on && <span className="text-sm text-bad">{fieldErrors.taken_on}</span>}
        </label>
        <div className="grid grid-cols-2 gap-3">
          {(["rw_score", "math_score"] as const).map((key) => (
            <label key={key} className="block">
              <span className="text-sm font-medium text-muted">{key === "rw_score" ? "R&W score" : "Math score"}</span>
              <input
                name={key}
                inputMode="numeric"
                className="field mt-1"
                placeholder="optional"
                value={meta[key]}
                onChange={(e) => setMeta({ ...meta, [key]: e.target.value.replace(/\D/g, "") })}
              />
              {fieldErrors[key] && <span className="text-sm text-bad">{fieldErrors[key]}</span>}
            </label>
          ))}
        </div>
      </section>

      <div className="sticky top-2 z-10 grid grid-cols-2 gap-1 rounded-xl border border-line bg-card p-1 shadow-sm">
        {(["rw", "math"] as const).map((s) => {
          const t = totals(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSection(s)}
              className={`rounded-lg px-2 py-2 text-sm font-semibold transition ${section === s ? "bg-accent text-white" : "text-muted"}`}
            >
              {SECTION_LABEL[s]}
              <span className="block text-xs font-normal opacity-80">
                {t.n === 0 ? "nothing yet" : `${t.c}/${t.t} · ${t.n} skills`}
              </span>
            </button>
          );
        })}
      </div>

      {/* Both sections stay mounted (just hidden) so every input is submitted. */}
      {(["rw", "math"] as const).map((s) => (
        <div key={s} hidden={section !== s} className="space-y-4">
          {domains
            .filter((d) => d.section === s)
            .map((domain) => (
              <section key={domain.id} className="card p-4">
                <h2 className="mb-3 font-semibold">{domain.name}</h2>
                <ul className="divide-y divide-line">
                  {skills
                    .filter((sk) => sk.domain_id === domain.id)
                    .map((skill) => {
                      const e = entries[skill.id] ?? { c: "", t: "" };
                      const over = e.c !== "" && e.t !== "" && Number(e.c) > Number(e.t);
                      const error = over ? "Correct can't be more than total." : fieldErrors[skill.id];
                      return (
                        <li key={skill.id} className="py-3 first:pt-0 last:pb-0">
                          <div className="flex items-center gap-3">
                            <span className="min-w-0 flex-1 text-sm leading-snug">{skill.name}</span>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <NumberBox
                                name={`c_${skill.id}`}
                                label={`${skill.name}: correct`}
                                value={e.c}
                                invalid={Boolean(error)}
                                onChange={(v) => set(skill.id, "c", v)}
                              />
                              <span className="text-muted">/</span>
                              <NumberBox
                                name={`t_${skill.id}`}
                                label={`${skill.name}: total`}
                                value={e.t}
                                invalid={Boolean(error)}
                                onChange={(v) => set(skill.id, "t", v)}
                              />
                            </div>
                          </div>
                          {error && <p className="mt-1 text-xs text-bad">{error}</p>}
                        </li>
                      );
                    })}
                </ul>
              </section>
            ))}
        </div>
      ))}

      {state.error && <p className="rounded-xl bg-bad/10 p-3 text-sm text-bad">{state.error}</p>}
      <button className="btn-primary sticky bottom-24 w-full shadow-lg" disabled={saving}>
        {saving ? "Saving…" : "Save results"}
      </button>
    </form>
  );
}

function NumberBox({
  name, label, value, invalid, onChange,
}: { name: string; label: string; value: string; invalid: boolean; onChange: (v: string) => void }) {
  return (
    <input
      name={name}
      aria-label={label}
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={2}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-12 rounded-lg border bg-card px-1 py-2 text-center text-base outline-none focus:ring-2 focus:ring-accent/25 ${invalid ? "border-bad" : "border-line focus:border-accent"}`}
    />
  );
}
