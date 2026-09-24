# Demo workspaces

A demo workspace uses the same SegmiQ screens as a customer organisation. Reads and writes go through a demo data provider instead of production CRM tables. External sends are simulated and never leave SegmiQ.

## How mode is detected

`clients.workspace_mode` is `production` or `demo`. `clients.demo_industry` and `clients.demo_scenario` choose the dataset. `clients.mode` stays `team` or `solo` and is not reused for this.

```ts
isDemoWorkspace(workspace) // workspace_mode === "demo"
getDataProvider(workspace) // { kind: "production" } or { kind: "demo", industry, scenario }
```

A missing column fails closed to production.

## Where datasets live

```text
lib/demo/industries/<industry>/<scenario>/dataset.ts
```

Rossi Tyres is `tyres` / `rossi`. Dates are computed from the current day in Africa/Harare (`lib/demo/dates.ts`). Record ids are deterministic hashes, so a presentation sees the same customers every time.

## Reads

Server aggregators (dashboards, pipeline, leads, quotations, customers, inbox, products, weekly report, company brain) return early when `loadDemoDatasetForClient(clientId)` finds a dataset. The UI components are unchanged.

## Writes

Mutations are appended to `demo_workspace_mutations` (and an in-memory copy if the table is unavailable). They are applied on top of the canonical dataset. They never update `leads`, `deals`, `quotations`, or `whatsapp_messages`.

Supported local actions include stage changes, won/lost, follow-ups, assignment, and a message that appears in the conversation.

## Reset

A manager in a demo workspace can open Settings → Data and choose Reset Demo. That deletes the mutation list. Dates are rebuilt from today on the next load.

## External calls

WhatsApp, email, SMS, and social sends check `simulatedExternalSend(clientId)` first. Demo mode returns a simulated success and does not call Meta, Twilio, Resend, or Graph, and does not write `message_logs`.

## Adding an industry

1. Add `lib/demo/industries/<industry>/<scenario>/dataset.ts` exporting a builder that returns `DemoDataset`.
2. Register it in `materializeDemoDataset`.
3. Seed a client with `workspace_mode = 'demo'`, `demo_industry`, and `demo_scenario`. Do not insert CRM rows.

### Machinery example

```ts
demoWorkspaceConfig = { industry: "machinery", scenario: "harare-plant" }
```

```text
lib/demo/industries/machinery/harare-plant/dataset.ts
```

The same dashboards, pipeline, quotations, and inbox render that dataset. No Rossi-specific branches belong in those screens.
