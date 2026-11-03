import { Ico } from "@/components/ico";
import { Lightbulb } from "lucide-react";
// Short, original how-tos for the Desmos calculator built into Bluebook's Math section.
const TIPS: { title: string; when: string; steps: string[]; example?: string }[] = [
  {
    title: "Solve an equation without algebra",
    when: "Any one-variable equation, especially messy ones.",
    steps: ["Type the whole equation exactly as written.", "Desmos draws a vertical line at each solution; tap it to read x."],
    example: "Type 3(x − 4) = 2x + 7 and you get a line at x = 19.",
  },
  {
    title: "Systems of equations → find the intersection",
    when: "“What is the solution (x, y) to the system…”",
    steps: [
      "Type each equation on its own line, as given. No need to solve for y first.",
      "Tap where the graphs cross to see the point.",
      "Parallel lines mean no solution; one line on top of the other means infinitely many.",
    ],
    example: "Line 1: 2x + 3y = 12 · Line 2: x − y = 1 → tap the crossing: (3, 2).",
  },
  {
    title: "Vertex, zeros, and y-intercept of a parabola",
    when: "Quadratic questions about the minimum or maximum, roots, or intercepts.",
    steps: ["Type y = and the expression.", "Tap the curve: gray dots appear at the vertex and intercepts. Tap a dot for its coordinates."],
    example: "y = x² − 6x + 5 → vertex (3, −4), zeros at 1 and 5.",
  },
  {
    title: "Regression: line or curve of best fit",
    when: "Data tables, and “which equation best models…”",
    steps: [
      "Tap + → table, then enter the data in the x₁ and y₁ columns.",
      "On a new line type y₁ ~ mx₁ + b (use the ~ key, not =).",
      "Desmos shows m, b, and r². Closer to 1 means a better fit.",
      "For curves: y₁ ~ ax₁² + bx₁ + c (quadratic) or y₁ ~ a·b^x₁ (exponential).",
    ],
  },
  {
    title: "Mean, median, and standard deviation",
    when: "Data lists in one-variable stats questions.",
    steps: ["Type mean([4, 8, 15, 16, 23]), median([…]) or stdev([…]).", "Compare two lists side by side to see which spread is bigger."],
  },
  {
    title: "Sliders for “for what value of k…”",
    when: "Unknown constants: one solution, no solution, tangent lines.",
    steps: [
      "Type the equations with the letter left in, e.g. y = x² + k and y = 2x.",
      "Tap “add slider” for k and drag it until the graphs touch once (or never, or always), whatever the question asks.",
      "Then check that value against the answer choices.",
    ],
  },
  {
    title: "Test the answer choices",
    when: "You're stuck, or the choices are equations or points.",
    steps: [
      "Graph the original, then graph each answer choice. The match lands right on top of it.",
      "For points: type (3, 5) to see whether it sits on the line or inside a shaded region.",
    ],
  },
  {
    title: "Inequalities and shaded regions",
    when: "“Which point is a solution to the system of inequalities?”",
    steps: ["Type y > 2x + 1 and y ≤ −x + 7. The overlap is the solution region.", "Type the answer-choice points to see which lands in the overlap."],
  },
];

const HABITS = [
  "Use parentheses generously: 1/(x+2), not 1/x+2.",
  "Lost the graph? Tap the house icon (zoom to fit).",
  "Restrict a graph with braces: y = x² {x > 0}.",
  "Desmos checks work fast, but read what the question actually asks: x, y, or something like x + y?",
];

export default function DesmosPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Desmos tips</h1>
        <p className="mt-1 text-sm text-muted">
          Desmos is built into Bluebook for the whole Math section. These moves turn algebra-heavy questions into
          30-second graph reads. Practice them during drills so they&apos;re automatic on test day.
        </p>
      </div>
      {TIPS.map((tip) => (
        <details key={tip.title} className="card p-4" open={tip === TIPS[0]}>
          <summary className="cursor-pointer font-semibold">{tip.title}</summary>
          <p className="mt-2 text-sm text-muted">When: {tip.when}</p>
          <ol className="mt-2 list-inside list-decimal space-y-1 text-[15px]">
            {tip.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          {tip.example && <p className="mt-3 flex gap-2 rounded-xl bg-accent-soft p-3 text-sm"><Ico icon={Lightbulb} className="mt-0.5 text-accent" /> {tip.example}</p>}
        </details>
      ))}
      <section className="card p-4">
        <h2 className="font-semibold">Good habits</h2>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted">
          {HABITS.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
