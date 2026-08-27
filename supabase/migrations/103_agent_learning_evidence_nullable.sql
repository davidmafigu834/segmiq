-- Evidence may attach to approved knowledge during reinforcement without a candidate.

ALTER TABLE public.agent_learning_evidence
  ALTER COLUMN candidate_id DROP NOT NULL;
