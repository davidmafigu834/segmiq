import type { DemoActorKey } from "@/lib/demo/actors";
import { ROSSI_WORKSPACE } from "@/lib/demo/actors";
import {
  daysAgo,
  daysFromNow,
  demoIso,
  demoToday,
  hoursAgo,
  inPreviousMonth,
  withinCurrentMonth,
} from "@/lib/demo/dates";
import { demoId } from "@/lib/demo/ids";
import type {
  DemoActivity,
  DemoActor,
  DemoDataset,
  DemoMessage,
  DemoNotification,
  DemoProduct,
} from "@/lib/demo/types";
import type {
  ContactRow,
  DealRow,
  DealStage,
  LeadRow,
  LeadSource,
  QuotationLineItemRow,
  QuotationRow,
  QuotationStatus,
} from "@/types";

type Owner = DemoActorKey;

type Spec = {
  key: string;
  name: string;
  company?: string;
  customerType?: "individual" | "company";
  vehicle?: string;
  location: string;
  owner: Owner;
  source: LeadSource | "WALK_IN" | "PHONE";
  score: number;
  requirement: string;
  bucket: "lead" | "open" | "won" | "lost";
  stage?: DealStage;
  value?: number;
  createdDays: number;
  wonDays?: number;
  wonPrevious?: boolean;
  follow?: "today" | "tomorrow" | "overdue" | null;
  quote?: { number: string; status: QuotationStatus; sentDays?: number };
  qty?: number;
  unitPrice?: number;
  productKey?: string;
  lostReason?: string;
  thread?: "hilux" | "brian" | "westgate" | "nyathi" | "short";
};

