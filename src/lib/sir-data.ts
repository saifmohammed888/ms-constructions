export type SirNoticeReason = "logical_discrepancy" | "no_mapping" | "asddo" | "other";
export type SirNoticeStatus =
  | "notice_expected"
  | "notice_received"
  | "hearing_scheduled"
  | "documents_submitted"
  | "resolved"
  | "appeal_filed";

export const SIR_NOTICE_REASONS: Record<SirNoticeReason, string> = {
  logical_discrepancy: "Logical discrepancy in enumeration form",
  no_mapping: "Could not map to 2002 electoral roll",
  asddo: "ASDDO category (Absent / Shifted / Dead / Duplicate / Other)",
  other: "Other",
};

export const SIR_NOTICE_STATUSES: Record<SirNoticeStatus, string> = {
  notice_expected: "Notice expected",
  notice_received: "Notice received",
  hearing_scheduled: "Hearing scheduled",
  documents_submitted: "Documents submitted",
  resolved: "Resolved / name retained",
  appeal_filed: "Appeal filed",
};

export type SirDeadline = {
  id: string;
  label: string;
  date: string;
  description: string;
  urgent?: boolean;
};

export const SIR_DEADLINES: SirDeadline[] = [
  {
    id: "draft-roll",
    label: "Draft electoral roll published",
    date: "2026-08-24",
    description: "First draft roll released after house-to-house enumeration (30 Jun – 17 Aug 2026).",
  },
  {
    id: "claims-objections",
    label: "Claims & objections window closes",
    date: "2026-09-23",
    description: "Last day to file Form 6 (inclusion), Form 7 (deletion), or Form 8 (corrections).",
    urgent: true,
  },
  {
    id: "notice-hearings",
    label: "Notice delivery & hearings end",
    date: "2026-10-22",
    description: "BLOs deliver discrepancy notices; ERO inquiries and hearings continue through this date.",
    urgent: true,
  },
  {
    id: "final-roll",
    label: "Final electoral roll published",
    date: "2026-10-27",
    description: "Qualifying date: 1 Oct 2026. Names retained after verification appear on the final roll.",
  },
];

export type SirStateStats = {
  totalElectorsJun2026: number;
  draftRollElectors: number;
  asddoTotal: number;
  asddoBreakdown: { label: string; count: number }[];
  noticesTotal: number;
  noticesLogicalDiscrepancy: number;
  noticesNoMapping: number;
  maleElectors: number;
  femaleElectors: number;
  thirdGenderElectors: number;
  pollingStations: number;
};

export const SIR_STATE_STATS: SirStateStats = {
  totalElectorsJun2026: 55_432_314,
  draftRollElectors: 44_635_975,
  asddoTotal: 10_796_339,
  asddoBreakdown: [
    { label: "Absent", count: 1_517_042 },
    { label: "Permanently shifted", count: 6_545_679 },
    { label: "Dead", count: 1_639_864 },
    { label: "Duplicate / already enrolled", count: 709_870 },
    { label: "Other", count: 383_884 },
  ],
  noticesTotal: 4_381_335,
  noticesLogicalDiscrepancy: 2_035_835,
  noticesNoMapping: 2_345_500,
  maleElectors: 22_159_240,
  femaleElectors: 22_473_864,
  thirdGenderElectors: 2_871,
  pollingStations: 60_923,
};

export type SirDistrict = {
  id: string;
  name: string;
  notices: number;
  region: "Bengaluru" | "Coastal" | "Malnad" | "North Karnataka" | "Central Karnataka" | "South Karnataka";
};

