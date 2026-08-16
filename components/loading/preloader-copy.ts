export const PRELOADER_COPY = {
  workspace: {
    title: "Preparing your workspace...",
    description: "Loading your sales data and priorities.",
  },
  pipeline: {
    title: "Syncing your pipeline...",
    description: "Organizing Deals, follow-ups and priorities.",
  },
  salesHub: {
    title: "Preparing your Sales Hub...",
    description: "Loading conversations and customer context.",
  },
  company: {
    title: "Preparing your company workspace...",
    description: "Loading team activity, Deals and reporting.",
  },
} as const;

export type SegmiQPreloaderVariant = keyof typeof PRELOADER_COPY;
