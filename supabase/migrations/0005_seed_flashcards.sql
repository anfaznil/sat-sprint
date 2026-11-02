-- Grammar rule flashcards (original content). Front = rule or question, back = answer + example.
-- New cards have no flashcard_state row; the app introduces a few per day.

insert into public.flashcards (topic, front, back, sort) values
  -- Commas
  ('commas', 'Two complete sentences joined by just a comma. Allowed?',
   'No. That''s a comma splice. Fix it with a period, a semicolon, or a comma + FANBOYS (for, and, nor, but, or, yet, so).
✗ The lab closed, the samples stayed frozen.
✓ The lab closed, but the samples stayed frozen.', 1),
  ('commas', 'Extra (non-essential) information in the middle of a sentence: how is it punctuated?',
   'With a matching pair: two commas, two dashes, or two parentheses. Never mix them.
✓ The river, which floods every spring, shaped the valley.
✗ The river, which floods every spring — shaped the valley.', 2),
  ('commas', 'Comma between a subject and its verb?',
   'Never.
✗ The scientists who studied the reef, published their findings.
✓ The scientists who studied the reef published their findings.', 3),
  ('commas', 'Introductory phrase or clause at the start of a sentence: comma or no comma?',
   'Comma after it.
✓ After the storm passed, the crew inspected the bridge.', 4),
  ('commas', 'Essential vs. non-essential: "My brother who lives in Ohio" vs. "My brother, who lives in Ohio,"',
   'No commas = the info is needed to tell which brother (she has more than one).
Commas = extra info about her only brother.
On the SAT: if removing the phrase changes who or what you mean, don''t use commas.', 5),
  ('commas', 'Comma between two adjectives: "a long, difficult hike" vs. "a bright red barn"?',
   'Use a comma if you could put "and" between them and swap their order (long and difficult ✓).
No comma if you can''t (bright and red barn ✗).', 6),

  -- Semicolons
  ('semicolons', 'What must be on BOTH sides of a semicolon?',
   'A complete sentence (independent clause) on each side.
✓ The test is Saturday; she''s ready.
✗ The test is Saturday; and ready.', 1),
  ('semicolons', 'Semicolon + transition word: where does the comma go?',
   'Semicolon before the transition, comma after it.
✓ The data was incomplete; however, the trend was clear.', 2),
  ('semicolons', 'When can a semicolon separate items in a list?',
   'Only when the items already contain commas.
✓ She visited Austin, Texas; Denver, Colorado; and Boise, Idaho.', 3),
  ('semicolons', 'SAT trick: if a semicolon and a period are both answer choices, what does that tell you?',
   'Between two complete sentences they work the same way. If both look right, they''re both wrong for that spot, so look for a different structure (such as a comma + FANBOYS, or no punctuation at all).', 4),

  -- Colons
  ('colons', 'What has to come BEFORE a colon?',
   'A complete sentence. What comes after can be a list, a word, a phrase, or a sentence that explains or illustrates it.
✓ She packed one thing: a calculator.
✗ She packed: a calculator.', 1),
  ('colons', 'Colon after "such as," "including," or a verb like "are"?',
   'No colon.
✗ The kit includes: tape, wire, and a battery.
✓ The kit includes tape, wire, and a battery.', 2),
  ('colons', 'Colon vs. dash for adding an explanation at the end of a sentence?',
   'Either works after a complete sentence: "He had one goal: to finish." = "He had one goal — to finish."
A single dash can do this job; a dash in the middle of a sentence needs a partner dash.', 3),

  -- Transitions
  ('transitions', 'Contrast transitions (the next idea goes against the last one)',
   'however, but, yet, nevertheless, nonetheless, in contrast, on the other hand, still, even so, by contrast', 1),
  ('transitions', 'Same-direction transitions (adding more support)',
   'moreover, furthermore, in addition, additionally, also, likewise, similarly, besides', 2),
  ('transitions', 'Cause → effect transitions',
   'therefore, thus, consequently, as a result, hence, accordingly, for this reason', 3),
  ('transitions', 'Example and clarification transitions',
   'for example, for instance, specifically, in particular (example)
in other words, that is, put differently (restating)', 4),
  ('transitions', 'How to attack any SAT transition question',
   '1. Cover the choices.
2. Read the sentence before and the sentence after the blank.
3. Decide the relationship: contrast, same direction, cause/effect, example, or sequence.
4. Pick the choice that matches. Choices with the same meaning cancel each other out.', 5),
  ('transitions', 'Sequence and time transitions',
   'first, next, then, later, finally, meanwhile, previously, subsequently, at the same time', 6),

  -- Subject-verb agreement
  ('subject_verb', 'How do you find the real subject when a phrase sits between the subject and the verb?',
   'Cross out the prepositional phrase ("of the…", "in the…", "with the…").
"The list of names (is / are) long" → The list … is long.', 1),
  ('subject_verb', 'Each, every, everyone, either, neither, anyone: singular or plural?',
   'Singular.
✓ Each of the essays is graded twice.
✓ Neither of the samples was contaminated.', 2),
  ('subject_verb', 'Collective nouns (team, committee, jury, audience, flock): singular or plural on the SAT?',
   'Treat them as singular.
✓ The committee has approved the plan.', 3),
  ('subject_verb', '"Either A or B" / "Neither A nor B": which one does the verb agree with?',
   'The one closer to the verb.
✓ Neither the coach nor the players were late.
✓ Neither the players nor the coach was late.', 4),
  ('subject_verb', 'Subject AFTER the verb ("Among the fossils ___ a rare tooth")',
   'Flip the sentence: "a rare tooth ___ among the fossils" → was. Inverted sentences hide the subject.', 5),
  ('subject_verb', 'Two subjects joined by "and" vs. by "along with" / "as well as"',
   '"A and B" = plural: The author and her editor are…
"A, along with B," = singular (only A counts): The author, along with her editor, is…', 6);
