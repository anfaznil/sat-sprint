-- Grammar cards become SAT-style questions: a sentence with a blank and 4 choices,
-- graded automatically. Each rule (flashcard) has 3 original questions; each review of a
-- rule shows the next one, so she can't just memorize a single sentence.

create table public.flashcard_questions (
  id        uuid primary key default gen_random_uuid(),
  card_id   uuid not null references public.flashcards(id) on delete cascade,
  variant   int  not null,
  stem      text not null check (stem like '%____%'),
  choices   jsonb not null check (jsonb_array_length(choices) = 4),
  answer    text not null check (answer in ('A', 'B', 'C', 'D')),
  unique (card_id, variant)
);

alter table public.flashcard_questions enable row level security;
create policy "members only" on public.flashcard_questions for all to authenticated
  using (public.is_member()) with check (public.is_member());

-- How many times a rule has been quizzed; picks which of its questions comes next.
alter table public.flashcard_state add column reviews int not null default 0;

insert into public.flashcard_questions (card_id, variant, stem, choices, answer)
select c.id, q.variant, q.stem, q.choices, q.answer
from (values
  ('commas', 1, 0, 'The lab closed early on ____ the samples stayed frozen over the weekend.', '["Friday; but", "Friday but,", "Friday,", "Friday, but"]'::jsonb, 'D'),
  ('commas', 1, 1, 'Maya finished her ____ she still had two hours left before the deadline.', '["essay and,", "essay,", "essay, and", "essay; and"]'::jsonb, 'C'),
  ('commas', 1, 2, 'Rain fell all ____ the parade went on as planned.', '["afternoon, yet", "afternoon, yet,", "afternoon,", "afternoon yet,"]'::jsonb, 'A'),
  ('commas', 2, 0, 'The river, which floods almost every ____ shaped the entire valley.', '["spring;", "spring,", "spring—", "spring"]'::jsonb, 'B'),
  ('commas', 2, 1, 'Dr. Ruiz—a marine biologist who studies ____ will speak at the assembly.', '["coral", "coral—", "coral;", "coral,"]'::jsonb, 'B'),
  ('commas', 2, 2, 'The novel (first published in ____ remains popular with students.', '["1952,", "1952", "1952),", "1952)"]'::jsonb, 'D'),
  ('commas', 3, 0, 'The students who stayed after school to rebuild the ____ finally fixed its broken arm.', '["robot", "robot,", "robot;", "robot:"]'::jsonb, 'A'),
  ('commas', 3, 1, 'Every painting in the gallery''s east ____ was restored last year.', '["wing—", "wing;", "wing,", "wing"]'::jsonb, 'D'),
  ('commas', 3, 2, 'What surprised the researchers ____ was how quickly the plants recovered.', '["most;", "most", "most:", "most,"]'::jsonb, 'B'),
  ('commas', 4, 0, 'After the storm finally ____ the crew inspected the bridge for damage.', '["passed;", "passed", "passed,", "passed:"]'::jsonb, 'C'),
  ('commas', 4, 1, 'Although the trail was ____ the hikers reached the summit by noon.', '["steep,", "steep;", "steep, and", "steep"]'::jsonb, 'A'),
  ('commas', 4, 2, 'To prepare for the ____ the team practiced every morning.', '["competition;", "competition,", "competition:", "competition"]'::jsonb, 'B'),
  ('commas', 5, 0, 'The scientist ____ the new species gave a talk at the university.', '["who discovered", ", who discovered", "who discovered,", "—who discovered"]'::jsonb, 'A'),
  ('commas', 5, 1, 'Mount ____ the tallest mountain on Earth, attracts climbers from around the world.', '["Everest—", "Everest;", "Everest,", "Everest"]'::jsonb, 'C'),
  ('commas', 5, 2, 'Students ____ their projects early will receive extra feedback.', '["who turn in,", ", who turn in", "who, turn in", "who turn in"]'::jsonb, 'D'),
  ('commas', 6, 0, 'The hikers followed a ____ path up the ridge.', '["long, winding", "long, winding,", "long winding", "long; winding"]'::jsonb, 'A'),
  ('commas', 6, 1, 'The museum displayed an ____ sports car from the 1960s.', '["expensive Italian", "expensive, Italian,", "expensive; Italian", "expensive, Italian"]'::jsonb, 'A'),
  ('commas', 6, 2, 'The guide told a ____ story about the old lighthouse.', '["strange, eerie,", "strange eerie", "strange, eerie", "strange; eerie"]'::jsonb, 'C'),
  ('semicolons', 1, 0, 'The test is on ____ she has been preparing for weeks.', '["Saturday; and", "Saturday and,", "Saturday;", "Saturday,"]'::jsonb, 'C'),
  ('semicolons', 1, 1, 'The museum offers free ____ visitors must reserve a spot online.', '["tours; and", "tours,", "tours;", "tours and"]'::jsonb, 'C'),
  ('semicolons', 1, 2, 'Several volunteers arrived ____ ready to set up the tables.', '["early:", "early,", "early;", "early. Ready"]'::jsonb, 'B'),
  ('semicolons', 2, 0, 'The data was ____ the overall trend was clear.', '["incomplete; however,", "incomplete; however", "incomplete however,", "incomplete, however,"]'::jsonb, 'A'),
  ('semicolons', 2, 1, 'The bridge was closed for ____ drivers had to take the long way around.', '["repairs therefore,", "repairs, therefore,", "repairs; therefore,", "repairs; therefore"]'::jsonb, 'C'),
  ('semicolons', 2, 2, 'Few people expected the team to ____ it took the championship.', '["win, nevertheless,", "win nevertheless;", "win; nevertheless", "win; nevertheless,"]'::jsonb, 'D'),
  ('semicolons', 3, 0, 'The tour stops in Austin, ____ Denver, Colorado; and Boise, Idaho.', '["Texas;", "Texas", "Texas,", "Texas:"]'::jsonb, 'A'),
  ('semicolons', 3, 1, 'The panel included Ana Ruiz, a ____ Ben Ito, a teacher; and Cal Moss, a nurse.', '["chemist:", "chemist", "chemist;", "chemist,"]'::jsonb, 'C'),
  ('semicolons', 3, 2, 'Bring three items: a ____ an eraser, and a calculator.', '["pencil:", "pencil—", "pencil;", "pencil,"]'::jsonb, 'D'),
  ('semicolons', 4, 0, 'The festival drew huge ____ so many that the organizers ran out of programs.', '["crowds,", "crowds.", "crowds and", "crowds;"]'::jsonb, 'A'),
  ('semicolons', 4, 1, 'The storm knocked out the ____ leaving the town dark for two days.', '["power,", "power.", "power, and", "power;"]'::jsonb, 'A'),
  ('semicolons', 4, 2, 'Lena studied every night that ____ hoping to raise her score.', '["week.", "week, and", "week,", "week;"]'::jsonb, 'C'),
  ('colons', 1, 0, 'She packed only one thing for the ____ a calculator.', '["trip;", "trip. A", "trip:", "trip, and"]'::jsonb, 'C'),
  ('colons', 1, 1, 'The recipe ____ flour, sugar, and eggs.', '["requires", "requires,", "requires:", "requires;"]'::jsonb, 'A'),
  ('colons', 1, 2, 'Before every game, the coach gave the same one-word piece of ____ patience.', '["advice:", "advice that", "advice", "advice;"]'::jsonb, 'A'),
  ('colons', 2, 0, 'The kit ____ tape, wire, and a small battery.', '["includes;", "includes", "includes:", "includes—"]'::jsonb, 'B'),
  ('colons', 2, 1, 'The club offers activities such ____ chess, debate, and robotics.', '["as,", "as", "as;", "as:"]'::jsonb, 'B'),
  ('colons', 2, 2, 'Her favorite subjects ____ biology and history.', '["are:", "are;", "are", "are,"]'::jsonb, 'C'),
  ('colons', 3, 0, 'He had one goal for the ____ to finish every race.', '["season and", "season—", "season. To", "season;"]'::jsonb, 'B'),
  ('colons', 3, 1, 'The answer was obvious once she saw ____ the bridge had been built backward.', '["it", "it,", "it:", "it; and"]'::jsonb, 'C'),
  ('colons', 3, 2, 'Only one thing could save the ____ more time.', '["experiment, and", "experiment—", "experiment", "experiment;"]'::jsonb, 'B'),
  ('transitions', 1, 0, 'Most desert plants store water in thick stems. ____ the creosote bush survives droughts with roots that spread far beneath the surface.', '["Similarly,", "By contrast,", "Therefore,", "For example,"]'::jsonb, 'B'),
  ('transitions', 1, 1, 'The first prototype was slow and noisy. ____ the engineers kept improving it until it ran smoothly.', '["In other words,", "For instance,", "Nevertheless,", "Likewise,"]'::jsonb, 'C'),
  ('transitions', 1, 2, 'Critics praised the film''s visuals. ____ many found its plot confusing.', '["Moreover,", "However,", "Specifically,", "Thus,"]'::jsonb, 'B'),
  ('transitions', 2, 0, 'The new library stays open later than the old one. ____ it offers free tutoring on weekends.', '["Nonetheless,", "Instead,", "However,", "Moreover,"]'::jsonb, 'D'),
  ('transitions', 2, 1, 'Bees pollinate many crops. ____ bats pollinate hundreds of plant species, including bananas.', '["Still,", "Similarly,", "In contrast,", "Otherwise,"]'::jsonb, 'B'),
  ('transitions', 2, 2, 'Regular exercise improves heart health. ____ it can boost mood and focus.', '["Instead,", "Even so,", "Conversely,", "Additionally,"]'::jsonb, 'D'),
  ('transitions', 3, 0, 'The river rose three feet overnight. ____ the town closed the lower bridge.', '["For example,", "However,", "Similarly,", "As a result,"]'::jsonb, 'D'),
  ('transitions', 3, 1, 'The seeds need cold weather to sprout. ____ gardeners often plant them in late fall.', '["Nevertheless,", "Consequently,", "Meanwhile,", "In contrast,"]'::jsonb, 'B'),
  ('transitions', 3, 2, 'The trial included only twenty volunteers. ____ the researchers cautioned against drawing broad conclusions.', '["For this reason,", "Likewise,", "Still,", "In other words,"]'::jsonb, 'A'),
  ('transitions', 4, 0, 'Some animals use tools. ____ sea otters crack open shellfish with rocks.', '["However,", "As a result,", "Instead,", "For example,"]'::jsonb, 'D'),
  ('transitions', 4, 1, 'The mayor''s plan was ambitious. ____ it aimed to plant ten thousand trees in a single year.', '["In contrast,", "Nonetheless,", "Otherwise,", "Specifically,"]'::jsonb, 'D'),
  ('transitions', 4, 2, 'The author writes concisely. ____ she rarely uses more words than she needs.', '["In other words,", "Similarly,", "Meanwhile,", "However,"]'::jsonb, 'A'),
  ('transitions', 5, 0, 'The team lost its first three games. ____ it won the next seven in a row.', '["Similarly,", "Thus,", "Then,", "For instance,"]'::jsonb, 'C'),
  ('transitions', 5, 1, 'Early maps showed California as an island. ____ explorers later proved it was connected to the mainland.', '["However,", "For example,", "Likewise,", "Therefore,"]'::jsonb, 'A'),
  ('transitions', 5, 2, 'Octopuses can change color in under a second. ____ they can alter the texture of their skin to match rocks or coral.', '["In contrast,", "As a result,", "Furthermore,", "Nevertheless,"]'::jsonb, 'C'),
  ('transitions', 6, 0, 'First, the volunteers sorted the donations by size. ____ they packed the boxes for delivery.', '["However,", "For example,", "Similarly,", "Next,"]'::jsonb, 'D'),
  ('transitions', 6, 1, 'The chef chopped the onions and garlic. ____ the broth simmered on the back burner.', '["Therefore,", "In contrast,", "For instance,", "Meanwhile,"]'::jsonb, 'D'),
  ('transitions', 6, 2, 'The town once relied almost entirely on fishing. ____ tourism has become its main industry.', '["For example,", "Similarly,", "Thus,", "Today,"]'::jsonb, 'D'),
  ('subject_verb', 1, 0, 'The list of names on the board ____ updated every Monday.', '["have been", "are", "were", "is"]'::jsonb, 'D'),
  ('subject_verb', 1, 1, 'The quality of the photos ____ impressed the judges.', '["are", "has", "were", "have"]'::jsonb, 'B'),
  ('subject_verb', 1, 2, 'A box of old letters ____ found in the attic last spring.', '["have been", "are", "was", "were"]'::jsonb, 'C'),
  ('subject_verb', 2, 0, 'Each of the essays ____ graded by two teachers.', '["are", "have been", "is", "were"]'::jsonb, 'C'),
  ('subject_verb', 2, 1, 'Neither of the samples ____ contaminated.', '["were", "are", "have been", "was"]'::jsonb, 'D'),
  ('subject_verb', 2, 2, 'Everyone on the two teams ____ a medal at the end of the season.', '["are receiving", "have received", "receive", "receives"]'::jsonb, 'D'),
  ('subject_verb', 3, 0, 'The committee ____ approved the new schedule.', '["has", "were", "have", "are"]'::jsonb, 'A'),
  ('subject_verb', 3, 1, 'The flock of geese ____ south every October.', '["have flown", "are flying", "flies", "fly"]'::jsonb, 'C'),
  ('subject_verb', 3, 2, 'The jury ____ reached its verdict.', '["are", "has", "were", "have"]'::jsonb, 'B'),
  ('subject_verb', 4, 0, 'Neither the coach nor the players ____ late to practice.', '["were", "has been", "was", "is"]'::jsonb, 'A'),
  ('subject_verb', 4, 1, 'Either the students or the teacher ____ going to present first.', '["are", "is", "were", "have been"]'::jsonb, 'B'),
  ('subject_verb', 4, 2, 'Neither the cookies nor the cake ____ ready yet.', '["have been", "were", "are", "is"]'::jsonb, 'D'),
  ('subject_verb', 5, 0, 'Among the fossils in the glass case ____ a rare shark tooth.', '["are", "was", "have been", "were"]'::jsonb, 'B'),
  ('subject_verb', 5, 1, 'On the top shelf ____ three dusty encyclopedias.', '["sit", "is sitting", "has sat", "sits"]'::jsonb, 'A'),
  ('subject_verb', 5, 2, 'There ____ several reasons for the delay.', '["are", "is", "has been", "was"]'::jsonb, 'A'),
  ('subject_verb', 6, 0, 'The author and her editor ____ meeting tomorrow.', '["has been", "are", "is", "was"]'::jsonb, 'B'),
  ('subject_verb', 6, 1, 'The author, along with her editor, ____ meeting tomorrow.', '["are", "were", "have been", "is"]'::jsonb, 'D'),
  ('subject_verb', 6, 2, 'Salt and pepper ____ on every table in the diner.', '["has been", "are", "is", "was"]'::jsonb, 'B')
) as q(topic, sort, variant, stem, choices, answer)
join public.flashcards c on c.topic = q.topic and c.sort = q.sort;
