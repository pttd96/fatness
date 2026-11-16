import { useState, useRef, useEffect, useMemo } from 'react'
import { Check, ChevronDown, Dumbbell, Search, X } from 'lucide-react'
import type { Exercise } from '../types'

interface ExerciseComboboxProps {
  exercises: Exercise[]
  selectedExerciseId?: string
  selectedExerciseName?: string
  onSelect: (exercise: Exercise) => void
  placeholder?: string
  className?: string
  inputClassName?: string
  disabled?: boolean
  autoFocus?: boolean
  id?: string
}

function getMuscleGroupBadge(mg: string): string {
  switch (mg.toLowerCase()) {
    case 'chest':
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
    case 'back':
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
    case 'legs':
      return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800'
    case 'shoulders':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
    case 'arms':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
    case 'core':
      return 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
  }
}

export function ExerciseCombobox({
  exercises,
  selectedExerciseId,
  selectedExerciseName,
  onSelect,
  placeholder = 'Search movement (e.g. Bench Press)...',
  className = '',
  inputClassName = '',
  disabled = false,
  autoFocus = false,
  id,
}: ExerciseComboboxProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selectedExercise = useMemo(() => {
    return exercises.find((e) => e.id === selectedExerciseId) || null
  }, [exercises, selectedExerciseId])

  const effectiveExerciseName = selectedExercise?.name || selectedExerciseName || ''

  // Filter exercises based on query (name or muscle group)
  const filteredExercises = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) {
      return exercises
    }
    return exercises.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.muscle_group.toLowerCase().includes(q)
    )
  }, [exercises, searchQuery])

  // Reset highlightedIndex when filtered options change
  useEffect(() => {
    setHighlightedIndex(0)
  }, [filteredExercises.length])

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const items = listRef.current.querySelectorAll('li')
      if (items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({ block: 'nearest' })
      }
    }
  }, [highlightedIndex, isOpen])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setIsTyping(false)
        setSearchQuery('')
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const handleSelect = (exercise: Exercise) => {
    onSelect(exercise)
    setSearchQuery('')
    setIsTyping(false)
    setIsOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault()
        setIsOpen(true)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((prev) =>
          prev < filteredExercises.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredExercises.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (filteredExercises.length > 0 && filteredExercises[highlightedIndex]) {
          handleSelect(filteredExercises[highlightedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        setIsTyping(false)
        setSearchQuery('')
        break
      case 'Tab':
        setIsOpen(false)
        setIsTyping(false)
        setSearchQuery('')
        break
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSearchQuery('')
    setIsTyping(true)
    setIsOpen(true)
    inputRef.current?.focus()
  }

  // Display value for input
  const displayValue = isTyping
    ? searchQuery
    : effectiveExerciseName

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative flex items-center">
        <Search className="absolute left-3 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />

        <input
          id={id}
          ref={inputRef}
          type="text"
          disabled={disabled}
          autoFocus={autoFocus}
          value={displayValue}
          placeholder={placeholder}
          onFocus={() => {
            setIsOpen(true)
          }}
          onChange={(e) => {
            setIsTyping(true)
            setSearchQuery(e.target.value)
            setIsOpen(true)
          }}
          onKeyDown={handleKeyDown}
          className={`w-full pl-9 pr-14 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-sm font-semibold focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all shadow-2xs ${
            disabled ? 'opacity-60 cursor-not-allowed' : ''
          } ${inputClassName}`}
        />

        <div className="absolute right-2 flex items-center gap-1 text-slate-400 dark:text-slate-500">
          {(searchQuery || selectedExercise) && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              title="Clear input"
              className="p-1 hover:text-slate-600 dark:hover:text-slate-300 rounded-md transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (!isOpen) {
                inputRef.current?.focus()
                setIsOpen(true)
              } else {
                setIsOpen(false)
              }
            }}
            className="p-1 hover:text-slate-600 dark:hover:text-slate-300 rounded-md transition-colors"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-150 ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Recommendations Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 z-50 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 max-h-64 flex flex-col">
          <ul
            ref={listRef}
            className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 py-1"
          >
            {filteredExercises.length === 0 ? (
              <li className="px-4 py-6 text-center text-xs text-slate-500 dark:text-slate-400 font-medium">
                <Dumbbell className="w-5 h-5 mx-auto mb-1.5 text-slate-300 dark:text-slate-600 stroke-[1.5]" />
                No exercises found matching{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  "{searchQuery}"
                </span>
              </li>
            ) : (
              filteredExercises.map((exercise, index) => {
                const isSelected = selectedExerciseId === exercise.id
                const isHighlighted = highlightedIndex === index

                return (
                  <li
                    key={exercise.id}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => handleSelect(exercise)}
                    className={`px-3.5 py-2.5 cursor-pointer flex items-center justify-between gap-3 text-xs transition-colors ${
                      isHighlighted
                        ? 'bg-slate-100 dark:bg-slate-800/90 text-slate-900 dark:text-white'
                        : 'text-slate-700 dark:text-slate-300'
                    } ${
                      isSelected
                        ? 'font-bold bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate">{exercise.name}</span>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getMuscleGroupBadge(
                          exercise.muscle_group
                        )}`}
                      >
                        {exercise.muscle_group}
                      </span>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      )}
                    </div>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
