// Petites données conservées d'une visite à l'autre (comme dans Aimantarium) :
// la dernière lettre écrite et le tutoriel du disque terminé ou non.
const get = (k, d) => {
  try {
    const v = localStorage.getItem(k)
    return v === null ? d : JSON.parse(v)
  } catch {
    return d
  }
}
const set = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    // stockage indisponible : rien n'est gardé
  }
}

export const diskComplete = () => get('magnetart-disk-complete', false)
export const markDiskComplete = () => set('magnetart-disk-complete', true)
export const diskLetter = () => get('magnetart-disk-letter', '')
export const saveDiskLetter = (letter) => set('magnetart-disk-letter', letter)