const SPECS: Spec[] = [
  // Scenario D — urgent buyer
  { key: "brian-ncube", name: "Brian Ncube", vehicle: "Ford Ranger", location: "Borrowdale, Harare", owner: "tinashe", source: "WHATSAPP_INBOUND", score: 92, requirement: "245/70R16 available today", bucket: "lead", createdDays: 0, follow: "today", thread: "brian" },
  // Open leads
  { key: "chipo-dube", name: "Chipo Dube", vehicle: "Toyota Aqua", location: "Avondale, Harare", owner: "tinashe", source: "FACEBOOK", score: 71, requirement: "185/65R15 × 2", bucket: "lead", createdDays: 1, follow: "today", thread: "short" },
  { key: "farai-sibanda", name: "Farai Sibanda", vehicle: "Honda Fit", location: "Mabelreign, Harare", owner: "rudo", source: "INSTAGRAM", score: 64, requirement: "175/65R14 × 4", bucket: "lead", createdDays: 1, follow: "tomorrow", thread: "short" },
  { key: "nyasha-mlambo", name: "Nyasha Mlambo", vehicle: "Nissan NP300", location: "Chitungwiza", owner: "tinashe", source: "WEBSITE", score: 58, requirement: "195R15C × 2", bucket: "lead", createdDays: 3, follow: null, thread: "short" },
  { key: "tariro-ngwenya", name: "Tariro Ngwenya", vehicle: "Mazda CX-5", location: "Mount Pleasant, Harare", owner: "rudo", source: "FACEBOOK", score: 77, requirement: "225/55R19 × 4", bucket: "lead", createdDays: 2, follow: "overdue", thread: "short" },
  { key: "kudakwashe-zhou", name: "Kudakwashe Zhou", vehicle: "Toyota Hilux", location: "Ruwa", owner: "tanaka", source: "REFERRAL", score: 69, requirement: "265/65R17 × 4", bucket: "lead", createdDays: 4, follow: null, thread: "short" },
  { key: "lisa-moyo", name: "Lisa Moyo", vehicle: "Mercedes C-Class", location: "Borrowdale Brooke", owner: "rudo", source: "WALK_IN", score: 48, requirement: "225/45R18 × 2", bucket: "lead", createdDays: 6, follow: null, thread: "short" },
  { key: "peter-banda", name: "Peter Banda", vehicle: "Isuzu D-Max", location: "Msasa, Harare", owner: "tinashe", source: "PHONE", score: 55, requirement: "245/70R16 × 4", bucket: "lead", createdDays: 5, follow: "tomorrow", thread: "short" },
  { key: "memory-chikwanha", name: "Memory Chikwanha", vehicle: "Toyota Fortuner", location: "Greendale, Harare", owner: "rudo", source: "WHATSAPP_INBOUND", score: 81, requirement: "265/60R18 × 4", bucket: "lead", createdDays: 0, follow: "today", thread: "short" },
  { key: "gift-mukono", name: "Gift Mukono", vehicle: "Toyota GD6", location: "Waterfalls, Harare", owner: "tinashe", source: "FACEBOOK", score: 44, requirement: "265/70R16 × 1 puncture replacement", bucket: "lead", createdDays: 12, follow: null, thread: "short" },
  { key: "wadzanai-mare", name: "Wadzanai Mare", vehicle: "Honda Fit", location: "Budiriro, Harare", owner: "rudo", source: "INSTAGRAM", score: 34, requirement: "175/65R14 × 4, inactive", bucket: "lead", createdDays: 21, follow: null, thread: "short" },
  { key: "tonderai-sithole", name: "Tonderai Sithole", vehicle: "Ford Ranger", location: "Norton", owner: "tanaka", source: "WEBSITE", score: 62, requirement: "265/65R17 × 4", bucket: "lead", createdDays: 2, follow: null, thread: "short" },
  { key: "rutendo-gwete", name: "Rutendo Gwete", vehicle: "Toyota Hilux", location: "Marondera", owner: "tinashe", source: "REFERRAL", score: 73, requirement: "265/70R16 × 4 highway", bucket: "lead", createdDays: 3, follow: "overdue", thread: "short" },
  { key: "simbarashe-ndlovu", name: "Simbarashe Ndlovu", vehicle: "Mazda CX-5", location: "Belvedere, Harare", owner: "rudo", source: "WALK_IN", score: 51, requirement: "225/65R17 × 2", bucket: "lead", createdDays: 7, follow: null, thread: "short" },
  { key: "anotida-mhaka", name: "Anotida Mhaka", vehicle: "Nissan NP300", location: "Epworth", owner: "tanaka", source: "PHONE", score: 46, requirement: "195R15C × 4", bucket: "lead", createdDays: 9, follow: null, thread: "short" },
  { key: "panashe-kambarami", name: "Panashe Kambarami", vehicle: "Toyota Aqua", location: "Hatfield, Harare", owner: "tinashe", source: "FACEBOOK", score: 67, requirement: "185/65R15 × 4", bucket: "lead", createdDays: 1, follow: null, thread: "short" },
  { key: "yeukai-chirwa", name: "Yeukai Chirwa", vehicle: "Isuzu D-Max", location: "Kadoma", owner: "rudo", source: "WHATSAPP_INBOUND", score: 74, requirement: "245/75R16 × 4", bucket: "lead", createdDays: 0, follow: "today", thread: "short" },

  // Scenario A
  { key: "tendai-moyo", name: "Tendai Moyo", vehicle: "Toyota Hilux GD6", location: "Eastlea, Harare", owner: "tinashe", source: "FACEBOOK", score: 82, requirement: "265/70R16 × 4", bucket: "open", stage: "PROPOSAL_SENT", value: 780, createdDays: 9, follow: "today", quote: { number: "QT-1028", status: "sent", sentDays: 2 }, qty: 4, unitPrice: 195, productKey: "bs-dueler-265", thread: "hilux" },
  { key: "tatenda-cx5", name: "Tatenda Nkomo", vehicle: "Mazda CX-5", location: "Alexandra Park, Harare", owner: "tinashe", source: "INSTAGRAM", score: 76, requirement: "225/65R17 × 4", bucket: "open", stage: "PROPOSAL_SENT", value: 840, createdDays: 11, follow: null, quote: { number: "QT-1036", status: "sent", sentDays: 4 }, qty: 4, unitPrice: 210, productKey: "dunlop-265" },
  { key: "aqua-muza", name: "Ruvimbo Muza", vehicle: "Toyota Aqua", location: "Warren Park, Harare", owner: "tinashe", source: "WEBSITE", score: 61, requirement: "185/65R15 × 4", bucket: "open", stage: "QUALIFIED", value: 410, createdDays: 6, follow: "tomorrow" },
  { key: "dmax-chari", name: "Obey Chari", vehicle: "Isuzu D-Max", location: "Workington, Harare", owner: "tinashe", source: "WHATSAPP_INBOUND", score: 84, requirement: "245/70R16 × 4", bucket: "open", stage: "NEGOTIATING", value: 960, createdDays: 14, follow: "today", quote: { number: "QT-1019", status: "viewed", sentDays: 3 }, qty: 4, unitPrice: 240, productKey: "ranger-245", thread: "short" },
  { key: "merc-ndoro", name: "Kudzi Ndoro", vehicle: "Mercedes C-Class", location: "Borrowdale, Harare", owner: "tinashe", source: "REFERRAL", score: 70, requirement: "225/45R17 × 4", bucket: "open", stage: "PROPOSAL_SENT", value: 1180, createdDays: 8, follow: null, quote: { number: "QT-1042", status: "sent", sentDays: 1 }, qty: 4, unitPrice: 295, productKey: "conti-225" },
  { key: "np300-zane", name: "Zanele Mpofu", vehicle: "Nissan NP300", location: "Highfield, Harare", owner: "tinashe", source: "PHONE", score: 57, requirement: "195R15C × 4", bucket: "open", stage: "SCOPING", value: 620, createdDays: 5, follow: null },
  { key: "fortuner-lee", name: "Lee Chiweshe", vehicle: "Toyota Fortuner", location: "Glen Lorne, Harare", owner: "tinashe", source: "WALK_IN", score: 68, requirement: "265/65R17 × 4", bucket: "open", stage: "QUALIFIED", value: 1040, createdDays: 4, follow: "overdue" },

  // Scenario C
  { key: "rudo-nyathi", name: "Rudo Nyathi", vehicle: "Honda Fit", location: "Mabelreign, Harare", owner: "rudo", source: "WHATSAPP_INBOUND", score: 66, requirement: "195/65R15 × 4, lower-cost option", bucket: "open", stage: "SCOPING", value: 380, createdDays: 4, follow: "today", quote: { number: "QT-1048", status: "draft" }, qty: 4, unitPrice: 95, productKey: "pass-195", thread: "nyathi" },
  { key: "gd6-mutasa", name: "Tapiwa Mutasa", vehicle: "Toyota GD6", location: "Hatcliffe, Harare", owner: "rudo", source: "FACEBOOK", score: 79, requirement: "265/70R16 × 4", bucket: "open", stage: "PROPOSAL_SENT", value: 720, createdDays: 7, follow: null, quote: { number: "QT-1033", status: "sent", sentDays: 2 }, qty: 4, unitPrice: 180, productKey: "bs-dueler-265" },
  { key: "mazda3-pedu", name: "Pedzisai Gumbo", vehicle: "Mazda 3", location: "Kuwadzana, Harare", owner: "rudo", source: "INSTAGRAM", score: 52, requirement: "205/60R16 × 4", bucket: "open", stage: "QUALIFIED", value: 290, createdDays: 3, follow: null },
  { key: "hilux-ref", name: "Nomsa Chirume", vehicle: "Toyota Hilux", location: "Chinhoyi", owner: "rudo", source: "REFERRAL", score: 75, requirement: "265/65R17 × 4", bucket: "open", stage: "NEGOTIATING", value: 860, createdDays: 16, follow: "overdue", quote: { number: "QT-1008", status: "viewed", sentDays: 6 }, qty: 4, unitPrice: 215, productKey: "dunlop-265" },
  { key: "fit-two", name: "Blessing Dube", vehicle: "Honda Fit", location: "Dzivarasekwa, Harare", owner: "rudo", source: "WALK_IN", score: 49, requirement: "175/65R14 × 4", bucket: "open", stage: "QUALIFIED", value: 340, createdDays: 8, follow: "tomorrow" },
  { key: "ranger-rudo", name: "Allan Pfende", vehicle: "Ford Ranger", location: "Ruwa", owner: "rudo", source: "WEBSITE", score: 80, requirement: "265/60R18 × 4", bucket: "open", stage: "PROPOSAL_SENT", value: 990, createdDays: 6, follow: null, quote: { number: "QT-1051", status: "sent", sentDays: 1 }, qty: 4, unitPrice: 247.5, productKey: "conti-225" },

  // Scenario B and fleet
  { key: "westgate", name: "Westgate Logistics", company: "Westgate Logistics", customerType: "company", location: "Msasa, Harare", owner: "tanaka", source: "WHATSAPP_INBOUND", score: 88, requirement: "24 commercial truck tyres, delivery before month-end", bucket: "open", stage: "NEGOTIATING", value: 7800, createdDays: 18, follow: "today", quote: { number: "QT-1031", status: "sent", sentDays: 2 }, qty: 24, unitPrice: 325, productKey: "truck-315", thread: "westgate" },
  { key: "harare-civil", name: "Harare Civil Contractors", company: "Harare Civil Contractors", customerType: "company", location: "Graniteside, Harare", owner: "tanaka", source: "REFERRAL", score: 83, requirement: "16 × 315/80R22.5 for tippers", bucket: "open", stage: "PROPOSAL_SENT", value: 4860, createdDays: 12, follow: null, quote: { number: "QT-1024", status: "sent", sentDays: 5 }, qty: 16, unitPrice: 303.75, productKey: "truck-315" },
  { key: "sunrise", name: "Sunrise Distribution", company: "Sunrise Distribution", customerType: "company", location: "Southerton, Harare", owner: "tanaka", source: "WEBSITE", score: 72, requirement: "12 × 265/70R16 van fleet", bucket: "open", stage: "SCOPING", value: 2450, createdDays: 7, follow: "tomorrow" },
  { key: "falcon", name: "Falcon Mining Services", company: "Falcon Mining Services", customerType: "company", location: "Bindura", owner: "tanaka", source: "PHONE", score: 69, requirement: "8 × 265/65R17 site vehicles", bucket: "open", stage: "QUALIFIED", value: 3120, createdDays: 10, follow: null },
  { key: "metro", name: "Metro Courier Services", company: "Metro Courier Services", customerType: "company", location: "Willowvale, Harare", owner: "tanaka", source: "FACEBOOK", score: 78, requirement: "8 × 195R15C delivery vans", bucket: "open", stage: "PROPOSAL_SENT", value: 1680, createdDays: 9, follow: "overdue", quote: { number: "QT-1039", status: "sent", sentDays: 3 }, qty: 8, unitPrice: 210, productKey: "van-195" },
  { key: "valley", name: "Valley Foods Distribution", company: "Valley Foods Distribution", customerType: "company", location: "Marondera", owner: "tanaka", source: "REFERRAL", score: 63, requirement: "6 × 225/75R16C", bucket: "open", stage: "SCOPING", value: 920, createdDays: 5, follow: null, quote: { number: "QT-1055", status: "draft" }, qty: 6, unitPrice: 153.33, productKey: "van-195" },
  { key: "apex", name: "Apex Construction", company: "Apex Construction", customerType: "company", location: "Pomona, Harare", owner: "tanaka", source: "WALK_IN", score: 74, requirement: "8 × 265/70R16 bakkies", bucket: "open", stage: "QUALIFIED", value: 1540, createdDays: 6, follow: null },
  { key: "roadlink", name: "RoadLink Transport", company: "RoadLink Transport", customerType: "company", location: "Norton", owner: "tanaka", source: "WHATSAPP_INBOUND", score: 86, requirement: "10 × 315/80R22.5", bucket: "open", stage: "NEGOTIATING", value: 2100, createdDays: 15, follow: "today", quote: { number: "QT-1012", status: "viewed", sentDays: 4 }, qty: 10, unitPrice: 210, productKey: "truck-315", thread: "short" },

  // Won this month
  { key: "won-t1", name: "Munashe Gororo", vehicle: "Toyota Hilux", location: "Borrowdale", owner: "tinashe", source: "FACEBOOK", score: 90, requirement: "265/70R16 × 4 fitted", bucket: "won", stage: "WON", value: 2480, createdDays: 20, wonDays: 2 },
  { key: "won-t2", name: "Charity Mapfumo", vehicle: "Ford Ranger", location: "Mt Pleasant", owner: "tinashe", source: "WHATSAPP_INBOUND", score: 88, requirement: "265/65R17 × 4", bucket: "won", stage: "WON", value: 2140, createdDays: 24, wonDays: 6 },
  { key: "won-t3", name: "Edmore Zulu", vehicle: "Isuzu D-Max", location: "Workington", owner: "tinashe", source: "WALK_IN", score: 84, requirement: "245/70R16 × 4", bucket: "won", stage: "WON", value: 1800, createdDays: 18, wonDays: 11 },
  { key: "won-k1", name: "Pinnacle Haulage", company: "Pinnacle Haulage", customerType: "company", location: "Msasa", owner: "tanaka", source: "REFERRAL", score: 91, requirement: "8 truck tyres", bucket: "won", stage: "WON", value: 3420, createdDays: 28, wonDays: 3 },
  { key: "won-k2", name: "Cityline Bakery", company: "Cityline Bakery", customerType: "company", location: "Southerton", owner: "tanaka", source: "PHONE", score: 80, requirement: "6 van tyres", bucket: "won", stage: "WON", value: 2450, createdDays: 22, wonDays: 8 },
  { key: "won-r1", name: "Shamiso Bhebhe", vehicle: "Mazda CX-5", location: "Avondale", owner: "rudo", source: "INSTAGRAM", score: 86, requirement: "225/65R17 × 4", bucket: "won", stage: "WON", value: 2280, createdDays: 19, wonDays: 4 },
  { key: "won-r2", name: "Trevor Hove", vehicle: "Toyota Fortuner", location: "Greendale", owner: "rudo", source: "FACEBOOK", score: 83, requirement: "265/60R18 × 4", bucket: "won", stage: "WON", value: 1840, createdDays: 16, wonDays: 9 },
  // Previous month wins
  { key: "won-prev-t", name: "Josephat Mhere", vehicle: "Nissan NP300", location: "Chitungwiza", owner: "tinashe", source: "WEBSITE", score: 78, requirement: "195R15C × 4", bucket: "won", stage: "WON", value: 1560, createdDays: 40, wonPrevious: true },
  { key: "won-prev-r", name: "Linda Choto", vehicle: "Honda Fit", location: "Mabelreign", owner: "rudo", source: "WALK_IN", score: 75, requirement: "175/65R14 × 4", bucket: "won", stage: "WON", value: 980, createdDays: 45, wonPrevious: true },
  { key: "won-prev-k", name: "Granite Run Contractors", company: "Granite Run Contractors", customerType: "company", location: "Ruwa", owner: "tanaka", source: "REFERRAL", score: 82, requirement: "6 truck tyres", bucket: "won", stage: "WON", value: 2100, createdDays: 50, wonPrevious: true },

  // Scenario E and other losses
  { key: "simba", name: "Simba Transport", company: "Simba Transport", customerType: "company", location: "Willowvale, Harare", owner: "tanaka", source: "WHATSAPP_INBOUND", score: 60, requirement: "12 commercial tyres", bucket: "lost", stage: "LOST", value: 5040, createdDays: 26, lostReason: "Went with competitor" },
  { key: "lost-price", name: "Darlington Nyauchi", vehicle: "Toyota Hilux", location: "Kwekwe", owner: "tinashe", source: "FACEBOOK", score: 40, requirement: "265/70R16 × 4", bucket: "lost", stage: "LOST", value: 780, createdDays: 30, lostReason: "Price" },
  { key: "lost-silent", name: "Patience Mugabe", vehicle: "Toyota Aqua", location: "Budiriro", owner: "rudo", source: "INSTAGRAM", score: 33, requirement: "185/65R15 × 4", bucket: "lost", stage: "LOST", value: 380, createdDays: 33, lostReason: "No response" },
  { key: "lost-later", name: "Highway Mealies", company: "Highway Mealies", customerType: "company", location: "Chegutu", owner: "tanaka", source: "PHONE", score: 42, requirement: "8 van tyres", bucket: "lost", stage: "LOST", value: 1640, createdDays: 21, lostReason: "Purchase postponed" },
  { key: "lost-size", name: "Elton Sango", vehicle: "Mercedes C-Class", location: "Borrowdale", owner: "rudo", source: "WALK_IN", score: 38, requirement: "245/40R18 staggered", bucket: "lost", stage: "LOST", value: 920, createdDays: 17, lostReason: "Required size unavailable" },
  { key: "lost-price-2", name: "Owen Chidziva", vehicle: "Ford Ranger", location: "Norton", owner: "tinashe", source: "WEBSITE", score: 36, requirement: "265/65R17 × 4", bucket: "lost", stage: "LOST", value: 840, createdDays: 14, lostReason: "Price" },
];

