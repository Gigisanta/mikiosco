export function productInitials(name) {
  return String(name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export function categoryTone(category) {
  const hash = [...String(category || 'General')].reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  )
  return `tone-${hash % 5}`
}
