import { scanAllActiveJourneys } from "./triggers";
import { processDueEnrollments } from "./processor";
import { seedAllClientJourneys } from "./seed";

export { scanAllActiveJourneys, scanJourneyEnrollments } from "./triggers";
export { processDueEnrollments, processEnrollment } from "./processor";
export { seedJourneysForClient, seedAllClientJourneys } from "./seed";
export { PREDEFINED_JOURNEYS, getPredefinedJourney } from "./templates";
export type * from "./types";

export async function runJourneyEngine(): Promise<{
  enrolled: number;
  processed: number;
}> {
  await seedAllClientJourneys();
  const enrolled = await scanAllActiveJourneys();
  const processed = await processDueEnrollments();
  return { enrolled, processed };
}
