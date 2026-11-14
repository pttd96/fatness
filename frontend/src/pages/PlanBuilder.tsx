import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calendar,
  Check,
  Dumbbell,
  Plus,
  Trash2,
  Wand2,
  Layers,
} from 'lucide-react'
import { api } from '../lib/api'
import { MOCK_EXERCISES } from '../lib/mockData'
import type { CreatePlannedExerciseInput, Exercise, SplitType } from '../types'

interface BuilderDay {
  dayIndex: number
  dayLabel: string
  exercises: {
    tempId: string
    exerciseId: string
    exerciseName: string
    muscleGroup?: string
    targetSets: number
    targetReps: string
    targetWeightKg: number
    coachingNotes: string
  }[]
}

const SPLIT_TEMPLATES: Record<SplitType, BuilderDay[]> = {
  push_pull_legs: [
    {
      dayIndex: 1,
      dayLabel: 'Push Day (Chest / Shoulders / Triceps)',
      exercises: [
        { tempId: '1-1', exerciseId: 'e1', exerciseName: 'Bench Press', muscleGroup: 'chest', targetSets: 4, targetReps: '8-10', targetWeightKg: 80, coachingNotes: 'RPE 8' },
        { tempId: '1-2', exerciseId: 'e3', exerciseName: 'Overhead Press', muscleGroup: 'shoulders', targetSets: 3, targetReps: '8', targetWeightKg: 50, coachingNotes: 'Strict press' },
        { tempId: '1-3', exerciseId: 'e4', exerciseName: 'Lateral Raise', muscleGroup: 'shoulders', targetSets: 4, targetReps: '12-15', targetWeightKg: 12, coachingNotes: 'Lead with elbows' },
        { tempId: '1-4', exerciseId: 'e9', exerciseName: 'Tricep Pushdown', muscleGroup: 'arms', targetSets: 3, targetReps: '12', targetWeightKg: 30, coachingNotes: 'Full lockout' },
      ],
    },
    {
      dayIndex: 2,
      dayLabel: 'Pull Day (Back / Biceps)',
      exercises: [
        { tempId: '2-1', exerciseId: 'e8', exerciseName: 'Pull-Ups', muscleGroup: 'back', targetSets: 4, targetReps: '8-10', targetWeightKg: 0, coachingNotes: 'Chest to bar' },
        { tempId: '2-2', exerciseId: 'e7', exerciseName: 'Barbell Row', muscleGroup: 'back', targetSets: 4, targetReps: '8-10', targetWeightKg: 70, coachingNotes: 'Pull to sternum' },
        { tempId: '2-3', exerciseId: 'e10', exerciseName: 'Barbell Curl', muscleGroup: 'arms', targetSets: 3, targetReps: '10-12', targetWeightKg: 35, coachingNotes: 'No hip swing' },
      ],
    },
    {
      dayIndex: 3,
      dayLabel: 'Leg Day (Quads / Hamstrings / Calves)',
      exercises: [
        { tempId: '3-1', exerciseId: 'e5', exerciseName: 'Squat', muscleGroup: 'legs', targetSets: 4, targetReps: '6-8', targetWeightKg: 110, coachingNotes: 'Deep knee bend' },
        { tempId: '3-2', exerciseId: 'e6', exerciseName: 'Romanian Deadlift', muscleGroup: 'legs', targetSets: 4, targetReps: '8-10', targetWeightKg: 90, coachingNotes: 'Hamstring stretch' },
      ],
    },
  ],
  upper_lower: [
    {
      dayIndex: 1,
      dayLabel: 'Upper Body A',
      exercises: [
        { tempId: 'u1-1', exerciseId: 'e1', exerciseName: 'Bench Press', muscleGroup: 'chest', targetSets: 4, targetReps: '6-8', targetWeightKg: 85, coachingNotes: 'Heavy focus' },
        { tempId: 'u1-2', exerciseId: 'e7', exerciseName: 'Barbell Row', muscleGroup: 'back', targetSets: 4, targetReps: '8', targetWeightKg: 75, coachingNotes: 'Strict form' },
        { tempId: 'u1-3', exerciseId: 'e3', exerciseName: 'Overhead Press', muscleGroup: 'shoulders', targetSets: 3, targetReps: '8', targetWeightKg: 50, coachingNotes: 'Explosive drive' },
      ],
    },
    {
      dayIndex: 2,
      dayLabel: 'Lower Body A',
      exercises: [
        { tempId: 'l1-1', exerciseId: 'e5', exerciseName: 'Squat', muscleGroup: 'legs', targetSets: 4, targetReps: '6-8', targetWeightKg: 115, coachingNotes: 'Power out of the hole' },
        { tempId: 'l1-2', exerciseId: 'e6', exerciseName: 'Romanian Deadlift', muscleGroup: 'legs', targetSets: 3, targetReps: '8-10', targetWeightKg: 95, coachingNotes: 'Hinge back' },
      ],
    },
  ],
  bro_split: [
    {
      dayIndex: 1,
      dayLabel: 'Chest Day',
      exercises: [
        { tempId: 'b1-1', exerciseId: 'e1', exerciseName: 'Bench Press', muscleGroup: 'chest', targetSets: 4, targetReps: '8', targetWeightKg: 85, coachingNotes: 'Primary compound' },
        { tempId: 'b1-2', exerciseId: 'e2', exerciseName: 'Incline Bench Press', muscleGroup: 'chest', targetSets: 4, targetReps: '10', targetWeightKg: 30, coachingNotes: 'Upper chest squeeze' },
      ],
    },
    {
      dayIndex: 2,
      dayLabel: 'Back Day',
      exercises: [
        { tempId: 'b2-1', exerciseId: 'e8', exerciseName: 'Pull-Ups', muscleGroup: 'back', targetSets: 4, targetReps: '10', targetWeightKg: 0, coachingNotes: 'Wide grip' },
        { tempId: 'b2-2', exerciseId: 'e7', exerciseName: 'Barbell Row', muscleGroup: 'back', targetSets: 4, targetReps: '8-10', targetWeightKg: 75, coachingNotes: 'Thick back focus' },
      ],
    },
    {
      dayIndex: 3,
      dayLabel: 'Shoulder Day',
      exercises: [
        { tempId: 'b3-1', exerciseId: 'e3', exerciseName: 'Overhead Press', muscleGroup: 'shoulders', targetSets: 4, targetReps: '8', targetWeightKg: 52.5, coachingNotes: 'Lockout hard' },
        { tempId: 'b3-2', exerciseId: 'e4', exerciseName: 'Lateral Raise', muscleGroup: 'shoulders', targetSets: 5, targetReps: '15', targetWeightKg: 12, coachingNotes: 'Burnout sets' },
      ],
    },
    {
      dayIndex: 4,
      dayLabel: 'Leg Day',
      exercises: [
        { tempId: 'b4-1', exerciseId: 'e5', exerciseName: 'Squat', muscleGroup: 'legs', targetSets: 5, targetReps: '5', targetWeightKg: 120, coachingNotes: 'Strength work' },
        { tempId: 'b4-2', exerciseId: 'e6', exerciseName: 'Romanian Deadlift', muscleGroup: 'legs', targetSets: 4, targetReps: '10', targetWeightKg: 90, coachingNotes: 'Posterior chain' },
      ],
    },
    {
      dayIndex: 5,
      dayLabel: 'Arms Day',
      exercises: [
        { tempId: 'b5-1', exerciseId: 'e10', exerciseName: 'Barbell Curl', muscleGroup: 'arms', targetSets: 4, targetReps: '10', targetWeightKg: 35, coachingNotes: 'Peak contraction' },
        { tempId: 'b5-2', exerciseId: 'e9', exerciseName: 'Tricep Pushdown', muscleGroup: 'arms', targetSets: 4, targetReps: '12', targetWeightKg: 32.5, coachingNotes: 'Deep stretch' },
      ],
    },
  ],
  full_body: [
    {
      dayIndex: 1,
      dayLabel: 'Full Body Day 1',
      exercises: [
        { tempId: 'fb1-1', exerciseId: 'e5', exerciseName: 'Squat', muscleGroup: 'legs', targetSets: 3, targetReps: '6-8', targetWeightKg: 110, coachingNotes: 'Heavy legs' },
        { tempId: 'fb1-2', exerciseId: 'e1', exerciseName: 'Bench Press', muscleGroup: 'chest', targetSets: 3, targetReps: '8', targetWeightKg: 80, coachingNotes: 'Horizontal push' },
        { tempId: 'fb1-3', exerciseId: 'e7', exerciseName: 'Barbell Row', muscleGroup: 'back', targetSets: 3, targetReps: '8', targetWeightKg: 70, coachingNotes: 'Horizontal pull' },
      ],
    },
  ],
}

