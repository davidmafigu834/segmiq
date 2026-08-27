import { loadCompanyBrainSnapshot } from "@/lib/company-brain/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { asRows } from "@/lib/agent/rows";
import { observationsEquivalent, tokenOverlap, looksLikeOneOffException } from "./policy";
import type { KnowledgeCompareResult, LearningObservation } from "./types";
import type { LearningAssembledContext } from "./context";

/**
 * Company Brain / commercial records win. Observation never overrides policy.
 */
export async function compareObservation(opts: {
  clientId: string;
  observation: LearningObservation;
  context: LearningAssembledContext;
}): Promise<KnowledgeCompareResult> {
  const obs = opts.observation;
  const blob = `${obs.title} ${obs.summary} ${obs.proposedLearning}`;

  const commercial = detectCommercialConflict(obs, opts.context);
  if (commercial) return commercial;

  const snapshot = await loadCompanyBrainSnapshot(opts.clientId).catch(() => null);
  if (snapshot) {
    for (const faq of snapshot.faqs) {
      if (tokenOverlap(obs.title, faq.question) >= 0.45 || tokenOverlap(blob, `${faq.question} ${faq.approvedAnswer}`) >= 0.4) {
        const answerAgrees = tokenOverlap(obs.proposedLearning, faq.approvedAnswer) >= 0.35;
        return {
          state: answerAgrees ? "SUPPORTS_EXISTING" : "CONFLICTS",
          existingType: "FAQ",
          existingId: faq.id,
          summary: answerAgrees
            ? `This behaviour reinforces FAQ: ${faq.question}`
            : `Observed answer conflicts with approved FAQ: ${faq.question}`,
        };
      }
    }
    for (const playbook of snapshot.playbooks) {
      const fieldText = playbook.fields.map((f) => f.label).join(" ");
      if (obs.category === "QUALIFICATION" && tokenOverlap(blob, `${playbook.name} ${fieldText}`) >= 0.28) {
        return {
          state: "SUPPORTS_EXISTING",
          existingType: "QUALIFICATION_PLAYBOOK",
          existingId: playbook.id,
          summary: `This behaviour reinforces playbook ${playbook.name}.`,
        };
      }
    }
    for (const rule of snapshot.rules) {
      if (!rule.enabled) continue;
      if (tokenOverlap(blob, rule.text) >= 0.4) {
        const agrees = tokenOverlap(obs.proposedLearning, rule.text) >= 0.3;
        return {
          state: agrees ? "SUPPORTS_EXISTING" : "CONFLICTS",
          existingType: "AGENT_RULE",
          existingId: rule.id,
          summary: agrees
            ? `Reinforces agent rule: ${rule.text.slice(0, 80)}`
            : `Conflicts with agent rule: ${rule.text.slice(0, 80)}`,
        };
      }
    }
    if (obs.category === "TONE") {
      return {
        state: "SUPPORTS_EXISTING",
        existingType: "BRAND_VOICE",
        existingId: snapshot.settings.clientId,
        summary: "Tone observations are compared against Brand Voice at approval time.",
      };
    }
  }

  const supabase = createAdminClient();
  const { data: knowledge } = await supabase
    .from("agent_learning_knowledge")
    .select("id, title, content, category, status")
    .eq("client_id", opts.clientId)
    .in("status", ["ACTIVE", "NEEDS_REVIEW"]);
  for (const row of asRows<{ id: string; title: string; content: string; category: string; status: string }>(knowledge)) {
    if (
      observationsEquivalent(
        { type: obs.type, category: obs.category, title: obs.title, proposedLearning: obs.proposedLearning },
        { type: "BEHAVIOR_PATTERN", category: row.category, title: row.title, proposedLearning: row.content }
      )
    ) {
      return {
        state: row.status === "NEEDS_REVIEW" ? "CONFLICTS" : "SUPPORTS_EXISTING",
        existingType: "LEARNED_KNOWLEDGE",
        existingId: row.id,
        summary: `Matches approved learning: ${row.title}`,
      };
    }
  }

  const { data: open } = await supabase
    .from("agent_learning_candidates")
    .select("id, title, proposed_learning, category, type, status")
    .eq("client_id", opts.clientId)
    .in("status", ["DETECTED", "REVIEWING"]);
  for (const row of asRows<{
    id: string;
    title: string;
    proposed_learning: string;
    category: string;
    type: string;
    status: string;
  }>(open)) {
    if (
      observationsEquivalent(
        { type: obs.type, category: obs.category, title: obs.title, proposedLearning: obs.proposedLearning },
        {
          type: row.type,
          category: row.category,
          title: row.title,
          proposedLearning: row.proposed_learning,
        }
      )
    ) {
      return {
        state: "DUPLICATES",
        existingType: "LEARNING_CANDIDATE",
        existingId: row.id,
        summary: `Semantically equivalent to an open candidate: ${row.title}`,
      };
    }
  }

  if (looksLikeOneOffException(blob)) {
    return {
      state: "NEW",
      summary: "Possible one-off exception — do not generalize commercial terms.",
    };
  }

  return { state: "NEW", summary: "No equivalent Company Brain or learned rule found." };
}

