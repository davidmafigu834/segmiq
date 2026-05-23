-- 028_lead_events.sql
-- Lead timeline event log
-- Records every significant action on a lead in chronological order

create table if not exists lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,

  -- Who did this
  actor_id uuid references users(id) on delete set null,
  actor_name text, -- denormalised so history survives if user is deleted
  actor_role text, -- AGENCY_ADMIN, CLIENT_MANAGER, SALESPERSON, SYSTEM

  -- What happened
  event_type text not null,
  -- Values:
  -- LEAD_CREATED
  -- LEAD_ASSIGNED
  -- LEAD_REASSIGNED
  -- STATUS_CHANGED
  -- CALL_LOGGED
  -- NOTE_ADDED
  -- DOCUMENT_SENT
  -- FOLLOW_UP_SET
  -- FORM_VIEWED (future)
  -- MESSAGE_RECEIVED (future)

  -- Event payload — flexible json for event-specific data
  event_data jsonb default '{}',
  -- Examples:
  -- LEAD_CREATED: { source, assigned_to_name, form_data_summary }
  -- LEAD_ASSIGNED: { assigned_to_name, assigned_to_id }
  -- LEAD_REASSIGNED: { from_name, from_id, to_name, to_id, handover_notes }
  -- STATUS_CHANGED: { from_status, to_status }
  -- CALL_LOGGED: { outcome, notes, follow_up_date }
  -- DOCUMENT_SENT: { document_type, document_name, url }
  -- FOLLOW_UP_SET: { follow_up_date, notes }

  created_at timestamptz default now()
);

-- Indexes
create index if not exists lead_events_lead_id_idx
  on lead_events(lead_id, created_at desc);

create index if not exists lead_events_client_id_idx
  on lead_events(client_id);

create index if not exists lead_events_actor_id_idx
  on lead_events(actor_id);

-- RLS
alter table lead_events enable row level security;

-- Service role bypasses — application enforces access