const PRODUCTS: Array<Omit<DemoProduct, "id" | "client_id">> = [
  { name: "Bridgestone Dueler A/T", sku: "BS-DUELER-265-70-16", brand: "Bridgestone", category: "SUV / 4x4", size: "265/70R16", description: "All-terrain tyre. Demonstration price for the Rossi Tyres workspace.", selling_price: 195, currency: "USD", stock: 18, unit: "tyre" },
  { name: "Dunlop Grandtrek AT5", sku: "DL-GT-265-65-17", brand: "Dunlop", category: "SUV", size: "265/65R17", description: "SUV all-terrain. Demonstration price.", selling_price: 210, currency: "USD", stock: 11, unit: "tyre" },
  { name: "Continental CrossContact", sku: "CO-CC-225-65-17", brand: "Continental", category: "SUV", size: "225/65R17", description: "Highway SUV tyre. Demonstration price.", selling_price: 185, currency: "USD", stock: 14, unit: "tyre" },
  { name: "Commercial Truck Tyre", sku: "TR-315-80-225", brand: "Rossi Fleet Spec", category: "Truck", size: "315/80R22.5", description: "Steer / drive truck tyre. Demonstration price, not an official list.", selling_price: 420, currency: "USD", stock: 32, unit: "tyre" },
  { name: "Passenger Tyre", sku: "PS-195-65-15", brand: "Rossi Passenger", category: "Passenger", size: "195/65R15", description: "Everyday passenger tyre. Demonstration price.", selling_price: 95, currency: "USD", stock: 40, unit: "tyre" },
  { name: "Bridgestone Turanza", sku: "BS-TUR-205-55-16", brand: "Bridgestone", category: "Passenger", size: "205/55R16", description: "Touring passenger tyre. Demonstration price.", selling_price: 128, currency: "USD", stock: 16, unit: "tyre" },
  { name: "Dunlop SP Sport", sku: "DL-SP-225-45-17", brand: "Dunlop", category: "Passenger", size: "225/45R17", description: "Performance passenger tyre. Demonstration price.", selling_price: 168, currency: "USD", stock: 9, unit: "tyre" },
  { name: "Continental EcoContact", sku: "CO-EC-185-65-15", brand: "Continental", category: "Passenger", size: "185/65R15", description: "Compact passenger tyre. Demonstration price.", selling_price: 102, currency: "USD", stock: 22, unit: "tyre" },
  { name: "Yokohama Geolandar", sku: "YK-GEO-265-70-16", brand: "Yokohama", category: "SUV / 4x4", size: "265/70R16", description: "Alternative all-terrain for Hilux and Ranger. Demonstration price.", selling_price: 180, currency: "USD", stock: 7, unit: "tyre" },
  { name: "BFGoodrich All-Terrain", sku: "BFG-AT-265-75-16", brand: "BFGoodrich", category: "SUV / 4x4", size: "265/75R16", description: "Heavier all-terrain. Demonstration price.", selling_price: 230, currency: "USD", stock: 6, unit: "tyre" },
  { name: "Michelin LTX", sku: "MI-LTX-245-70-16", brand: "Michelin", category: "SUV / 4x4", size: "245/70R16", description: "Highway terrain for Ranger and D-Max. Demonstration price.", selling_price: 240, currency: "USD", stock: 8, unit: "tyre" },
  { name: "Goodyear Wrangler", sku: "GY-WR-265-65-17", brand: "Goodyear", category: "SUV", size: "265/65R17", description: "SUV highway tyre. Demonstration price.", selling_price: 205, currency: "USD", stock: 10, unit: "tyre" },
  { name: "Pirelli Scorpion", sku: "PI-SC-235-55-18", brand: "Pirelli", category: "SUV", size: "235/55R18", description: "Premium SUV tyre. Demonstration price.", selling_price: 255, currency: "USD", stock: 5, unit: "tyre" },
  { name: "Hankook Dynapro", sku: "HK-DY-265-60-18", brand: "Hankook", category: "SUV", size: "265/60R18", description: "Fortuner-size all-terrain. Demonstration price.", selling_price: 198, currency: "USD", stock: 12, unit: "tyre" },
  { name: "Firestone Destination", sku: "FS-DEST-265-70-16", brand: "Firestone", category: "SUV / 4x4", size: "265/70R16", description: "Value all-terrain option. Demonstration price.", selling_price: 155, currency: "USD", stock: 15, unit: "tyre" },
  { name: "Apollo Apterra", sku: "AP-APT-265-65-17", brand: "Apollo", category: "SUV", size: "265/65R17", description: "Value SUV tyre. Demonstration price.", selling_price: 142, currency: "USD", stock: 13, unit: "tyre" },
  { name: "MRF Wanderer", sku: "MRF-WAN-245-75-16", brand: "MRF", category: "SUV / 4x4", size: "245/75R16", description: "Workhorse bakkie tyre. Demonstration price.", selling_price: 136, currency: "USD", stock: 19, unit: "tyre" },
  { name: "Triangle TR688", sku: "TR-688-315-80", brand: "Triangle", category: "Truck", size: "315/80R22.5", description: "Fleet truck alternative. Demonstration price.", selling_price: 365, currency: "USD", stock: 20, unit: "tyre" },
  { name: "Windforce Catchfors", sku: "WF-CF-12R22", brand: "Windforce", category: "Truck", size: "12R22.5", description: "Regional truck tyre. Demonstration price.", selling_price: 310, currency: "USD", stock: 17, unit: "tyre" },
  { name: "Double Coin RLB1", sku: "DC-RLB-315", brand: "Double Coin", category: "Truck", size: "315/80R22.5", description: "Drive-axle truck tyre. Demonstration price.", selling_price: 390, currency: "USD", stock: 9, unit: "tyre" },
  { name: "Van Commercial", sku: "VAN-195-15C", brand: "Rossi Commercial", category: "Van", size: "195R15C", description: "Light commercial van tyre. Demonstration price.", selling_price: 118, currency: "USD", stock: 24, unit: "tyre" },
  { name: "Maxxis Bravo", sku: "MX-BR-225-70-15", brand: "Maxxis", category: "Van", size: "225/70R15C", description: "Van and minibus tyre. Demonstration price.", selling_price: 132, currency: "USD", stock: 14, unit: "tyre" },
  { name: "Kumho Solus", sku: "KH-SOL-175-65-14", brand: "Kumho", category: "Passenger", size: "175/65R14", description: "Honda Fit size. Demonstration price.", selling_price: 78, currency: "USD", stock: 28, unit: "tyre" },
  { name: "Wheel alignment", sku: "SVC-ALIGN", brand: "Rossi Tyres", category: "Fitment", size: "Service", description: "Wheel alignment after a four-tyre fitment. Demonstration price.", selling_price: 25, currency: "USD", stock: 0, unit: "service" },
];

