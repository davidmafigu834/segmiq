/**
 * Billing reminder cadence — centralised so cron logic has no magic numbers.
 * `finalWarningDaysBeforeSuspension` is measured in whole days before suspension
 * (suspension occurs at due_at + subscription.grace_days).
 */
export const BILLING_REMINDER_CONFIG = {
  /** Send the final warning this many days before suspension. */
  finalWarningDaysBeforeSuspension: 1,
} as const;
