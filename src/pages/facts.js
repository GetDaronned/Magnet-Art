// Banque de « Le savais-tu ? » de l'accueil, parcourue dans un ordre tiré au hasard.
export const FACTS = [
  'Chaque électron se comporte comme un minuscule aimant : c’est son spin.',
  'Chauffé au-dessus de 770 °C, le fer n’est plus aimanté : c’est sa température de Curie.',
  'Le champ de la Terre, environ 0,05 mT, suffit à orienter l’aiguille d’une boussole.',
  'Coupe un aimant en deux : tu n’isoles pas le nord du sud, tu obtiens deux aimants, chacun avec son nord et son sud.',
  'Une IRM utilise un champ de 1,5 à 3 teslas, soit 30 000 à 60 000 fois le champ de la Terre.',
  'Le pôle Nord géographique attire le nord des boussoles : magnétiquement, c’est donc un pôle sud.',
  'Le pôle nord magnétique de la Terre se déplace : de plusieurs dizaines de kilomètres par an ces dernières décennies.',
  'Des oiseaux migrateurs, des tortues marines et même certaines bactéries s’orientent grâce au champ magnétique de la Terre.',
  'Dans un disque dur, la tête vole à quelques nanomètres du plateau : moins que la taille d’un virus.',
  'Les aurores polaires naissent quand des particules venues du Soleil, guidées par le champ de la Terre, heurtent la haute atmosphère.',
  'Le mot « magnétisme » vient de Magnésie, une région de l’Antiquité où l’on trouvait des pierres qui attiraient le fer.',
  'Les aimants les plus puissants du commerce, en néodyme-fer-bore, font tourner les moteurs des voitures électriques et des éoliennes.',
  'Un skyrmion magnétique peut ne mesurer que quelques nanomètres : on étudie son usage pour stocker des données.',
]

// Tous les faits, dans un ordre aléatoire.
export function shuffledFacts() {
  const copy = [...FACTS]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
