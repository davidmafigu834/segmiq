import type { VehicleHireActorKey } from "@/lib/demo/actors";
import { BSA_WORKSPACE } from "@/lib/demo/industries/vehicle-hire/bsa/identity";
import { daysAgo, daysFromNow, demoIso, demoToday, hoursAgo, withinCurrentMonth } from "@/lib/demo/dates";
import { demoId } from "@/lib/demo/ids";
import type { DemoActivity, DemoActor, DemoDataset, DemoFollowUp, DemoMessage, DemoNotification, DemoProduct } from "@/lib/demo/types";
import type { ContactRow, DealRow, DealStage, LeadRow, LeadSource, QuotationLineItemRow, QuotationRow, QuotationStatus } from "@/types";

type Owner = Extract<VehicleHireActorKey, "tariro" | "munashe">;

type Line = {
  name: string;
  description: string;
  qty: number;
  unitPrice: number;
  unit: string;
};

type ThreadLine = { direction: "customer" | "rep"; text: string; hours: number; system?: boolean };

type Spec = {
  key: string;
  name: string;
  company?: string;
  location: string;
  owner: Owner;
  source: LeadSource | "WALK_IN" | "PHONE";
  score: number;
  requirement: string;
  bucket: "lead" | "open" | "won" | "lost";
  stage?: DealStage;
  createdDays: number;
  wonDays?: number;
  follow?: "today" | "tomorrow" | "overdue" | "done" | null;
  followLabel?: string;
  quote?: { number: string; status: QuotationStatus; sentDays?: number; lines: Line[]; note: string };
  lostReason?: string;
  priceBasis: "published_example" | "illustrative" | "on_request";
  availability: "not_confirmed" | "past_fictional_booking";
  vehicle: string;
  serviceType: string;
  pickup?: string;
  destination?: string;
  whenLabel?: string;
  duration?: string;
  passengers?: string;
  chauffeur?: string;
  addons?: string;
  deadline?: string;
  thread?: ThreadLine[];
};

const FICTIONAL = "Fictional demonstration. This is not a BSA Mobility booking, invoice, or availability confirmation.";

const PUBLISHED_E400 =
  "Published marketing example: Mercedes-Benz E400 standard hire USD 200 per day. Unlimited-mileage option was advertised at USD 300 per day. Availability is not confirmed.";
const PUBLISHED_PICKUP = "Published marketing example: pickup/drop service USD 50 per trip. Availability is not confirmed.";
const C_CLASS_NOTE =
  "Mercedes-Benz C-Class is publicly advertised from USD 149.99. The pricing unit is unconfirmed, so this demonstration does not multiply that figure. Price on request.";