const PRODUCT_SKU: Record<string, string> = {
  "bs-dueler-265": "BS-DUELER-265-70-16",
  "dunlop-265": "DL-GT-265-65-17",
  "conti-225": "CO-CC-225-65-17",
  "truck-315": "TR-315-80-225",
  "pass-195": "PS-195-65-15",
  "ranger-245": "MI-LTX-245-70-16",
  "van-195": "VAN-195-15C",
};

function phone(index: number): string {
  return `+26377${String(2_400_000 + index * 137).slice(0, 7)}`;
}

function band(score: number): "hot" | "warm" | "cold" {
  if (score >= 75) return "hot";
  if (score >= 50) return "warm";
  return "cold";
}

function leadStatus(spec: Spec): LeadRow["status"] {
  if (spec.bucket === "lead") {
    if (spec.score >= 80) return "CONTACTED";
    if (spec.createdDays <= 1) return "NEW";
    if (spec.score >= 60) return "QUALIFIED";
    return "CONTACTED";
  }
  if (spec.bucket === "won") return "WON";
  if (spec.bucket === "lost") return "LOST";
  return "CONVERTED_TO_DEAL";
}

function threads(spec: Spec, ownerName: string): Array<{ direction: "customer" | "rep"; text: string; hours: number }> {
  if (spec.thread === "hilux") {
    return [
      { direction: "customer", text: "Hi, how much are 265/70R16 tyres for a Hilux?", hours: 200 },
      { direction: "rep", text: `Hi Tendai. Yes, we have options available. Are you looking for highway tyres or all-terrain?`, hours: 198 },
      { direction: "customer", text: "All-terrain. I need four.", hours: 190 },
      { direction: "rep", text: "Great. I’ll send you a quotation for four Bridgestone Dueler A/T tyres.", hours: 188 },
      { direction: "rep", text: "Quotation QT-1028 sent for four Bridgestone Dueler A/T tyres, $780.", hours: 48 },
    ];
  }
  if (spec.thread === "brian") {
    return [
      { direction: "customer", text: "Hi, do you have 245/70R16 available today?", hours: 3 },
      { direction: "rep", text: "Hi Brian, checking the Ranger size now. Is this for one tyre or a set?", hours: 2 },
    ];
  }
  if (spec.thread === "westgate") {
    return [
      { direction: "customer", text: "Please quote us for 24 truck tyres for our fleet. We need delivery before month-end.", hours: 400 },
      { direction: "rep", text: "Thanks. I’ll prepare a fleet proposal for 24 × 315/80R22.5 and confirm delivery.", hours: 390 },
      { direction: "rep", text: "Quotation QT-1031 is with your procurement team.", hours: 50 },
      { direction: "customer", text: "Procurement is still reviewing. Can you call our manager tomorrow morning?", hours: 30 },
    ];
  }
  if (spec.thread === "nyathi") {
    return [
      { direction: "customer", text: "How much for four 195/65R15 on a Honda Fit?", hours: 90 },
      { direction: "rep", text: "Hi Rudo, a set of passenger tyres in that size is $380 fitted. I can also show a lower-cost option.", hours: 86 },
      { direction: "customer", text: "That’s a bit high. What else do you have?", hours: 70 },
    ];
  }
  if (spec.thread === "short") {
    return [
      { direction: "customer", text: `Hi, I’m looking at ${spec.requirement}.`, hours: Math.max(5, spec.createdDays * 20) },
      { direction: "rep", text: `Thanks ${spec.name.split(" ")[0]}. ${ownerName.split(" ")[0]} here — I’ll confirm size and price.`, hours: Math.max(4, spec.createdDays * 20 - 2) },
    ];
  }
  return [];
}