export function PlanBuilder() {
  const navigate = useNavigate()

  const [splitType, setSplitType] = useState<SplitType>('push_pull_legs')
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(d.setDate(diff))
    return monday.toISOString().split('T')[0]
  })

  const [days, setDays] = useState<BuilderDay[]>(SPLIT_TEMPLATES.push_pull_legs)
  const [exercisesList, setExercisesList] = useState<Exercise[]>(MOCK_EXERCISES)
  const [saving, setSaving] = useState(false)

  const cleanNormalize = (s: string): string => {
    if (!s) return ''
    return s
      .toLowerCase()
      .replace(/\([^)]*\)/g, '') // remove parenthetical expressions like (OHP), (RDL)
      .replace(/[^a-z0-9]/g, '') // remove special characters, spaces, punctuation
  }

  const cleanWithoutEquipment = (s: string): string => {
    if (!s) return ''
    return cleanNormalize(
      s.replace(/\b(barbell|dumbbell|cable|machine|smith)\b/gi, '')
    )
  }

  const findSmartMatch = (
    targetName: string,
    muscleGroup: string | undefined,
    catalog: Exercise[]
  ): Exercise | null => {
    if (!catalog || catalog.length === 0 || !targetName) return null
    const tLower = targetName.toLowerCase().trim()

    // 1. Raw exact name match (case-insensitive)
    const exact = catalog.find((c) => c.name.toLowerCase().trim() === tLower)
    if (exact) return exact

    const cleanTarget = cleanNormalize(targetName)
    if (!cleanTarget) return null

    // 2. Cleaned exact match (user logic: lower case, remove special characters, trim all spaces, plus strip parentheses)
    const cleanedExact = catalog.find((c) => cleanNormalize(c.name) === cleanTarget)
    if (cleanedExact) return cleanedExact

    // 3. Equipment-agnostic exact match (e.g. "Bench Press" vs "Barbell Bench Press")
    const targetNoEquip = cleanWithoutEquipment(targetName)
    if (targetNoEquip) {
      const equipExact = catalog.find((c) => {
        const itemNoEquip = cleanWithoutEquipment(c.name)
        if (!itemNoEquip) return false
        if (itemNoEquip === targetNoEquip) {
          return !muscleGroup || c.muscle_group === muscleGroup
        }
        return false
      })
      if (equipExact) return equipExact
    }

    // 4. Substring containment with muscle group priority
    const candidates = catalog.filter((item) => {
      const cleanItem = cleanNormalize(item.name)
      if (!cleanItem) return false
      return cleanItem.includes(cleanTarget) || cleanTarget.includes(cleanItem)
    })

    if (candidates.length > 0) {
      if (muscleGroup) {
        const sameMuscle = candidates.find((c) => c.muscle_group === muscleGroup)
        if (sameMuscle) return sameMuscle
      }
      return candidates[0]
    }

    // 5. Token overlap fallback with muscle group bonus
    const tWords = targetName
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !['barbell', 'dumbbell', 'cable', 'machine', 'smith'].includes(w))

    if (tWords.length > 0) {
      let best: Exercise | null = null
      let bestScore = -1

      for (const item of catalog) {
        const iWords = item.name
          .toLowerCase()
          .replace(/[^a-z0-9 ]/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length > 2)

        let matchCount = 0
        for (const tw of tWords) {
          if (iWords.includes(tw)) matchCount++
        }

        if (matchCount > 0) {
          let score = (matchCount / Math.max(tWords.length, iWords.length)) * 10
          if (muscleGroup && item.muscle_group === muscleGroup) {
            score += 5 // Strong bonus for matching muscle group
          }
          if (score > bestScore) {
            bestScore = score
            best = item
          }
        }
      }

      if (best && bestScore > 0) return best
    }

    return null
  }

  const mapTemplateDays = (templateDays: BuilderDay[], catalog: Exercise[]): BuilderDay[] => {
    if (!catalog || catalog.length === 0) return templateDays

    return templateDays.map((d) => {
      // Track exercise IDs already used in this day to avoid duplicate movements where possible
      const usedInDay = new Set<string>()

      return {
        ...d,
        exercises: d.exercises.map((ex) => {
          // 1. Try smart matching by exercise name & muscle group
          const matched = findSmartMatch(ex.exerciseName, ex.muscleGroup, catalog)
          if (matched) {
            usedInDay.add(matched.id)
            return {
              ...ex,
              exerciseId: matched.id,
              exerciseName: matched.name,
              muscleGroup: matched.muscle_group,
            }
          }

          // 2. Fallback: Randomly select an exercise matching the label
          // A. Filter by exercise muscleGroup label
          let candidates = ex.muscleGroup
            ? catalog.filter(
                (c) => c.muscle_group.toLowerCase() === ex.muscleGroup?.toLowerCase()
              )
            : []

          // B. If no candidates, infer matching muscle groups from dayLabel
          if (candidates.length === 0 && d.dayLabel) {
            const lowerDay = d.dayLabel.toLowerCase()
            candidates = catalog.filter((c) => {
              const mg = c.muscle_group.toLowerCase()
              if (lowerDay.includes(mg)) return true
              if (lowerDay.includes('push') && ['chest', 'shoulders', 'arms'].includes(mg)) return true
              if (lowerDay.includes('pull') && ['back', 'arms'].includes(mg)) return true
              if (lowerDay.includes('leg') && mg === 'legs') return true
              if (lowerDay.includes('upper') && ['chest', 'back', 'shoulders', 'arms'].includes(mg)) return true
              if (lowerDay.includes('lower') && mg === 'legs') return true
              return false
            })
          }

          // C. If still no candidates, fallback to entire catalog
          const pool = candidates.length > 0 ? candidates : catalog

          // D. Prioritize candidates not yet assigned to this day
          const unusedPool = pool.filter((c) => !usedInDay.has(c.id))
          const selectionPool = unusedPool.length > 0 ? unusedPool : pool

          // E. Pick randomly from the pool
          const randomIndex = Math.floor(Math.random() * selectionPool.length)
          const randomExercise = selectionPool[randomIndex]

          if (randomExercise) {
            usedInDay.add(randomExercise.id)
            return {
              ...ex,
              exerciseId: randomExercise.id,
              exerciseName: randomExercise.name,
              muscleGroup: randomExercise.muscle_group,
            }
          }

          return ex
        }),
      }
    })
  }

  useEffect(() => {
    async function loadCatalog() {
      try {
        let catalog: Exercise[] = []
        try {
          catalog = await api.exercises.list()
        } catch {
          catalog = MOCK_EXERCISES
        }

        if (catalog && catalog.length > 0) {
          setExercisesList(catalog)
          setDays((prev) => mapTemplateDays(prev, catalog))
        }
      } catch {
        // Fall back to MOCK_EXERCISES
      }
    }
    loadCatalog()
  }, [])

  const handleApplyTemplate = (type: SplitType) => {
    setSplitType(type)
    const template = SPLIT_TEMPLATES[type] || []
    setDays(mapTemplateDays(template, exercisesList))
  }

  const handleAddDay = () => {
    const nextIndex = days.length + 1
    setDays((prev) => [
      ...prev,
      {
        dayIndex: nextIndex,
        dayLabel: `Day ${nextIndex}`,
        exercises: [],
      },
    ])
  }

  const handleRemoveDay = (index: number) => {
    setDays((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((d, i) => ({ ...d, dayIndex: i + 1 }))
    )
  }

  const handleDayLabelChange = (dayIndex: number, newLabel: string) => {
    setDays((prev) =>
      prev.map((d) => (d.dayIndex === dayIndex ? { ...d, dayLabel: newLabel } : d))
    )
  }

  const handleAddExerciseToDay = (dayIndex: number) => {
    const defaultEx = exercisesList[0] || MOCK_EXERCISES[0]
    setDays((prev) =>
      prev.map((d) => {
        if (d.dayIndex !== dayIndex) return d
        return {
          ...d,
          exercises: [
            ...d.exercises,
            {
              tempId: `${dayIndex}-${Date.now()}`,
              exerciseId: defaultEx.id,
              exerciseName: defaultEx.name,
              targetSets: 3,
              targetReps: '8-10',
              targetWeightKg: 50,
              coachingNotes: '',
            },
          ],
        }
      })
    )
  }

  const handleRemoveExercise = (dayIndex: number, tempId: string) => {
    setDays((prev) =>
      prev.map((d) => {
        if (d.dayIndex !== dayIndex) return d
        return {
          ...d,
          exercises: d.exercises.filter((ex) => ex.tempId !== tempId),
        }
      })
    )
  }

  const handleUpdateExercise = (
    dayIndex: number,
    tempId: string,
    field: string,
    value: any
  ) => {
    setDays((prev) =>
      prev.map((d) => {
        if (d.dayIndex !== dayIndex) return d
        return {
          ...d,
          exercises: d.exercises.map((ex) => {
            if (ex.tempId !== tempId) return ex
            if (field === 'exerciseId') {
              const matched = exercisesList.find((e) => e.id === value)
              return {
                ...ex,
                exerciseId: value,
                exerciseName: matched ? matched.name : ex.exerciseName,
                muscleGroup: matched ? matched.muscle_group : ex.muscleGroup,
              }
            }
            return { ...ex, [field]: value }
          }),
        }
      })
    )
  }

  const handleSavePlan = async () => {
    try {
      setSaving(true)
      const formattedExercises: CreatePlannedExerciseInput[] = []

      days.forEach((day) => {
        day.exercises.forEach((ex, orderIdx) => {
          formattedExercises.push({
            exercise_id: ex.exerciseId,
            day_label: day.dayLabel,
            day_index: day.dayIndex,
            exercise_order: orderIdx + 1,
            target_sets: ex.targetSets,
            target_reps: ex.targetReps,
            target_weight_kg: ex.targetWeightKg,
            coaching_notes: ex.coachingNotes,
          })
        })
      })

      await api.plans.create({
        week_start: weekStart,
        split_type: splitType,
        exercises: formattedExercises,
      })

      navigate('/dashboard')
    } catch (err: any) {
      alert(`Error saving plan: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-24">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <Layers className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            Workout Plan Builder
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
            Build your personalized workout routine or customize a proven split template.
          </p>
        </div>

        <button
          onClick={handleSavePlan}
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition-all self-start sm:self-auto"
        >
          {saving ? (
            'Saving Plan...'
          ) : (
            <>
              <Check className="w-4 h-4 stroke-[3]" /> Save & Activate Plan
            </>
          )}
        </button>
      </div>

      {/* Plan Meta Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Week Starting Date (Monday)
          </label>
          <input
            type="date"
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-medium focus:border-emerald-500 focus:bg-white outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Load Split Template
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(['push_pull_legs', 'upper_lower', 'bro_split', 'full_body'] as SplitType[]).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => handleApplyTemplate(st)}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all truncate ${
                  splitType === st
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {st.replace(/_/g, ' ').toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Days & Exercises Builder */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> Training Days ({days.length})
          </h2>
          <button
            onClick={handleAddDay}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-emerald-700 dark:text-emerald-400 border border-slate-200 dark:border-slate-700 shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" /> Add Day
          </button>
        </div>

        {days.map((day, dayIndex) => (
          <div
            key={day.dayIndex}
            className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs"
          >
            {/* Day Header */}
            <div className="p-4 sm:p-5 bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1">
                <span className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-extrabold text-xs flex items-center justify-center flex-shrink-0">
                  #{day.dayIndex}
                </span>
                <input
                  type="text"
                  value={day.dayLabel}
                  onChange={(e) => handleDayLabelChange(day.dayIndex, e.target.value)}
                  placeholder="e.g. Push Day"
                  className="bg-transparent text-lg font-bold text-slate-900 dark:text-white border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-emerald-500 outline-none px-1 py-0.5 max-w-md w-full transition-all"
                />
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => handleAddExerciseToDay(day.dayIndex)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-xs transition-all"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Add Exercise
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveDay(dayIndex)}
                  title="Delete Day"
                  className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Exercises for this Day */}
            <div className="p-4 sm:p-5 space-y-4">
              {day.exercises.length === 0 ? (
                <div className="text-center py-6 text-xs font-medium text-slate-400 dark:text-slate-500">
                  No exercises added to this day yet. Click "Add Exercise" above.
                </div>
              ) : (
                day.exercises.map((ex, exIdx) => (
                  <div
                    key={ex.tempId}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 w-5">
                          {exIdx + 1}.
                        </span>
                        <select
                          value={ex.exerciseId}
                          onChange={(e) =>
                            handleUpdateExercise(day.dayIndex, ex.tempId, 'exerciseId', e.target.value)
                          }
                          className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-1.5 text-sm font-semibold focus:border-emerald-500 outline-none w-full sm:max-w-xs shadow-2xs"
                        >
                          {!exercisesList.some((item) => item.id === ex.exerciseId) && (
                            <option value={ex.exerciseId}>
                              {ex.exerciseName}
                            </option>
                          )}
                          {exercisesList.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name} ({item.muscle_group})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Sets:</label>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={ex.targetSets}
                            onChange={(e) =>
                              handleUpdateExercise(day.dayIndex, ex.tempId, 'targetSets', parseInt(e.target.value) || 3)
                            }
                            className="w-14 px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-center text-slate-900 dark:text-white font-bold shadow-2xs"
                          />
                        </div>

                        <div className="flex items-center gap-1.5">
                          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Reps:</label>
                          <input
                            type="text"
                            value={ex.targetReps}
                            onChange={(e) =>
                              handleUpdateExercise(day.dayIndex, ex.tempId, 'targetReps', e.target.value)
                            }
                            placeholder="8-10"
                            className="w-20 px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-center text-slate-900 dark:text-white font-bold shadow-2xs"
                          />
                        </div>

                        <div className="flex items-center gap-1.5">
                          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Kg:</label>
                          <input
                            type="number"
                            step="2.5"
                            value={ex.targetWeightKg}
                            onChange={(e) =>
                              handleUpdateExercise(
                                day.dayIndex,
                                ex.tempId,
                                'targetWeightKg',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-16 px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-center text-emerald-700 dark:text-emerald-400 font-extrabold shadow-2xs"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveExercise(day.dayIndex, ex.tempId)}
                          className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <input
                      type="text"
                      value={ex.coachingNotes}
                      onChange={(e) =>
                        handleUpdateExercise(day.dayIndex, ex.tempId, 'coachingNotes', e.target.value)
                      }
                      placeholder="Coaching notes / cues (e.g. 2 sec pause at chest, explode up)"
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:border-emerald-500 outline-none shadow-2xs"
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