const SPECS: Spec[] = [
  {
    key: "ruvimbo-ncube",
    name: "Ruvimbo Ncube",
    location: "Borrowdale, Harare",
    owner: "tariro",
    source: "WHATSAPP_INBOUND",
    score: 86,
    requirement: "Mercedes-Benz E400 for two days, with Harare airport pickup",
    bucket: "open",
    stage: "PROPOSAL_SENT",
    createdDays: 3,
    follow: "today",
    followLabel: "Follow up with Ruvimbo about the E400 quotation before Friday's arrival.",
    priceBasis: "published_example",
    availability: "not_confirmed",
    vehicle: "Mercedes-Benz E400",
    serviceType: "Executive hire and airport pickup",
    pickup: "Robert Gabriel Mugabe International Airport",
    destination: "Borrowdale, Harare",
    whenLabel: "Friday, about 10:00",
    duration: "2 days",
    passengers: "1",
    chauffeur: "Requested",
    quote: {
      number: "BSA-1042",
      status: "sent",
      sentDays: 1,
      note: `${FICTIONAL} ${PUBLISHED_E400} ${PUBLISHED_PICKUP}`,
      lines: [
        { name: "Mercedes-Benz E400 standard hire", description: PUBLISHED_E400, qty: 2, unitPrice: 200, unit: "day" },
        { name: "Airport pickup", description: PUBLISHED_PICKUP, qty: 1, unitPrice: 50, unit: "trip" },
      ],
    },
    thread: [
      { direction: "rep", text: "Simulated demonstration conversation. Nothing here was sent to a real phone.", hours: 80, system: true },
      { direction: "customer", text: "Good morning. I would like to hire a Mercedes-Benz E400 for two days. I'm also arriving at Harare airport. Can you help?", hours: 72 },
      { direction: "rep", text: "Good morning. Certainly. May I confirm your travel dates and whether you'll need airport pickup?", hours: 70 },
      { direction: "customer", text: "I arrive on Friday at around 10 AM. Please include pickup in the quotation.", hours: 68 },
      { direction: "rep", text: "Thank you. I have prepared a fictional demonstration quotation using the published E400 daily example and the published pickup example. Vehicle availability is not confirmed.", hours: 30 },
    ],
  },
  {
    key: "mavambo",
    name: "Mavambo Consulting",
    company: "Mavambo Consulting",
    location: "Mount Pleasant, Harare",
    owner: "tariro",
    source: "REFERRAL",
    score: 84,
    requirement: "Three days of executive transportation with several scheduled pickups",
    bucket: "open",
    stage: "NEGOTIATING",
    createdDays: 8,
    follow: "overdue",
    followLabel: "Call Mavambo Consulting before the transport approval deadline.",
    priceBasis: "illustrative",
    availability: "not_confirmed",
    vehicle: "Premium SUV",
    serviceType: "Corporate executive transport",
    pickup: "Mount Pleasant office",
    destination: "Harare city meetings",
    whenLabel: "Next week, three consecutive days",
    duration: "3 days",
    passengers: "2 executives",
    chauffeur: "Requested",
    deadline: "Approval needed before the travel week",
    quote: {
      number: "BSA-1036",
      status: "sent",
      sentDays: 2,
      note: `${FICTIONAL} Illustrative demonstration figure for a premium SUV. This is not a published BSA Mobility rate. Chauffeur, schedule, and availability are not confirmed.`,
      lines: [
        { name: "Premium SUV hire", description: "Illustrative demonstration rate. Not a published BSA price.", qty: 3, unitPrice: 250, unit: "day" },
        { name: "Scheduled chauffeur pickups", description: "Illustrative allowance for several pickups. Not a published BSA price.", qty: 1, unitPrice: 150, unit: "allowance" },
      ],
    },
    thread: [
      { direction: "rep", text: "Simulated demonstration conversation. Nothing here was sent to a real phone.", hours: 200, system: true },
      { direction: "customer", text: "We need executive transport for three days next week. Several pickups, preferably a premium SUV.", hours: 190 },
      { direction: "rep", text: "I can prepare a quotation for the three days. Who needs to approve it, and when is the deadline?", hours: 186 },
      { direction: "customer", text: "Our office manager must approve it before the travel week. Please send the quotation.", hours: 180 },
    ],
  },
  {
    key: "northgate-return",
    name: "Northgate Advisory",
    company: "Northgate Advisory",
    location: "Eastlea, Harare",
    owner: "tariro",
    source: "PHONE",
    score: 78,
    requirement: "Airport transfers for visiting executives",
    bucket: "open",
    stage: "QUALIFIED",
    createdDays: 1,
    follow: "tomorrow",
    followLabel: "Repeat customer has another airport transfer enquiry. Confirm the visiting executives' arrival times.",
    priceBasis: "published_example",
    availability: "not_confirmed",
    vehicle: "Executive sedan",
    serviceType: "Repeat airport transfers",
    pickup: "Harare airport",
    destination: "Eastlea, Harare",
    whenLabel: "Two arrivals next week",
    duration: "Single trips",
    passengers: "Visiting executives",
    chauffeur: "Requested",
    thread: [
      { direction: "rep", text: "Simulated demonstration conversation. Nothing here was sent to a real phone.", hours: 30, system: true },
      { direction: "customer", text: "The same arrangement as last time, please. Two executives are landing next week and need airport transfers.", hours: 26 },
      { direction: "rep", text: "Welcome back. I can see the earlier fictional booking. Please send the arrival times and I will prepare the transfer quotation.", hours: 24 },
    ],
  },
  {
    key: "prado-check",
    name: "Tatenda Chirwa",
    location: "Avondale, Harare",
    owner: "tariro",
    source: "WEBSITE",
    score: 70,
    requirement: "Toyota Prado for a corporate site day",
    bucket: "open",
    stage: "SCOPING",
    createdDays: 4,
    follow: "today",
    followLabel: "Customer asked whether the Prado is available. Availability has not been confirmed.",
    priceBasis: "on_request",
    availability: "not_confirmed",
    vehicle: "Toyota Prado",
    serviceType: "Corporate day hire",
    pickup: "Avondale",
    destination: "Msasa industrial sites",
    whenLabel: "Thursday",
    duration: "1 day",
    chauffeur: "Requested",
    quote: {
      number: "BSA-1048",
      status: "draft",
      note: `${FICTIONAL} Toyota Prado has no published day rate in the material used for this demonstration. Price on request. Availability is not confirmed.`,
      lines: [
        { name: "Toyota Prado day hire", description: "Price on request. Not a published BSA rate.", qty: 1, unitPrice: 0, unit: "day" },
      ],
    },
  },
  {
    key: "c-class-request",
    name: "Rudo Samkange",
    location: "Greendale, Harare",
    owner: "tariro",
    source: "INSTAGRAM",
    score: 64,
    requirement: "Mercedes-Benz C-Class for a city evening",
    bucket: "open",
    stage: "SCOPING",
    createdDays: 5,
    follow: "tomorrow",
    followLabel: "C-Class quotation is still price on request. Confirm the pricing unit before sending it.",
    priceBasis: "on_request",
    availability: "not_confirmed",
    vehicle: "Mercedes-Benz C-Class",
    serviceType: "City chauffeur hire",
    pickup: "Greendale",
    destination: "Borrowdale dinner",
    whenLabel: "Saturday evening",
    duration: "1 evening",
    chauffeur: "Requested",
    quote: {
      number: "BSA-1051",
      status: "draft",
      note: `${FICTIONAL} ${C_CLASS_NOTE}`,
      lines: [
        { name: "Mercedes-Benz C-Class", description: C_CLASS_NOTE, qty: 1, unitPrice: 0, unit: "hire" },
      ],
    },
  },
  {
    key: "won-e400",
    name: "Chipo Mare",
    location: "Alexandra Park, Harare",
    owner: "tariro",
    source: "WHATSAPP_INBOUND",
    score: 90,
    requirement: "Mercedes-Benz E400, one standard hire day",
    bucket: "won",
    stage: "WON",
    createdDays: 18,
    wonDays: 6,
    priceBasis: "published_example",
    availability: "past_fictional_booking",
    vehicle: "Mercedes-Benz E400",
    serviceType: "Executive day hire",
    duration: "1 day",
    chauffeur: "Included in the fictional booking",
    follow: "done",
    followLabel: "Post-booking note recorded. No further chase.",
  },
  {
    key: "won-airport",
    name: "Northgate Advisory",
    company: "Northgate Advisory",
    location: "Eastlea, Harare",
    owner: "tariro",
    source: "PHONE",
    score: 88,
    requirement: "Four airport pickups for a previous executive visit",
    bucket: "won",
    stage: "WON",
    createdDays: 24,
    wonDays: 12,
    priceBasis: "published_example",
    availability: "past_fictional_booking",
    vehicle: "Executive sedan",
    serviceType: "Airport transfers",
    pickup: "Harare airport",
    destination: "Eastlea",
    duration: "4 trips",
    follow: "done",
    followLabel: "Earlier fictional booking completed.",
    thread: [
      { direction: "rep", text: "Simulated demonstration conversation. Nothing here was sent to a real phone.", hours: 400, system: true },
      { direction: "customer", text: "The visitors arrived smoothly. We will likely need transfers again.", hours: 300 },
      { direction: "rep", text: "Glad the fictional booking worked. I have kept it on the account history.", hours: 296 },
    ],
  },
  {
    key: "lost-price",
    name: "Allan Pfende",
    location: "Ruwa",
    owner: "tariro",
    source: "FACEBOOK",
    score: 40,
    requirement: "Executive sedan for two days",
    bucket: "lost",
    stage: "LOST",
    createdDays: 14,
    lostReason: "Price",
    priceBasis: "illustrative",
    availability: "not_confirmed",
    vehicle: "Executive sedan",
    serviceType: "Self-comparison hire",
    duration: "2 days",
    thread: [
      { direction: "rep", text: "Simulated demonstration conversation. Nothing here was sent to a real phone.", hours: 240, system: true },
      { direction: "customer", text: "That is above what I planned to spend. I will use another option.", hours: 200 },
      { direction: "rep", text: "Understood. I have recorded this fictional enquiry as lost on price.", hours: 198 },
    ],
  },
  {
    key: "bentley-m",
    name: "Tariro and Brian M.",
    location: "Borrowdale Brooke, Harare",
    owner: "munashe",
    source: "INSTAGRAM",
    score: 82,
    requirement: "Bentley Bentayga for wedding-day transport",
    bucket: "open",
    stage: "SCOPING",
    createdDays: 6,
    follow: "today",
    followLabel: "Confirm vehicle availability for the wedding request, then send the quotation.",
    priceBasis: "illustrative",
    availability: "not_confirmed",
    vehicle: "Bentley Bentayga",
    serviceType: "Wedding-day chauffeur",
    pickup: "Family home, Borrowdale Brooke",
    destination: "Wedding venue, Harare",
    whenLabel: "Wedding morning, time still to confirm",
    duration: "Wedding day",
    passengers: "Couple",
    chauffeur: "Preference still to confirm",
    quote: {
      number: "BSA-1039",
      status: "draft",
      note: `${FICTIONAL} Illustrative demonstration figure for a Bentley Bentayga wedding day. Not a published BSA Mobility rate. Venue time, chauffeur preference, and availability are not confirmed.`,
      lines: [
        { name: "Bentley Bentayga wedding-day hire", description: "Illustrative demonstration figure. Not a published BSA rate.", qty: 1, unitPrice: 800, unit: "day" },
      ],
    },
    thread: [
      { direction: "rep", text: "Simulated demonstration conversation. Nothing here was sent to a real phone.", hours: 150, system: true },
      { direction: "customer", text: "We are considering the Bentley Bentayga for our wedding day. Can you tell us if it would be available?", hours: 140 },
      { direction: "rep", text: "I can prepare a quotation once I have the venue time and whether you want a particular chauffeur arrangement. Availability is not confirmed yet.", hours: 136 },
      { direction: "customer", text: "The venue time is still being agreed. Please hold the quotation until we confirm it.", hours: 40 },
    ],
  },
  {
    key: "farai-nyathi",
    name: "Farai Nyathi",
    location: "Marondera",
    owner: "munashe",
    source: "WHATSAPP_INBOUND",
    score: 74,
    requirement: "Toyota Hilux Travo Overland Plus for multi-day out-of-town travel, cooler box requested",
    bucket: "open",
    stage: "NEGOTIATING",
    createdDays: 9,
    follow: "overdue",
    followLabel: "Farai is comparing options. The cooler-box request is noted and availability is not confirmed.",
    priceBasis: "illustrative",
    availability: "not_confirmed",
    vehicle: "Toyota Hilux Travo Overland Plus",
    serviceType: "Multi-day SUV hire",
    pickup: "Harare",
    destination: "Out of town",
    whenLabel: "A long weekend",
    duration: "4 days",
    passengers: "3",
    chauffeur: "Self-drive enquiry",
    addons: "Cooler box requested",
    quote: {
      number: "BSA-1033",
      status: "sent",
      sentDays: 3,
      note: `${FICTIONAL} Illustrative demonstration figure for the Hilux. Not a published BSA Mobility rate. Cooler box, route, and availability are not confirmed.`,
      lines: [
        { name: "Toyota Hilux Travo Overland Plus", description: "Illustrative demonstration figure. Not a published BSA rate.", qty: 4, unitPrice: 120, unit: "day" },
        { name: "Cooler box", description: "Optional add-on requested. No published price was used.", qty: 1, unitPrice: 0, unit: "add-on" },
      ],
    },
    thread: [
      { direction: "rep", text: "Simulated demonstration conversation. Nothing here was sent to a real phone.", hours: 220, system: true },
      { direction: "customer", text: "I am comparing a few options for the Hilux Overland Plus. Four days out of town. Can you add a cooler box?", hours: 210 },
      { direction: "rep", text: "I have noted the cooler box. This quotation is an illustrative demonstration figure, and I have not confirmed that the vehicle is free for those dates.", hours: 80 },
      { direction: "customer", text: "Thanks. I am still comparing. I will come back if the dates stay.", hours: 70 },
    ],
  },
  {
    key: "lumen-phantom",
    name: "Lumen Event Studio",
    company: "Lumen Event Studio",
    location: "Harare",
    owner: "munashe",
    source: "REFERRAL",
    score: 80,
    requirement: "Rolls-Royce Phantom for a VIP arrival",
    bucket: "open",
    stage: "SCOPING",
    createdDays: 2,
    follow: "today",
    followLabel: "VIP organiser has not approved the request. Quotation remains on request.",
    priceBasis: "on_request",
    availability: "not_confirmed",
    vehicle: "Rolls-Royce Phantom",
    serviceType: "VIP event transport",
    pickup: "Hotel, central Harare",
    destination: "Private event",
    whenLabel: "Event date supplied by the organiser, not confirmed",
    duration: "Event arrival",
    passengers: "VIP party",
    chauffeur: "Required",
    addons: "Special arrangements still to be listed",
    deadline: "Waiting for organiser approval",
    thread: [
      { direction: "rep", text: "Simulated demonstration conversation. Nothing here was sent to a real phone.", hours: 50, system: true },
      { direction: "customer", text: "We may need the Rolls-Royce Phantom for a VIP arrival. Please do not treat this as confirmed. I still need the organiser's approval.", hours: 46 },
      { direction: "rep", text: "Understood. I will keep this as a price-on-request enquiry. Availability is not confirmed.", hours: 44 },
    ],
  },
  {
    key: "fortuner-viewed",
    name: "Nyasha Dube",
    location: "Glen Lorne, Harare",
    owner: "munashe",
    source: "WEBSITE",
    score: 68,
    requirement: "Premium SUV for a family weekend",
    bucket: "open",
    stage: "PROPOSAL_SENT",
    createdDays: 7,
    follow: "tomorrow",
    followLabel: "Nyasha opened the SUV quotation and has not replied.",
    priceBasis: "illustrative",
    availability: "not_confirmed",
    vehicle: "Premium SUV",
    serviceType: "Weekend hire",
    duration: "2 days",
    chauffeur: "Not requested",
    quote: {
      number: "BSA-1028",
      status: "viewed",
      sentDays: 4,
      note: `${FICTIONAL} Illustrative demonstration figure. Not a published BSA Mobility rate. Availability is not confirmed.`,
      lines: [
        { name: "Premium SUV weekend hire", description: "Illustrative demonstration figure. Not a published BSA rate.", qty: 2, unitPrice: 180, unit: "day" },
      ],
    },
  },
  {
    key: "won-hilux",
    name: "Kudzi Ndlovu",
    location: "Chinhoyi",
    owner: "munashe",
    source: "WALK_IN",
    score: 85,
    requirement: "Toyota Hilux Travo Overland Plus, three-day fictional booking",
    bucket: "won",
    stage: "WON",
    createdDays: 20,
    wonDays: 4,
    priceBasis: "illustrative",
    availability: "past_fictional_booking",
    vehicle: "Toyota Hilux Travo Overland Plus",
    serviceType: "Multi-day hire",
    duration: "3 days",
    follow: "done",
    followLabel: "Fictional booking already completed.",
  },
  {
    key: "won-event",
    name: "Harare Chamber Dinner",
    company: "Harare Chamber Dinner",
    location: "Harare",
    owner: "munashe",
    source: "PHONE",
    score: 83,
    requirement: "Evening chauffeur for a private dinner",
    bucket: "won",
    stage: "WON",
    createdDays: 16,
    wonDays: 9,
    priceBasis: "illustrative",
    availability: "past_fictional_booking",
    vehicle: "Executive sedan",
    serviceType: "Event chauffeur",
    duration: "1 evening",
    chauffeur: "Included in the fictional booking",
  },
  {
    key: "won-chauffeur",
    name: "Simba Moyo",
    location: "Borrowdale, Harare",
    owner: "munashe",
    source: "REFERRAL",
    score: 81,
    requirement: "Airport arrival and hotel drop",
    bucket: "won",
    stage: "WON",
    createdDays: 22,
    wonDays: 3,
    priceBasis: "published_example",
    availability: "past_fictional_booking",
    vehicle: "Executive sedan",
    serviceType: "Airport pickup",
    pickup: "Harare airport",
    destination: "Borrowdale hotel",
    duration: "1 trip",
  },
  {
    key: "lost-date",
    name: "Blessing Hove",
    location: "Norton",
    owner: "munashe",
    source: "FACEBOOK",
    score: 36,
    requirement: "Wedding car for a date that was cancelled",
    bucket: "lost",
    stage: "LOST",
    createdDays: 12,
    lostReason: "Travel date no longer required",
    priceBasis: "on_request",
    availability: "not_confirmed",
    vehicle: "Luxury sedan",
    serviceType: "Wedding hire",
  },
  { key: "nyasha-unanswered", name: "Nyasha Mlambo", location: "Hatfield, Harare", owner: "tariro", source: "WHATSAPP_INBOUND", score: 72, requirement: "Airport pickup tomorrow morning", bucket: "lead", createdDays: 0, follow: "today", followLabel: "Nyasha is waiting for a first reply about an airport pickup.", priceBasis: "published_example", availability: "not_confirmed", vehicle: "Executive sedan", serviceType: "Airport pickup", pickup: "Harare airport", destination: "Hatfield", whenLabel: "Tomorrow morning", thread: [{ direction: "customer", text: "Good morning. Do you have a car for an airport pickup tomorrow? I have not heard back yet.", hours: 5 }] },
  { key: "tawananyasha-corp", name: "Tawananyasha Gwete", location: "Belgravia, Harare", owner: "tariro", source: "WEBSITE", score: 66, requirement: "Two corporate drop-offs this week", bucket: "lead", createdDays: 2, follow: "tomorrow", followLabel: "Collect the two drop-off times before qualifying the enquiry.", priceBasis: "on_request", availability: "not_confirmed", vehicle: "Executive sedan", serviceType: "Corporate transfers" },
  { key: "rumbidzai-delay", name: "Rumbidzai Ncube", location: "Avondale, Harare", owner: "tariro", source: "PHONE", score: 58, requirement: "Chauffeur for a board meeting", bucket: "lead", createdDays: 6, follow: "overdue", followLabel: "Callback requested after the first call was missed.", priceBasis: "on_request", availability: "not_confirmed", vehicle: "Executive sedan", serviceType: "Chauffeur", whenLabel: "Board morning" },
  { key: "sekai-phone", name: "Sekai Banda", location: "Waterfalls, Harare", owner: "tariro", source: "PHONE", score: 51, requirement: "Evening airport drop", bucket: "lead", createdDays: 3, follow: null, priceBasis: "published_example", availability: "not_confirmed", vehicle: "Executive sedan", serviceType: "Airport drop" },
  { key: "chengetai-site", name: "Chengetai Moyo", location: "Msasa, Harare", owner: "tariro", source: "WALK_IN", score: 47, requirement: "Day hire while their car is in service", bucket: "lead", createdDays: 8, follow: null, priceBasis: "on_request", availability: "not_confirmed", vehicle: "Toyota Prado", serviceType: "Day hire" },
  { key: "mombi-hold", name: "Mombi Chari", location: "Chitungwiza", owner: "tariro", source: "FACEBOOK", score: 43, requirement: "Weekend family transfer", bucket: "lead", createdDays: 11, follow: null, priceBasis: "on_request", availability: "not_confirmed", vehicle: "Premium SUV", serviceType: "Family transfer" },
  { key: "wedding-web", name: "Anesu Gurira", location: "Mount Pleasant, Harare", owner: "munashe", source: "WEBSITE", score: 69, requirement: "Wedding-car question, no date yet", bucket: "lead", createdDays: 1, follow: "today", followLabel: "Ask for the wedding date before discussing a vehicle.", priceBasis: "on_request", availability: "not_confirmed", vehicle: "Luxury sedan", serviceType: "Wedding enquiry" },
  { key: "price-shop", name: "Tafadzwa Zhou", location: "Borrowdale, Harare", owner: "munashe", source: "INSTAGRAM", score: 55, requirement: "Comparing luxury day rates", bucket: "lead", createdDays: 4, follow: "tomorrow", followLabel: "Customer is comparing. Do not present illustrative figures as BSA's price list.", priceBasis: "on_request", availability: "not_confirmed", vehicle: "Mercedes-Benz E400", serviceType: "Luxury day hire" },
  { key: "cooler-ask", name: "Rutendo Sithole", location: "Glen Lorne, Harare", owner: "munashe", source: "WHATSAPP_INBOUND", score: 60, requirement: "SUV hire and a cooler box", bucket: "lead", createdDays: 2, follow: null, priceBasis: "on_request", availability: "not_confirmed", vehicle: "Toyota Hilux Travo Overland Plus", serviceType: "SUV hire", addons: "Cooler box" },
  { key: "event-date", name: "Panashe Dube", location: "Highlands, Harare", owner: "munashe", source: "REFERRAL", score: 63, requirement: "Event transfer, date slipping", bucket: "lead", createdDays: 10, follow: "overdue", followLabel: "The requested event date is close and the enquiry is still unqualified.", priceBasis: "on_request", availability: "not_confirmed", vehicle: "Executive sedan", serviceType: "Event transfer" },
  { key: "silent-inbox", name: "Lee Chiweshe", location: "Harare", owner: "munashe", source: "WHATSAPP_INBOUND", score: 48, requirement: "Asked about the Phantom and went quiet", bucket: "lead", createdDays: 7, follow: null, priceBasis: "on_request", availability: "not_confirmed", vehicle: "Rolls-Royce Phantom", serviceType: "VIP enquiry", thread: [{ direction: "customer", text: "Is the Phantom something you can quote for a private arrival? No rush if you need to check.", hours: 160 }] },
  { key: "referral-suv", name: "Grace Nyathi", location: "Marondera", owner: "munashe", source: "REFERRAL", score: 57, requirement: "SUV for a visiting family", bucket: "lead", createdDays: 5, follow: "tomorrow", followLabel: "Confirm passenger count and whether a child seat is needed.", priceBasis: "on_request", availability: "not_confirmed", vehicle: "Premium SUV", serviceType: "Family hire", addons: "Child seat not yet confirmed" },
];

