/**
 * Niche wording dictionary — one place to swap "Students/Batches/Coach" for
 * "Members/Plans/Trainer" (gym) or "Learners/Groups/Tutor" (tuition).
 * Driven entirely by tenants.niche.
 */

export type NicheKey = "academy" | "gym" | "tuition";

export type NicheWords = {
  label: string;
  student: string; // singular
  students: string; // plural
  batch: string;
  batches: string;
  coach: string;
  coaches: string;
  register_cta: string;
  hero_default_headline: string;
  about_default_heading: string;
  about_default_body: string;
};

const dict: Record<NicheKey, NicheWords> = {
  academy: {
    label: "Sports academy",
    student: "Student",
    students: "Students",
    batch: "Batch",
    batches: "Batches",
    coach: "Coach",
    coaches: "Coaches",
    register_cta: "Register your child",
    hero_default_headline: "Train with the best. Play with confidence.",
    about_default_heading: "About us",
    about_default_body:
      "We build cricketers of character — technique, temperament and match awareness — with certified coaches and small batches.",
  },
  gym: {
    label: "Gym",
    student: "Member",
    students: "Members",
    batch: "Plan",
    batches: "Plans",
    coach: "Trainer",
    coaches: "Trainers",
    register_cta: "Join the gym",
    hero_default_headline: "Stronger every day. Together.",
    about_default_heading: "About the gym",
    about_default_body:
      "Modern equipment, certified trainers, and a community that shows up. Build strength, endurance and habits that last.",
  },
  tuition: {
    label: "Coaching centre",
    student: "Learner",
    students: "Learners",
    batch: "Group",
    batches: "Groups",
    coach: "Tutor",
    coaches: "Tutors",
    register_cta: "Enrol now",
    hero_default_headline: "Focused coaching. Real results.",
    about_default_heading: "About us",
    about_default_body:
      "Small groups, personal attention, structured curriculum. We help learners understand — not just memorise.",
  },
};

export function niche(key: string | null | undefined): NicheWords {
  const k = (key ?? "academy") as NicheKey;
  return dict[k] ?? dict.academy;
}

export const nicheOptions: { value: NicheKey; label: string }[] = [
  { value: "academy", label: "Sports academy" },
  { value: "gym", label: "Gym / fitness" },
  { value: "tuition", label: "Coaching centre" },
];
