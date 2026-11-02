"use client";

import { useActionState, useState } from "react";
import { DIFFICULTIES, REASONS, type Reason } from "@/lib/errors";
import { SECTION_LABEL, type Domain, type Section, type Skill } from "@/lib/skills";
import { logError, type LogErrorState } from "../actions";
import { ScreenshotPicker } from "./screenshot-picker";

const CHOICES = ["A", "B", "C", "D"];

type Props = { domains: Domain[]; skills: Skill[] };

export function ErrorForm(props: Props) {
  const [state, action, saving] = useActionState<LogErrorState, FormData>(logError, {});
  return (
    <form action={action} className="space-y-4">
      {state.justSaved && (
        <p className="rounded-xl bg-good/10 p-3 text-sm font-medium text-good">✓ Saved. Next one!</p>
      )}
      {/* A new key after "Save + another" clears the fields but keeps section and skill. */}
      <Fields key={state.formKey ?? 0} {...props} state={state} saving={saving} />
    </form>
  );
}

function Fields({ domains, skills, state, saving }: Props & { state: LogErrorState; saving: boolean }) {
  // Controlled so a failed save never wipes what she typed.
  const [form, setForm] = useState({
    section: (state.keep?.section ?? "rw") as Section,
    skill_id: state.keep?.skill_id ?? "",
    difficulty: state.keep?.difficulty ?? "medium",
    question_text: "",
    her_answer: "",
    correct_answer: "",
    reason: "" as Reason | "",
    notes: "",
    screenshot_path: "",
  });
  const [uploading, setUploading] = useState(false);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));
  const fe = state.fieldErrors ?? {};

  return (
    <>
      {Object.entries(form).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}

      <section className="card space-y-4 p-4">
        <Segmented
          label="Section"
          options={(["rw", "math"] as const).map((s) => ({ value: s, label: SECTION_LABEL[s] }))}
          value={form.section}
          onChange={(s) => setForm((f) => ({ ...f, section: s, skill_id: "" }))}
        />
        <label className="block">
          <span className="text-sm font-medium text-muted">Skill</span>
          <select
            className={`field mt-1 ${fe.skill_id ? "border-bad" : ""}`}
            value={form.skill_id}
            onChange={(e) => set("skill_id", e.target.value)}
          >
            <option value="">Choose a skill…</option>
            {domains
              .filter((d) => d.section === form.section)
              .map((d) => (
                <optgroup key={d.id} label={d.name}>
                  {skills
                    .filter((s) => s.domain_id === d.id)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </optgroup>
              ))}
          </select>
          <FieldError message={fe.skill_id} />
        </label>
        <Segmented
          label="Difficulty"
          options={DIFFICULTIES.map((d) => ({ value: d, label: d[0].toUpperCase() + d.slice(1) }))}
          value={form.difficulty}
          onChange={(d) => set("difficulty", d)}
        />
      </section>

      <section className="card space-y-4 p-4">
        <label className="block">
          <span className="text-sm font-medium text-muted">The question</span>
          <textarea
            rows={4}
            className={`field mt-1 ${fe.question_text ? "border-bad" : ""}`}
            placeholder="Paste the question, or a short description like “percent change, two-step”"
            value={form.question_text}
            onChange={(e) => set("question_text", e.target.value)}
          />
          <FieldError message={fe.question_text} />
        </label>
        <ScreenshotPicker
          path={form.screenshot_path}
          onChange={(p) => set("screenshot_path", p)}
          onUploading={setUploading}
          error={fe.screenshot}
        />
      </section>

      <section className="card grid grid-cols-2 gap-3 p-4">
        <AnswerField
          label="Your answer"
          value={form.her_answer}
          onChange={(v) => set("her_answer", v)}
          error={fe.her_answer}
        />
        <AnswerField
          label="Correct answer"
          value={form.correct_answer}
          onChange={(v) => set("correct_answer", v)}
          error={fe.correct_answer}
        />
      </section>

      <section className="card p-4">
        <p className="text-sm font-medium text-muted">Why did you miss it?</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(Object.keys(REASONS) as Reason[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => set("reason", r)}
              aria-pressed={form.reason === r}
              className={`rounded-xl border p-3 text-left transition ${
                form.reason === r ? "border-accent bg-accent-soft" : "border-line bg-card"
              }`}
            >
              <span className="block text-sm font-semibold">
                {REASONS[r].icon} {REASONS[r].label}
              </span>
              <span className="block text-xs text-muted">{REASONS[r].hint}</span>
            </button>
          ))}
        </div>
        <FieldError message={fe.reason} />
        <label className="mt-4 block">
          <span className="text-sm font-medium text-muted">Note to future you (optional)</span>
          <input
            className="field mt-1"
            placeholder="e.g. read the question twice: it asked for x + 2, not x"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </label>
      </section>

      {state.error && <p className="rounded-xl bg-bad/10 p-3 text-sm text-bad">{state.error}</p>}
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <button className="btn-primary" disabled={saving || uploading}>
          {uploading ? "Uploading…" : saving ? "Saving…" : "Save"}
        </button>
        <button name="again" value="1" className="btn-ghost text-sm" disabled={saving || uploading}>
          Save + another
        </button>
      </div>
    </>
  );
}

function Segmented<T extends string>({
  label, options, value, onChange,
}: { label: string; options: { value: T; label: string }[]; value: string; onChange: (v: T) => void }) {
  return (
    <div>
      <span className="text-sm font-medium text-muted">{label}</span>
      <div className="mt-1 flex gap-1 rounded-xl border border-line p-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${value === o.value ? "bg-accent text-white" : "text-muted"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function AnswerField({
  label, value, onChange, error,
}: { label: string; value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <div>
      <span className="text-sm font-medium text-muted">{label}</span>
      <div className="mt-1 flex gap-1">
        {CHOICES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-pressed={value === c}
            className={`size-9 flex-1 rounded-lg border text-sm font-semibold ${value === c ? "border-accent bg-accent text-white" : "border-line"}`}
          >
            {c}
          </button>
        ))}
      </div>
      <input
        className={`field mt-1.5 py-2 ${error ? "border-bad" : ""}`}
        placeholder="or type it"
        aria-label={label}
        value={CHOICES.includes(value) ? "" : value}
        onChange={(e) => onChange(e.target.value)}
      />
      <FieldError message={error} />
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <span className="mt-1 block text-xs text-bad">{message}</span> : null;
}
