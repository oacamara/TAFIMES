import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date, fmt = 'dd/MM/yyyy') {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, fmt, { locale: fr })
}

export function formatDateTime(date: string | Date) {
  return formatDate(date, 'dd/MM/yyyy HH:mm')
}

export function formatNumber(value: number, decimals = 2) {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function formatPercent(value: number) {
  return `${formatNumber(value, 1)}%`
}

export function calcYield(produced: number, rawUsed: number): number {
  if (rawUsed === 0) return 0
  return (produced / rawUsed) * 100
}

export function generateOrderNumber(date: Date, seq: number): string {
  const d = format(date, 'yyyyMMdd')
  return `OP-${d}-${String(seq).padStart(3, '0')}`
}

export function generateLotNumber(date: Date, seq: number): string {
  const d = format(date, 'yyyyMMdd')
  return `LPF-${d}-${String(seq).padStart(3, '0')}`
}