export const SIR_DISTRICTS: SirDistrict[] = [
  { id: "bengaluru-urban", name: "Bengaluru Urban", notices: 946_037, region: "Bengaluru" },
  { id: "bbmp-north", name: "BBMP North", notices: 613_004, region: "Bengaluru" },
  { id: "bbmp-central", name: "BBMP Central", notices: 429_372, region: "Bengaluru" },
  { id: "bbmp-south", name: "BBMP South", notices: 417_631, region: "Bengaluru" },
  { id: "bengaluru-rural", name: "Bengaluru Rural", notices: 56_359, region: "Bengaluru" },
  { id: "mandya", name: "Mandya", notices: 150_269, region: "South Karnataka" },
  { id: "dakshina-kannada", name: "Dakshina Kannada", notices: 150_155, region: "Coastal" },
  { id: "kolar", name: "Kolar", notices: 142_197, region: "South Karnataka" },
  { id: "mysuru", name: "Mysuru", notices: 128_138, region: "South Karnataka" },
  { id: "tumakuru", name: "Tumakuru", notices: 111_887, region: "South Karnataka" },
  { id: "kalaburagi", name: "Kalaburagi", notices: 105_000, region: "North Karnataka" },
  { id: "chikkamagaluru", name: "Chikkamagaluru", notices: 85_000, region: "Malnad" },
  { id: "gadag", name: "Gadag", notices: 25_976, region: "North Karnataka" },
  { id: "davanagere", name: "Davanagere", notices: 7_088, region: "Central Karnataka" },
];

export type SirForm = {
  id: string;
  name: string;
  purpose: string;
  when: string;
};

export const SIR_FORMS: SirForm[] = [
  {
    id: "form-6",
    name: "Form 6",
    purpose: "Apply for inclusion if your name is missing from the draft roll.",
    when: "During claims window (till 23 Sep 2026) or after rejection.",
  },
  {
    id: "form-6a",
    name: "Form 6A",
    purpose: "Overseas electors seeking inclusion.",
    when: "During claims window.",
  },
  {
    id: "form-7",
    name: "Form 7",
    purpose: "Object to wrongful inclusion of another person's name.",
    when: "During claims window (till 23 Sep 2026).",
  },
  {
    id: "form-8",
    name: "Form 8",
    purpose: "Correct name, age, address, photo, EPIC, or disability details.",
    when: "During claims window or when responding to a discrepancy notice.",
  },
];

export const SIR_DOCUMENTS = [
  "Aadhaar card",
  "EPIC (Voter ID)",
  "Birth certificate",
  "Passport",
  "Educational records with date of birth",
  "Proof of residence (ration card, utility bill, rent agreement)",
  "Any document referenced in your SIR notice",
];

export const SIR_OFFICIAL_LINKS = [
  {
    label: "CEO Karnataka — Draft electoral rolls",
    url: "https://ceo.karnataka.gov.in/",
    note: "Check your name on the official draft roll (not third-party lists).",
  },
  {
    label: "ECI Voter Portal (NVSP)",
    url: "https://voters.eci.gov.in/",
    note: "File Forms 6, 7, and 8 online.",
  },
  {
    label: "ECINET mobile app",
    url: "https://play.google.com/store/apps/details?id=com.eci.citizen",
    note: "Track applications and voter services on Android.",
  },
];

export type TrackedNotice = {
  id: string;
  voterName: string;
  epicNumber: string;
  district: string;
  assemblyConstituency: string;
  boothNumber: string;
  reason: SirNoticeReason;
  status: SirNoticeStatus;
  noticeReceivedDate: string | null;
  hearingDate: string | null;
  documentsReady: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export const TRACKED_NOTICE_STORAGE_KEY = "karnataka-sir-notices-v1";

export function loadTrackedNotices(): TrackedNotice[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TRACKED_NOTICE_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TrackedNotice[];
  } catch {
    return [];
  }
}

export function saveTrackedNotices(notices: TrackedNotice[]) {
  localStorage.setItem(TRACKED_NOTICE_STORAGE_KEY, JSON.stringify(notices));
}

export function formatIndianNumber(n: number): string {
  return new Intl.NumberFormat("en-IN").format(n);
}

export function daysUntil(dateStr: string, from = new Date()): number {
  const target = new Date(`${dateStr}T23:59:59+05:30`);
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

export function deadlineStatus(dateStr: string, from = new Date()): "past" | "urgent" | "upcoming" {
  const days = daysUntil(dateStr, from);
  if (days < 0) return "past";
  if (days <= 14) return "urgent";
  return "upcoming";
}
