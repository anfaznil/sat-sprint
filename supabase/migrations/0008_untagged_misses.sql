-- Wrong drill answers are saved to the error log automatically, before she says why
-- she missed them. reason stays null ("not tagged yet") until she tags it.
alter table public.error_log alter column reason drop not null;