function phone(index: number): string {
  return `+263000${String(100000 + index).padStart(6, "0")}`;
}

function band(score: number): "hot" | "warm" | "cold" {
  if (score >= 75) return "hot";
  if (score >= 50) return "warm";
  return "cold";
}

function leadStatus(spec: Spec): LeadRow["status"] {
  if (spec.bucket === "won") return "WON";
  if (spec.bucket === "lost") return "LOST";
  if (spec.bucket === "open") return "CONVERTED_TO_DEAL";
  if (spec.createdDays === 0) return "NEW";
  if (spec.score >= 65) return "CONTACTED";
  return "NEW";
}

function lineTotal(lines: Line[]): number {
  return lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0);
}

export function buildBsaDataset(input: {
  now?: Date;
  clientId: string;
  actors: Record<string, DemoActor>;
}): DemoDataset {
  const now = input.now ?? new Date();
  const clientId = input.clientId;
  const contacts: ContactRow[] = [];
  const leads: LeadRow[] = [];
  const deals: DealRow[] = [];
  const quotations: QuotationRow[] = [];
  const lineItems: QuotationLineItemRow[] = [];
  const messages: DemoMessage[] = [];
  const activities: DemoActivity[] = [];
  const notifications: DemoNotification[] = [];
  const followUps: DemoFollowUp[] = [];

  const products: DemoProduct[] = [
    ["Mercedes-Benz E400", "BSA-E400", 200, "day", PUBLISHED_E400],
    ["Airport pickup or drop", "BSA-PICKUP", 50, "trip", PUBLISHED_PICKUP],
    ["Mercedes-Benz C-Class", "BSA-CCLASS", 0, "hire", C_CLASS_NOTE],
    ["Toyota Prado", "BSA-PRADO", 0, "day", "Price on request. No published day rate was used in this demonstration."],
    ["Toyota Hilux Travo Overland Plus", "BSA-HILUX", 0, "day", "Price on request. No published day rate was used in this demonstration."],
    ["Bentley Bentayga", "BSA-BENTAYGA", 0, "day", "Price on request. No published day rate was used in this demonstration."],
    ["Rolls-Royce Phantom", "BSA-PHANTOM", 0, "hire", "Price on request. No published rate was used in this demonstration."],
    ["Cooler box", "BSA-COOLER", 0, "add-on", "Optional add-on. No published price was used."],
    ["Child seat", "BSA-CHILD-SEAT", 0, "add-on", "Optional request. No published price was used."],
  ].map(([name, sku, price, unit, description]) => ({
    id: demoId(`bsa:product:${sku}`),
    client_id: clientId,
    name: String(name),
    sku: String(sku),
    brand: "BSA Mobility demonstration",
    category: unit === "add-on" ? "Add-on" : "Vehicle hire",
    size: String(unit),
    description: String(description),
    selling_price: Number(price),
    currency: "USD",
    stock: 0,
    unit: String(unit),
  }));

  SPECS.forEach((spec, index) => {
    const owner = input.actors[spec.owner];
    if (!owner) throw new Error(`BSA demonstration is missing ${spec.owner}.`);
    const contactId = demoId(`bsa:contact:${spec.key}`);
    const leadId = demoId(`bsa:lead:${spec.key}`);
    const dealId = spec.bucket === "lead" ? null : demoId(`bsa:deal:${spec.key}`);
    const created = daysAgo(spec.createdDays, now);
    const createdIso = demoIso(created);
    const followAt =
      spec.follow === "today"
        ? demoToday(now)
        : spec.follow === "tomorrow"
          ? daysFromNow(1, now)
          : spec.follow === "overdue" || spec.follow === "done"
            ? daysAgo(1, now)
            : null;
    const quoteTotal = spec.quote ? lineTotal(spec.quote.lines) : null;
    const value = spec.priceBasis === "on_request" ? null : quoteTotal ?? (spec.bucket === "won" ? publishedWinValue(spec) : null);

    contacts.push({
      id: contactId,
      client_id: clientId,
      name: spec.company ?? spec.name,
      phone: phone(index + 10),
      email: null,
      location: spec.location,
      source: spec.source,
      lead_origin: "client",
      lifecycle: spec.bucket === "won" ? "customer" : spec.bucket === "lead" ? "aware" : "pipeline",
      customer_type: spec.company ? "company" : "individual",
      primary_contact_name: spec.company ? spec.name : null,
      industry: spec.company ? "Professional services" : null,
      relationship_owner_id: owner.id,
      notes: `${spec.vehicle}. ${FICTIONAL}`,
      tags: spec.company ? ["corporate", "fictional"] : ["fictional"],
      created_at: createdIso,
      updated_at: createdIso,
    });

    const form: Record<string, unknown> = {
      vehicle: spec.vehicle,
      serviceType: spec.serviceType,
      pickup: spec.pickup ?? null,
      destination: spec.destination ?? null,
      requestedWhen: spec.whenLabel ?? null,
      duration: spec.duration ?? null,
      passengers: spec.passengers ?? null,
      chauffeur: spec.chauffeur ?? null,
      addons: spec.addons ?? null,
      availability: spec.availability,
      priceBasis: spec.priceBasis,
      decisionDeadline: spec.deadline ?? null,
      requirement: spec.requirement,
      fictional: true,
    };
    if (spec.company) form.company = spec.company;

    leads.push({
      id: leadId,
      client_id: clientId,
      assigned_to_id: owner.id,
      contact_id: contactId,
      source: spec.source as LeadSource,
      status: leadStatus(spec),
      form_data: form,
      name: spec.company ?? spec.name,
      phone: phone(index + 10),
      email: null,
      budget: value != null ? `USD ${value} fictional demonstration` : "Price on request",
      project_type: spec.serviceType,
      timeline: spec.whenLabel ?? spec.duration ?? null,
      magic_token: null,
      magic_token_expires_at: null,
      not_qualified_reason: null,
      lost_reason: spec.lostReason ?? null,
      deal_value: value,
      follow_up_date: followAt ? demoIso(followAt) : null,
      facebook_lead_id: null,
      created_at: createdIso,
      updated_at: createdIso,
      score: spec.score,
      score_updated_at: createdIso,
      score_breakdown: null,
      is_stale: spec.createdDays > 14 && spec.bucket !== "won",
      stale_since: null,
      is_convert_later_pick: false,
      convert_later_note: null,
      manual_priority: band(spec.score),
      active_deal_id: dealId,
      customer_need: spec.requirement,
    });

    if (dealId && spec.stage) {
      const wonAt = spec.bucket === "won" ? withinCurrentMonth(spec.wonDays ?? 3, now) : null;
      const lostAt = spec.bucket === "lost" ? daysAgo(Math.min(spec.createdDays, 8), now) : null;
      const deal: DealRow = {
        id: dealId,
        client_id: clientId,
        contact_id: contactId,
        originating_lead_id: leadId,
        owner_id: owner.id,
        name: `${spec.company ?? spec.name} — ${spec.vehicle}`,
        service_summary: spec.requirement,
        stage: spec.stage,
        value_status: spec.priceBasis === "on_request" ? "PENDING_ESTIMATE" : "KNOWN",
        value_basis: spec.bucket === "won" ? "WON_VALUE" : spec.quote && quoteTotal ? "LATEST_QUOTE" : "SALES_ESTIMATE",
        estimated_value: value,
        estimated_value_min: null,
        estimated_value_max: null,
        customer_budget: null,
        sales_estimate: value,
        expected_decision_at: spec.deadline ? demoIso(daysFromNow(3, now)) : null,
        location: spec.location,
        buying_timeframe: spec.whenLabel ?? spec.duration ?? null,
        decision_maker_status: spec.company ? "NO" : "YES",
        decision_maker_name: spec.company ? "Awaiting their approver" : spec.name,
        next_action_at: followAt && spec.follow !== "done" ? demoIso(followAt) : null,
        next_action_label: spec.follow === "done" ? null : spec.followLabel ?? null,
        won_value: spec.bucket === "won" ? value : null,
        won_at: wonAt ? demoIso(wonAt) : null,
        lost_at: lostAt ? demoIso(lostAt) : null,
        lost_reason: spec.lostReason ?? null,
        last_meaningful_activity_at: demoIso(daysAgo(Math.min(spec.createdDays, 2), now)),
        metadata: {
          demo: true,
          fictional: true,
          vehicle: spec.vehicle,
          serviceType: spec.serviceType,
          priceBasis: spec.priceBasis,
          availability: spec.availability,
        },
        created_at: createdIso,
        updated_at: createdIso,
      };
      deals.push(deal);
      activities.push({
        id: demoId(`bsa:act:${spec.key}:in`),
        leadId,
        dealId,
        actorKey: spec.owner,
        title: "Enquiry received",
        detail: spec.requirement,
        kind: "lead",
        at: createdIso,
      });
    } else {
      activities.push({
        id: demoId(`bsa:act:${spec.key}:in`),
        leadId,
        dealId: null,
        actorKey: spec.owner,
        title: spec.createdDays === 0 ? "Unanswered enquiry" : "Enquiry received",
        detail: spec.requirement,
        kind: "lead",
        at: createdIso,
      });
    }

    if (spec.quote && dealId) {
      const quoteId = demoId(`bsa:quote:${spec.quote.number}`);
      const sent = spec.quote.sentDays != null ? daysAgo(spec.quote.sentDays, now) : null;
      const total = lineTotal(spec.quote.lines);
      quotations.push({
        id: quoteId,
        client_id: clientId,
        lead_id: leadId,
        deal_id: dealId,
        quote_number: spec.quote.number,
        status: spec.quote.status,
        customer_name: spec.company ?? spec.name,
        customer_phone: phone(index + 10),
        customer_email: null,
        subtotal: total,
        tax_rate: 0,
        tax_amount: 0,
        other_amount: 0,
        total,
        currency: "USD",
        valid_until: demoIso(daysFromNow(7, now)),
        notes: spec.quote.note,
        terms: "Fictional demonstration only. Availability, insurance, deposits, and driver assignment are not confirmed.",
        prepared_by_id: owner.id,
        prepared_by_name: owner.name,
        pdf_url: null,
        pdf_key: null,
        public_token: null,
        viewed_at: spec.quote.status === "viewed" ? demoIso(daysAgo(1, now)) : null,
        responded_at: null,
        parent_quotation_id: null,
        revision_number: 1,
        superseded_by_id: null,
        sent_at: sent ? demoIso(sent) : null,
        accepted_at: null,
        created_at: demoIso(daysAgo((spec.quote.sentDays ?? 0) + 1, now)),
        updated_at: sent ? demoIso(sent) : createdIso,
      });
      spec.quote.lines.forEach((line, lineIndex) => {
        lineItems.push({
          id: demoId(`bsa:line:${spec.quote!.number}:${lineIndex}`),
          quotation_id: quoteId,
          catalog_item_id: null,
          product_id: null,
          item_name: line.name,
          description: line.description,
          unit_price: line.unitPrice,
          quantity: line.qty,
          amount: line.qty * line.unitPrice,
          group_label: null,
          sort_order: lineIndex,
          created_at: createdIso,
          unit: line.unit,
          source_type: "CUSTOM",
        });
      });
    }

    if (followAt && spec.followLabel && spec.follow !== "done") {
      followUps.push({
        id: demoId(`bsa:fu:${spec.key}`),
        leadId,
        dealId,
        ownerKey: spec.owner,
        label: spec.followLabel,
        dueAt: demoIso(followAt),
        completed: false,
      });
    }
    if (spec.follow === "done" && followAt) {
      followUps.push({
        id: demoId(`bsa:fu:${spec.key}`),
        leadId,
        dealId,
        ownerKey: spec.owner,
        label: spec.followLabel ?? "Completed",
        dueAt: demoIso(followAt),
        completed: true,
      });
    }

    for (const line of spec.thread ?? []) {
      messages.push({
        id: demoId(`bsa:msg:${spec.key}:${line.hours}:${line.direction}`),
        leadId,
        direction: line.direction,
        text: line.text,
        at: demoIso(hoursAgo(line.hours, now)),
        actorKey: line.direction === "rep" ? spec.owner : null,
        kind: line.system ? "system" : "message",
      });
    }
  });

  notifications.push(
    { id: demoId("bsa:n:1"), userKey: "tariro", type: "FOLLOW_UP_DUE", message: "Follow up with Ruvimbo about the E400 quotation.", read: false, leadId: demoId("bsa:lead:ruvimbo-ncube"), quotationId: demoId("bsa:quote:BSA-1042"), at: demoIso(hoursAgo(2, now)) },
    { id: demoId("bsa:n:2"), userKey: "tariro", type: "NEW_LEAD", message: "Nyasha Mlambo is waiting on an airport pickup reply.", read: false, leadId: demoId("bsa:lead:nyasha-unanswered"), quotationId: null, at: demoIso(hoursAgo(5, now)) },
    { id: demoId("bsa:n:3"), userKey: "tariro", type: "QUOTATION_ALERT", message: "Mavambo Consulting has not approved the three-day quotation.", read: false, leadId: demoId("bsa:lead:mavambo"), quotationId: demoId("bsa:quote:BSA-1036"), at: demoIso(hoursAgo(8, now)) },
    { id: demoId("bsa:n:4"), userKey: "munashe", type: "FOLLOW_UP_DUE", message: "Confirm availability for the Bentley wedding request.", read: false, leadId: demoId("bsa:lead:bentley-m"), quotationId: demoId("bsa:quote:BSA-1039"), at: demoIso(hoursAgo(3, now)) },
    { id: demoId("bsa:n:5"), userKey: "munashe", type: "WHATSAPP_MESSAGE", message: "Farai Nyathi is still comparing the Hilux quotation.", read: false, leadId: demoId("bsa:lead:farai-nyathi"), quotationId: demoId("bsa:quote:BSA-1033"), at: demoIso(hoursAgo(6, now)) },
    { id: demoId("bsa:n:6"), userKey: "owner", type: "FOLLOW_UP_DUE", message: "Two follow-ups are overdue across the sales team.", read: false, leadId: null, quotationId: null, at: demoIso(demoToday(now)) }
  );

  activities.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  return {
    version: 1,
    industry: BSA_WORKSPACE.industry,
    scenario: BSA_WORKSPACE.scenario,
    clientId,
    organisationName: BSA_WORKSPACE.name,
    timezone: BSA_WORKSPACE.timezone,
    generatedAt: demoIso(now),
    actors: input.actors,
    products,
    contacts,
    leads,
    deals,
    quotations,
    lineItems,
    messages,
    activities,
    notifications,
    followUps,
  };
}

function publishedWinValue(spec: Spec): number | null {
  if (spec.key === "won-e400") return 200;
  if (spec.key === "won-airport") return 200;
  if (spec.key === "won-chauffeur") return 50;
  if (spec.key === "won-hilux") return 360;
  if (spec.key === "won-event") return 180;
  return null;
}
