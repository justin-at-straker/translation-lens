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

/** Built-in French (Canada), neutral tone, so the lens works before a key is added. */
export const BUILT_IN_FR_CA: Translations = {
  brand: "Harbourside Paddle Co.",
  "nav.tours": "Sorties",
  "nav.gear": "Équipement",
  "nav.contact": "Nous joindre",
  "hero.eyebrow": "Sortie à l’aube · 2 heures",
  "hero.title": "Pagayez dans le port au lever du jour",
  "hero.p1":
    "Rendez-vous au hangar à bateaux à 5 h 45. Nous fournissons le kayak, la pagaie et le gilet de sauvetage; apportez des vêtements chauds et une bouteille d’eau.",
  "hero.p2":
    "La sortie dure environ deux heures et convient aux débutants. Si le vent dépasse 20 nœuds, nous la reportons au prochain matin calme.",
  "hero.cta": "Réserver une place",
  "hero.note": "Équipement fourni · Débutants bienvenus",
  "bring.title": "Quoi apporter",
  "bring.1": "Des vêtements chauds qui peuvent être mouillés",
  "bring.2": "Une bouteille d’eau et une petite collation",
  "bring.3": "Des lunettes de soleil avec cordon",
  "bring.4": "Un sac étanche pour votre téléphone (nous en prêtons)",
  "route.title": "L’itinéraire",
  "route.p":
    "Nous partons de la plage à côté du hangar à bateaux, longeons la digue devant l’ancien terminal de traversier, puis traversons jusqu’au phare pour le lever du soleil. Au retour, nous faisons une halte dans une anse abritée pour un chocolat chaud.",
  "faq.title": "Questions",
  "faq.q1": "Faut-il avoir de l’expérience?",
  "faq.a1":
    "Non. Chaque sortie commence par une leçon de quinze minutes sur la terre ferme, et un guide accompagne le groupe en tout temps.",
  "faq.q2": "Et s’il pleut?",
  "faq.a2":
    "Une petite pluie fait partie du plaisir. Nous annulons seulement en cas de vents forts ou d’orages, et vous pouvez choisir une autre date ou obtenir un remboursement complet.",
  "faq.q3": "Les enfants peuvent-ils venir?",
  "faq.a3": "Oui, à partir de 10 ans, dans un kayak double avec un adulte.",
  footer: "Harbourside Paddle Co. · Hangar 3, chemin Harbour",
}
