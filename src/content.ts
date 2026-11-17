// The demo page's copy, as segments. Each segment is translated as a unit and
// rendered with data-seg so the English and translated layouts can be aligned
// block by block.
export type Segment = { id: string; en: string }

export const SEGMENTS: Segment[] = [
  { id: "brand", en: "Harbourside Paddle Co." },
  { id: "nav.tours", en: "Tours" },
  { id: "nav.gear", en: "Gear" },
  { id: "nav.contact", en: "Contact" },
  { id: "hero.eyebrow", en: "Dawn tour · 2 hours" },
  { id: "hero.title", en: "Paddle the harbour at first light" },
  {
    id: "hero.p1",
    en: "Meet at the boat shed at 5:45 am. We supply the kayak, paddle and life jacket; you bring warm layers and a water bottle.",
  },
  {
    id: "hero.p2",
    en: "The tour takes about two hours and suits beginners. If the wind picks up past 20 knots, we move the trip to the next calm morning.",
  },
  { id: "hero.cta", en: "Book a spot" },
  { id: "hero.note", en: "Gear included · Beginners welcome" },
  { id: "bring.title", en: "What to bring" },
  { id: "bring.1", en: "Warm layers you don't mind getting wet" },
  { id: "bring.2", en: "A water bottle and a small snack" },
  { id: "bring.3", en: "Sunglasses with a strap" },
  { id: "bring.4", en: "A dry bag for your phone (we have spares)" },
  { id: "route.title", en: "The route" },
  {
    id: "route.p",
    en: "We launch from the beach beside the boat shed, follow the sea wall past the old ferry terminal, then cross to the lighthouse for sunrise. On the way back we stop at a sheltered cove for hot chocolate.",
  },
  { id: "faq.title", en: "Questions" },
  { id: "faq.q1", en: "Do I need experience?" },
  {
    id: "faq.a1",
    en: "No. Every tour starts with a fifteen-minute lesson on land, and a guide stays with the group the whole time.",
  },
  { id: "faq.q2", en: "What if it rains?" },
  {
    id: "faq.a2",
    en: "Light rain is part of the fun. We only cancel for strong wind or lightning, and you can rebook or get a full refund.",
  },
  { id: "faq.q3", en: "Can children come?" },
  { id: "faq.a3", en: "Yes, from age ten, sharing a double kayak with an adult." },
  { id: "footer", en: "Harbourside Paddle Co. · Boat shed 3, Harbour Road" },
]

export type Translations = Record<string, string>

export const ENGLISH: Translations = Object.fromEntries(SEGMENTS.map((s) => [s.id, s.en]))