function detectCommercialConflict(
  obs: LearningObservation,
  ctx: LearningAssembledContext
): KnowledgeCompareResult | null {
  const text = `${obs.title} ${obs.summary} ${obs.proposedLearning}`.toLowerCase();
  const offersCredit = /pay over|payment plan|90 day|3 months|credit|instalment|installment/.test(text);
  if (offersCredit && !ctx.commercial.creditOffered && !ctx.commercial.paymentPlansOffered) {
    return {
      state: "CONFLICTS",
      existingType: "PRICING_POLICY",
      existingId: ctx.clientId,
      summary: "Observed salesperson behaviour conflicts with the company's approved credit policy.",
    };
  }
  const offersDiscount = /discount|% off|percent off/.test(text) && !looksLikeOneOffException(text);
  if (offersDiscount && ctx.commercial.allowQuotationDiscount === false) {
    return {
      state: "CONFLICTS",
      existingType: "PRICING_POLICY",
      existingId: ctx.clientId,
      summary: "Observed discounting conflicts with quotation discount policy.",
    };
  }
  return null;
}

export async function flagLearnedKnowledgeAgainstBrain(clientId: string): Promise<number> {
  const snapshot = await loadCompanyBrainSnapshot(clientId).catch(() => null);
  if (!snapshot) return 0;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agent_learning_knowledge")
    .select("id, title, content")
    .eq("client_id", clientId)
    .eq("status", "ACTIVE");
  let flagged = 0;
  const creditPolicy = `credit offered ${snapshot.settings.creditOffered ? "yes" : "no"} payment plans ${snapshot.settings.paymentPlansOffered ? "yes" : "no"}`;
  for (const row of asRows<{ id: string; title: string; content: string }>(data)) {
    const text = `${row.title} ${row.content}`.toLowerCase();
    const conflictsCredit =
      !snapshot.settings.creditOffered &&
      /pay over|payment plan|credit|instalment|installment/.test(text);
    if (conflictsCredit) {
      await supabase
        .from("agent_learning_knowledge")
        .update({ status: "NEEDS_REVIEW", updated_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("client_id", clientId);
      await supabase.from("agent_learning_candidates").insert({
        client_id: clientId,
        type: "CONFLICT",
        category: "COMMERCIAL_PATTERN",
        title: `Company Brain override: ${row.title}`,
        summary: `Updated Company Brain may conflict with learned knowledge "${row.title}". ${creditPolicy}.`,
        proposed_learning: row.content,
        original_proposed_learning: row.content,
        confidence_level: "HIGH",
        risk_level: "VERY_HIGH",
        comparison_state: "CONFLICTS",
        existing_knowledge_type: "LEARNED_KNOWLEDGE",
        existing_knowledge_id: row.id,
        existing_knowledge_summary: "Company Brain now takes priority.",
        status: "DETECTED",
        semantic_key: `CONFLICT|COMMERCIAL_PATTERN|brain-${row.id}`,
        source: "BRAIN_UPDATED",
      });
      flagged += 1;
    }
  }
  return flagged;
}
