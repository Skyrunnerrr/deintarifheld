// Restored after APFS sparse-file corruption
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Kombiniert Tailwind-Klassen sicher mit clsx + tailwind-merge
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/**
 * Formatiert eine Zahl als Euro-Betrag
 */
export function formatEuro(amount) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Formatiert eine Zahl mit Tausendertrennzeichen
 */
export function formatNumber(number) {
  return new Intl.NumberFormat('de-DE').format(number)
}

/**
 * Berechnet die jährliche Ersparnis basierend auf kWh-Preis und Verbrauch
 */
export function calculateSavings({ currentPrice, consumption, targetPrice = 0.30 }) {
  const currentCost = (currentPrice / 100) * consumption
  const targetCost  = targetPrice * consumption
  const savings     = currentCost - targetCost
  return {
    currentCost: Math.round(currentCost),
    targetCost:  Math.round(targetCost),
    savings:     Math.max(0, Math.round(savings)),
    percentage:  Math.round((savings / currentCost) * 100),
  }
}

/**
 * Verzögerungsfunktion für Animationen
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
