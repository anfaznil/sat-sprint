-- Official digital SAT content domains and skills (College Board test specifications).
-- Weights are each domain's approximate share of its section.

insert into public.domains (id, section, name, weight, sort) values
  ('info_ideas',    'rw',   'Information and Ideas',             0.26, 1),
  ('craft',         'rw',   'Craft and Structure',               0.28, 2),
  ('expression',    'rw',   'Expression of Ideas',               0.20, 3),
  ('conventions',   'rw',   'Standard English Conventions',      0.26, 4),
  ('algebra',       'math', 'Algebra',                           0.35, 5),
  ('advanced_math', 'math', 'Advanced Math',                     0.35, 6),
  ('psda',          'math', 'Problem-Solving and Data Analysis', 0.15, 7),
  ('geo_trig',      'math', 'Geometry and Trigonometry',         0.15, 8);

insert into public.skills (id, domain_id, name, sort) values
  -- Reading & Writing
  ('central_ideas',          'info_ideas',    'Central Ideas and Details', 1),
  ('inferences',             'info_ideas',    'Inferences', 2),
  ('evidence_textual',       'info_ideas',    'Command of Evidence: Textual', 3),
  ('evidence_quantitative',  'info_ideas',    'Command of Evidence: Quantitative', 4),
  ('words_in_context',       'craft',         'Words in Context', 1),
  ('text_structure',         'craft',         'Text Structure and Purpose', 2),
  ('cross_text',             'craft',         'Cross-Text Connections', 3),
  ('rhetorical_synthesis',   'expression',    'Rhetorical Synthesis', 1),
  ('transitions',            'expression',    'Transitions', 2),
  ('boundaries',             'conventions',   'Boundaries', 1),
  ('form_structure_sense',   'conventions',   'Form, Structure, and Sense', 2),
  -- Math
  ('linear_eq_one_var',      'algebra',       'Linear equations in one variable', 1),
  ('linear_functions',       'algebra',       'Linear functions', 2),
  ('linear_eq_two_var',      'algebra',       'Linear equations in two variables', 3),
  ('systems_linear',         'algebra',       'Systems of two linear equations in two variables', 4),
  ('linear_inequalities',    'algebra',       'Linear inequalities in one or two variables', 5),
  ('equivalent_expressions', 'advanced_math', 'Equivalent expressions', 1),
  ('nonlinear_eq_systems',   'advanced_math', 'Nonlinear equations in one variable and systems of equations in two variables', 2),
  ('nonlinear_functions',    'advanced_math', 'Nonlinear functions', 3),
  ('ratios_rates_units',     'psda',          'Ratios, rates, proportional relationships, and units', 1),
  ('percentages',            'psda',          'Percentages', 2),
  ('one_var_data',           'psda',          'One-variable data: distributions and measures of center and spread', 3),
  ('two_var_data',           'psda',          'Two-variable data: models and scatterplots', 4),
  ('probability',            'psda',          'Probability and conditional probability', 5),
  ('inference_sample_stats', 'psda',          'Inference from sample statistics and margin of error', 6),
  ('statistical_claims',     'psda',          'Evaluating statistical claims: observational studies and experiments', 7),
  ('area_volume',            'geo_trig',      'Area and volume', 1),
  ('lines_angles_triangles', 'geo_trig',      'Lines, angles, and triangles', 2),
  ('right_triangles_trig',   'geo_trig',      'Right triangles and trigonometry', 3),
  ('circles',                'geo_trig',      'Circles', 4);
