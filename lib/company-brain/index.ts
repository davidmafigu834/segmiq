export { assembleCompanyBrainContext, loadCachedCompanyBrainSnapshot } from "./context-service";
export { computeBrainReadiness, quotationAutomationBlockers } from "./readiness";
export { serializeCompanyBrainContext } from "./serialize";
export { loadCompanyBrainSnapshot, upsertBrainSettings, brainCollections } from "./store";
export { solarWholesalerFixture } from "./test-fixture";
export { BRAIN_AREAS } from "./constants";
export type { BrainAreaId } from "./constants";