export function buildRossiDataset(input: {
  now?: Date;
  clientId: string;
  actors: Record<DemoActorKey, DemoActor>;
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
  const followUps: DemoDataset["followUps"] = [];

  const products: DemoProduct[] = PRODUCTS.map((product) => ({
    ...product,
    id: demoId(`rossi:product:${product.sku}`),
    client_id: clientId,
  }));

  SPECS.forEach((spec, index) => {
    const owner = input.actors[spec.owner];
    const contactId = demoId(`rossi:contact:${spec.key}`);
    const leadId = demoId(`rossi:lead:${spec.key}`);
    const dealId = spec.bucket === "lead" ? null : demoId(`rossi:deal:${spec.key}`);
    const created = daysAgo(spec.createdDays, now);
    const createdIso = demoIso(created);
    const followAt =
      spec.follow === "today"
        ? demoToday(now)
        : spec.follow === "tomorrow"
          ? daysFromNow(1, now)
          : spec.follow === "overdue"
            ? daysAgo(1, now)
            : null;

    const contact: ContactRow = {
      id: contactId,
      client_id: clientId,
      name: spec.company ?? spec.name,
      phone: phone(index + 3),
      email: null,
      location: spec.location,
      source: spec.source,
      lead_origin: "client",
      lifecycle: spec.bucket === "won" ? "customer" : spec.bucket === "lead" ? "aware" : "pipeline",
      customer_type: spec.customerType ?? "individual",
      primary_contact_name: spec.company ? spec.name : null,
      industry: spec.company ? "Transport" : null,
      relationship_owner_id: owner.id,
      notes: spec.vehicle ? `Vehicle: ${spec.vehicle}` : null,
      tags: spec.company ? ["fleet"] : ["retail"],
      created_at: createdIso,
      updated_at: createdIso,
    };
    contacts.push(contact);

    const form: Record<string, unknown> = {
      vehicle: spec.vehicle ?? null,
      requirement: spec.requirement,
      channel: spec.source,
    };
    if (spec.company) form.company = spec.company;

    const lead: LeadRow = {
      id: leadId,
      client_id: clientId,
      assigned_to_id: owner.id,
      contact_id: contactId,
      source: spec.source as LeadSource,
      status: leadStatus(spec),
      form_data: form,
      name: spec.company ?? spec.name,
      phone: contact.phone,
      email: null,
      budget: spec.value != null ? `$${spec.value}` : null,
      project_type: spec.requirement,
      timeline: spec.key === "brian-ncube" ? "Today" : spec.key === "westgate" ? "Before month-end" : null,
      magic_token: null,
      magic_token_expires_at: null,
      not_qualified_reason: null,
      lost_reason: spec.lostReason ?? null,
      deal_value: spec.value ?? null,
      follow_up_date: followAt ? demoIso(followAt) : null,
      facebook_lead_id: null,
      created_at: spec.key === "brian-ncube" ? demoIso(hoursAgo(3, now)) : createdIso,
      updated_at: spec.key === "brian-ncube" ? demoIso(hoursAgo(2, now)) : createdIso,
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
    };
    leads.push(lead);

    if (dealId && spec.stage && spec.value != null) {
      const wonAt = spec.bucket === "won"
        ? spec.wonPrevious
          ? inPreviousMonth(12, now)
          : withinCurrentMonth(spec.wonDays ?? 3, now)
        : null;
      const lostAt = spec.bucket === "lost" ? daysAgo(Math.min(spec.createdDays, 12), now) : null;
      const lastTouch = spec.key === "tendai-moyo" ? daysAgo(2, now) : followAt ?? daysAgo(Math.min(spec.createdDays, 3), now);
      const deal: DealRow = {
        id: dealId,
        client_id: clientId,
        contact_id: contactId,
        originating_lead_id: leadId,
        owner_id: owner.id,
        name: spec.company ? `${spec.company} — ${spec.requirement}` : `${spec.name} — ${spec.requirement}`,
        service_summary: spec.requirement,
        stage: spec.stage,
        value_status: "KNOWN",
        value_basis: spec.bucket === "won" ? "WON_VALUE" : spec.quote ? "LATEST_QUOTE" : "SALES_ESTIMATE",
        estimated_value: spec.value,
        estimated_value_min: null,
        estimated_value_max: null,
        customer_budget: spec.value,
        sales_estimate: spec.value,
        expected_decision_at: null,
        location: spec.location,
        buying_timeframe: spec.key === "westgate" ? "Before month-end" : spec.key === "brian-ncube" ? "Today" : null,
        decision_maker_status: spec.company ? "NO" : "YES",
        decision_maker_name: spec.company ? "Procurement" : spec.name,
        next_action_at: followAt ? demoIso(followAt) : null,
        next_action_label: spec.key === "tendai-moyo"
          ? "Follow up on quotation"
          : spec.key === "westgate"
            ? "Call procurement manager"
            : spec.key === "rudo-nyathi"
              ? "Recommend a lower-cost tyre"
              : spec.follow
                ? "Follow up"
                : null,
        won_value: spec.bucket === "won" ? spec.value : null,
        won_at: wonAt ? demoIso(wonAt) : null,
        lost_at: lostAt ? demoIso(lostAt) : null,
        lost_reason: spec.lostReason ?? null,
        last_meaningful_activity_at: demoIso(lastTouch),
        metadata: { vehicle: spec.vehicle ?? null, demo: true },
        created_at: createdIso,
        updated_at: demoIso(lastTouch),
      };
      deals.push(deal);

      activities.push(
        { id: demoId(`rossi:act:${spec.key}:in`), leadId, dealId, actorKey: spec.owner, title: "Enquiry received", detail: spec.requirement, kind: "lead", at: createdIso },
        { id: demoId(`rossi:act:${spec.key}:q`), leadId, dealId, actorKey: spec.owner, title: "Lead qualified", detail: spec.vehicle ?? spec.name, kind: "deal", at: demoIso(daysAgo(Math.max(0, spec.createdDays - 1), now)) }
      );
    } else {
      activities.push({
        id: demoId(`rossi:act:${spec.key}:in`),
        leadId,
        dealId: null,
        actorKey: spec.owner,
        title: spec.key === "brian-ncube" ? "New WhatsApp enquiry" : "Enquiry received",
        detail: spec.requirement,
        kind: "lead",
        at: lead.created_at,
      });
    }

    if (spec.quote && dealId) {
      const quoteId = demoId(`rossi:quote:${spec.quote.number}`);
      const sent = spec.quote.sentDays != null ? daysAgo(spec.quote.sentDays, now) : null;
      const total = Math.round((spec.qty ?? 1) * (spec.unitPrice ?? spec.value ?? 0));
      const quote: QuotationRow = {
        id: quoteId,
        client_id: clientId,
        lead_id: leadId,
        deal_id: dealId,
        quote_number: spec.quote.number,
        status: spec.quote.status,
        customer_name: spec.company ?? spec.name,
        customer_phone: contact.phone,
        customer_email: null,
        subtotal: total,
        tax_rate: 0,
        tax_amount: 0,
        other_amount: 0,
        total,
        currency: "USD",
        valid_until: demoIso(daysFromNow(14, now)),
        notes: "Demonstration quotation for the Rossi Tyres workspace. Prices are not official Rossi Tyres pricing.",
        terms: "Fitment in Harare. Demonstration terms only.",
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
      };
      quotations.push(quote);
      lineItems.push({
        id: demoId(`rossi:line:${spec.quote.number}`),
        quotation_id: quoteId,
        catalog_item_id: null,
        product_id: spec.productKey ? demoId(`rossi:product:${PRODUCT_SKU[spec.productKey] ?? PRODUCTS[0]!.sku}`) : null,
        item_name: spec.requirement,
        description: "Demonstration line. Not an official price list.",
        unit_price: spec.unitPrice ?? total,
        quantity: spec.qty ?? 1,
        amount: total,
        group_label: null,
        sort_order: 0,
        created_at: quote.created_at,
        unit: "tyre",
        source_type: "PRODUCT",
      });
      if (sent) {
        activities.push({
          id: demoId(`rossi:act:${spec.key}:quote`),
          leadId,
          dealId,
          actorKey: spec.owner,
          title: `${owner.name.split(" ")[0]} sent quotation ${spec.quote.number}`,
          detail: `$${total}`,
          kind: "quote",
          at: demoIso(sent),
        });
      }
    }

    if (followAt && !spec.quote?.status) {
      followUps.push({
        id: demoId(`rossi:fu:${spec.key}`),
        leadId,
        dealId,
        ownerKey: spec.owner,
        label: spec.requirement,
        dueAt: demoIso(followAt),
        completed: false,
      });
    } else if (followAt) {
      followUps.push({
        id: demoId(`rossi:fu:${spec.key}`),
        leadId,
        dealId,
        ownerKey: spec.owner,
        label: spec.key === "westgate" ? "Call procurement manager" : spec.key === "rudo-nyathi" ? "Recommend alternative tyre" : "Follow up",
        dueAt: demoIso(followAt),
        completed: false,
      });
    }

    for (const line of threads(spec, owner.name)) {
      messages.push({
        id: demoId(`rossi:msg:${spec.key}:${line.hours}:${line.direction}`),
        leadId,
        direction: line.direction,
        text: line.text,
        at: demoIso(hoursAgo(line.hours, now)),
        actorKey: line.direction === "rep" ? spec.owner : null,
        kind: line.text.startsWith("Quotation") ? "system" : "message",
      });
    }
  });

  notifications.push(
    { id: demoId("rossi:n:1"), userKey: "tinashe", type: "FOLLOW_UP_DUE", message: "Follow-up due with Tendai Moyo", read: false, leadId: demoId("rossi:lead:tendai-moyo"), quotationId: demoId("rossi:quote:QT-1028"), at: demoIso(hoursAgo(1, now)) },
    { id: demoId("rossi:n:2"), userKey: "tinashe", type: "NEW_LEAD", message: "Brian Ncube sent a new enquiry", read: false, leadId: demoId("rossi:lead:brian-ncube"), quotationId: null, at: demoIso(hoursAgo(3, now)) },
    { id: demoId("rossi:n:3"), userKey: "tanaka", type: "QUOTATION_ALERT", message: "Westgate Logistics quotation has been open for 2 days", read: false, leadId: demoId("rossi:lead:westgate"), quotationId: demoId("rossi:quote:QT-1031"), at: demoIso(hoursAgo(5, now)) },
    { id: demoId("rossi:n:4"), userKey: "tendai", type: "QUOTATION_ALERT", message: "Rudo Chikore moved an opportunity to Negotiation", read: false, leadId: demoId("rossi:lead:hilux-ref"), quotationId: null, at: demoIso(hoursAgo(8, now)) },
    { id: demoId("rossi:n:5"), userKey: "tendai", type: "NEW_LEAD", message: "New Facebook enquiry captured", read: false, leadId: demoId("rossi:lead:chipo-dube"), quotationId: null, at: demoIso(hoursAgo(6, now)) },
    { id: demoId("rossi:n:6"), userKey: "rudo", type: "FOLLOW_UP_DUE", message: "Rudo Nyathi is waiting on a lower-cost option", read: false, leadId: demoId("rossi:lead:rudo-nyathi"), quotationId: demoId("rossi:quote:QT-1048"), at: demoIso(hoursAgo(2, now)) },
    { id: demoId("rossi:n:7"), userKey: "tanaka", type: "FOLLOW_UP_DUE", message: "Call Westgate Logistics procurement", read: false, leadId: demoId("rossi:lead:westgate"), quotationId: demoId("rossi:quote:QT-1031"), at: demoIso(demoToday(now)) },
    { id: demoId("rossi:n:8"), userKey: "tinashe", type: "WHATSAPP_MESSAGE", message: "Tendai Moyo has not replied for 2 days", read: false, leadId: demoId("rossi:lead:tendai-moyo"), quotationId: demoId("rossi:quote:QT-1028"), at: demoIso(hoursAgo(4, now)) },
    { id: demoId("rossi:n:9"), userKey: "tendai", type: "DEAL_WON", message: "Tinashe Moyo won a Hilux fitment", read: true, leadId: demoId("rossi:lead:won-t1"), quotationId: null, at: demoIso(daysAgo(2, now)) },
    { id: demoId("rossi:n:10"), userKey: "rudo", type: "NEW_LEAD", message: "Yeukai Chirwa asked about D-Max tyres", read: false, leadId: demoId("rossi:lead:yeukai-chirwa"), quotationId: null, at: demoIso(hoursAgo(7, now)) }
  );

  activities.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  return {
    version: 1,
    industry: "tyres",
    scenario: "rossi",
    clientId,
    organisationName: ROSSI_WORKSPACE.name,
    timezone: ROSSI_WORKSPACE.timezone,
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
