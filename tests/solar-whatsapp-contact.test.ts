import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { shouldAutoContactAfterOutbound } from "../lib/leads/mark-lead-contacted";
import { solarPrimaryAction } from "../lib/sales/solar-workflow/transitions";
import {
  solarConversationListLabel,
  solarWhatsAppNextStep,
} from "../lib/sales/solar-workflow/opportunity";
import type { SolarSalesFacts } from "../lib/sales/solar-workflow/types";

function facts(patch: Partial<SolarSalesFacts> = {}): SolarSalesFacts {
  return {
    preset: "SOLAR_INSTALLATION",
    leadStatus: "NEW",
    dealStage: null,
    salesCommercialIntent: null,
    visits: [],
    quotes: [],
    ...patch,
  };
}

test("successful human outbound from NEW promotes to CONTACTED only", () => {
  assert.equal(
    shouldAutoContactAfterOutbound({ sendSucceeded: true, humanActor: true, leadStatus: "NEW" }),
    true
  );
  assert.equal(
    shouldAutoContactAfterOutbound({ sendSucceeded: false, humanActor: true, leadStatus: "NEW" }),
    false
  );
  assert.equal(
    shouldAutoContactAfterOutbound({ sendSucceeded: true, humanActor: false, leadStatus: "NEW" }),
    false
  );
  for (const status of ["CONTACTED", "QUALIFIED", "CONVERTED_TO_DEAL", "NEGOTIATING", "PROPOSAL_SENT", "WON", "LOST"]) {
    assert.equal(
      shouldAutoContactAfterOutbound({ sendSucceeded: true, humanActor: true, leadStatus: status }),
      false,
      status
    );
  }
});

test("contact promotion is tenant scoped and idempotent in the update", () => {
  const source = readFileSync("lib/leads/mark-lead-contacted.ts", "utf8");
  assert.match(source, /\.eq\("client_id", opts\.clientId\)/);
  assert.match(source, /\.eq\("status", "NEW"\)/);
  assert.match(source, /logStatusChanged/);
  assert.match(source, /toStatus: "CONTACTED"/);
});

test("canonical send marks contacted only after provider success for a human", () => {
  const service = readFileSync("lib/whatsapp/message-service.ts", "utf8");
  const success = service.indexOf("if (result.ok)");
  const promote = service.indexOf("await afterHumanOutbound(input)");
  assert.ok(success >= 0 && promote > success);
  assert.match(service, /if \(!isHumanWhatsAppActor\(input\)\) return/);
  const template = readFileSync("lib/whatsapp/send-text.ts", "utf8");
  const templateOk = template.indexOf("if (result.ok)");
  const templatePromote = template.indexOf("await markLeadContactedIfNew");
  assert.ok(templatePromote > templateOk);
});

test("WhatsApp new lead does not offer Contact lead, and the board label stays", () => {
  const step = solarWhatsAppNextStep("contact", "Contact lead");
  assert.equal(step.button, null);
  assert.equal(step.title, "Reply to this customer");
  assert.match(step.hint ?? "", /Contacted/);
  const qualify = solarWhatsAppNextStep("qualify", "Qualify");
  assert.equal(qualify.title, "Qualify this lead");
  assert.equal(qualify.button, "Qualify Lead");
  assert.equal(solarPrimaryAction(facts()), "Contact lead");
  assert.equal(solarPrimaryAction(facts({ leadStatus: "CONTACTED" })), "Qualify");
  const panel = readFileSync("components/inbox/SolarOpportunityPanel.tsx", "utf8");
  assert.match(panel, /solarWhatsAppNextStep/);
  assert.doesNotMatch(panel, /Contact lead/);
  assert.match(readFileSync("components/sales/solar/SolarStageCue.tsx", "utf8"), /refreshKey/);
  assert.equal(solarConversationListLabel("NEW"), "New Lead");
  assert.equal(solarConversationListLabel("CONTACTED"), "Contacted");
});
