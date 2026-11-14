import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Dumbbell,
  GripVertical,
  Play,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Search,
  Layers,
  Sparkles,
  ArrowUpDown,
} from 'lucide-react'
import { api } from '../lib/api'
import { MOCK_CURRENT_PLAN, MOCK_EXERCISES } from '../lib/mockData'
import type {
  CreatePlannedExerciseInput,
  Exercise,
  MuscleGroup,
  PlannedExerciseWithDetails,
  WeeklyPlanWithExercises,
} from '../types'

const MUSCLE_FILTER_OPTIONS: { label: string; value: MuscleGroup | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Chest', value: 'chest' },
  { label: 'Back', value: 'back' },
  { label: 'Shoulders', value: 'shoulders' },
  { label: 'Legs', value: 'legs' },
  { label: 'Arms', value: 'arms' },
  { label: 'Core', value: 'core' },
]

export function Dashboard() {
  const [plan, setPlan] = useState<WeeklyPlanWithExercises | null>(null)
  const [catalog, setCatalog] = useState<Exercise[]>(MOCK_EXERCISES)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false)
  const [savingPlan, setSavingPlan] = useState(false)

  // Drag and Drop reordering state
  const [draggedItem, setDraggedItem] = useState<{ dayIndex: number; index: number } | null>(null)
  const [dragOverItem, setDragOverItem] = useState<{ dayIndex: number; index: number } | null>(null)

  // Add Exercise Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [targetDay, setTargetDay] = useState<{ dayIndex: number; dayLabel: string } | null>(null)
  const [modalExerciseId, setModalExerciseId] = useState('')
  const [modalSets, setModalSets] = useState(3)
  const [modalReps, setModalReps] = useState('8-10')
  const [modalWeight, setModalWeight] = useState(50)
  const [modalNotes, setModalNotes] = useState('')
  const [modalSearch, setModalSearch] = useState('')
  const [modalMuscle, setModalMuscle] = useState<MuscleGroup | 'all'>('all')

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        // 1. Load exercise catalog
        try {
          const catalogData = await api.exercises.list()
          if (catalogData && catalogData.length > 0) {
            setCatalog(catalogData)
          }
        } catch {
          // Fall back to MOCK_EXERCISES
        }

        // 2. Load current plan
        try {
          const data = await api.plans.getCurrent()
          setPlan(data)
        } catch {
          try {
            const cached = localStorage.getItem('fatness_current_plan')
            if (cached) {
              setPlan(JSON.parse(cached))
            } else {
              setPlan(MOCK_CURRENT_PLAN)
            }
          } catch {
            setPlan(MOCK_CURRENT_PLAN)
          }
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load plan')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const showNotice = (msg: string) => {
    setNotice(msg)
    setTimeout(() => setNotice(null), 3000)
  }

  // Persist plan changes to backend
  const persistPlan = async (updatedPlan: WeeklyPlanWithExercises, msg?: string) => {
    setSavingPlan(true)
    setError(null)
    try {
      const dayCounters: Record<number, number> = {}
      const sortedExercises = [...updatedPlan.exercises].sort((a, b) => {
        if (a.day_index !== b.day_index) return a.day_index - b.day_index
        return (a.exercise_order || 0) - (b.exercise_order || 0)
      })

      const formattedExercises: CreatePlannedExerciseInput[] = sortedExercises.map((ex) => {
        const currentOrder = (dayCounters[ex.day_index] || 0) + 1
        dayCounters[ex.day_index] = currentOrder
        return {
          exercise_id: ex.exercise_id,
          day_label: ex.day_label,
          day_index: ex.day_index,
          exercise_order: ex.exercise_order || currentOrder,
          target_sets: ex.target_sets,
          target_reps: ex.target_reps,
          target_weight_kg: ex.target_weight_kg,
          coaching_notes: ex.coaching_notes,
          actual_log: ex.actual_log,
        }
      })

      const savedResult = await api.plans.create({
        week_start: updatedPlan.week_start,
        split_type: updatedPlan.split_type,
        exercises: formattedExercises,
      })
      setPlan(savedResult)
      try {
        localStorage.setItem('fatness_current_plan', JSON.stringify(savedResult))
      } catch {}
      if (msg) showNotice(msg)
    } catch (err: any) {
      console.warn('Persist to backend failed:', err)
      // Save locally to keep state consistent for guest users
      try {
        localStorage.setItem('fatness_current_plan', JSON.stringify(updatedPlan))
      } catch {}
      if (msg) showNotice(msg)
    } finally {
      setSavingPlan(false)
    }
  }

  // Reorder exercises within a day
  const handleMoveExercise = async (dayIndex: number, fromIdx: number, toIdx: number) => {
    if (!plan) return
    const dayExercises = plan.exercises
      .filter((e) => e.day_index === dayIndex)
      .slice()
      .sort((a, b) => (a.exercise_order || 0) - (b.exercise_order || 0))

    if (toIdx < 0 || toIdx >= dayExercises.length || fromIdx === toIdx) return

    // Reorder dayExercises
    const [moved] = dayExercises.splice(fromIdx, 1)
    dayExercises.splice(toIdx, 0, moved)

    // Re-assign exercise_order for this day (1..N)
    const updatedDayExercises = dayExercises.map((ex, idx) => ({
      ...ex,
      exercise_order: idx + 1,
    }))

    // Build full updated exercises array
    const otherExercises = plan.exercises.filter((e) => e.day_index !== dayIndex)
    const allUpdatedExercises = [...otherExercises, ...updatedDayExercises].sort((a, b) => {
      if (a.day_index !== b.day_index) return a.day_index - b.day_index
      return (a.exercise_order || 0) - (b.exercise_order || 0)
    })

    const updatedPlan: WeeklyPlanWithExercises = {
      ...plan,
      exercises: allUpdatedExercises,
    }

    // Optimistic UI update
    setPlan(updatedPlan)

    // Prepare items for backend reorder
    const items = updatedDayExercises.map((ex) => ({
      id: ex.id,
      exercise_order: ex.exercise_order,
    }))

    try {
      const savedResult = await api.plans.reorder(plan.id, items)
      setPlan(savedResult)
      try {
        localStorage.setItem('fatness_current_plan', JSON.stringify(savedResult))
      } catch {}
      showNotice(`Reordered exercises in ${dayExercises[0]?.day_label || `Day ${dayIndex}`}`)
    } catch (err) {
      console.warn('Backend reorder failed, keeping local changes:', err)
      try {
        localStorage.setItem('fatness_current_plan', JSON.stringify(updatedPlan))
      } catch {}
      showNotice(`Reordered exercises in ${dayExercises[0]?.day_label || `Day ${dayIndex}`}`)
    }
  }

  // HTML5 Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, dayIndex: number, index: number) => {
    e.dataTransfer.setData('text/plain', `${dayIndex}:${index}`)
    e.dataTransfer.effectAllowed = 'move'
    setDraggedItem({ dayIndex, index })
  }

  const handleDragOver = (e: React.DragEvent, dayIndex: number, index: number) => {
    e.preventDefault()
    if (!draggedItem || draggedItem.dayIndex !== dayIndex) return
    if (dragOverItem?.dayIndex !== dayIndex || dragOverItem?.index !== index) {
      setDragOverItem({ dayIndex, index })
    }
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
    setDragOverItem(null)
  }

  const handleDrop = async (e: React.DragEvent, targetDayIndex: number, targetIndex: number) => {
    e.preventDefault()
    if (!draggedItem) return
    if (draggedItem.dayIndex !== targetDayIndex) return
    const from = draggedItem.index
    const to = targetIndex
    setDraggedItem(null)
    setDragOverItem(null)
    if (from !== to) {
      await handleMoveExercise(targetDayIndex, from, to)
    }
  }

  // Remove exercise from plan
  const handleRemoveExercise = async (exerciseId: string) => {
    if (!plan) return
    const targetEx = plan.exercises.find((e) => e.id === exerciseId)
    const updatedExercises = plan.exercises.filter((e) => e.id !== exerciseId)
    const updatedPlan = { ...plan, exercises: updatedExercises }
    setPlan(updatedPlan)
    await persistPlan(updatedPlan, `Removed "${targetEx?.exercise_name || 'exercise'}" from plan`)
  }

  // Open Add Exercise Modal
  const handleOpenAddModal = (dayIndex: number, dayLabel: string) => {
    const firstEx = catalog[0] || MOCK_EXERCISES[0]
    setTargetDay({ dayIndex, dayLabel })
    setModalExerciseId(firstEx.id)
    setModalSets(3)
    setModalReps('8-10')
    setModalWeight(50)
    setModalNotes('')
    setModalSearch('')
    setModalMuscle('all')
    setIsAddModalOpen(true)
  }

  // Submit Add Exercise
  const handleAddExerciseSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!plan || !targetDay) return

    const chosenEx = catalog.find((c) => c.id === modalExerciseId) || catalog[0] || MOCK_EXERCISES[0]
    const dayExercisesCount = plan.exercises.filter((e) => e.day_index === targetDay.dayIndex).length

    const newExercise: PlannedExerciseWithDetails = {
      id: `pe-${Date.now()}`,
      weekly_plan_id: plan.id,
      exercise_id: chosenEx.id,
      day_label: targetDay.dayLabel,
      day_index: targetDay.dayIndex,
      exercise_order: dayExercisesCount + 1,
      target_sets: modalSets,
      target_reps: modalReps,
      target_weight_kg: modalWeight,
      coaching_notes: modalNotes.trim() ? modalNotes.trim() : null,
      actual_log: null,
      logged_at: null,
      exercise_name: chosenEx.name,
      muscle_group: chosenEx.muscle_group,
      youtube_url: chosenEx.youtube_url || null,
    }

    const updatedExercises = [...plan.exercises, newExercise]
    const updatedPlan = { ...plan, exercises: updatedExercises }
    setPlan(updatedPlan)
    setIsAddModalOpen(false)

    await persistPlan(updatedPlan, `Added "${chosenEx.name}" to Day ${targetDay.dayIndex}`)
  }

  // Update Day Label inline
  const handleDayLabelChange = (dayIndex: number, newLabel: string) => {
    if (!plan) return
    const updatedExercises = plan.exercises.map((e) =>
      e.day_index === dayIndex ? { ...e, day_label: newLabel } : e
    )
    const updatedPlan = { ...plan, exercises: updatedExercises }
    setPlan(updatedPlan)
  }

  // Add a new training day
  const handleAddNewDay = () => {
    if (!plan) return
    const currentMax = plan.exercises.reduce((max, e) => Math.max(max, e.day_index), 0)
    const nextDayIndex = currentMax + 1
    handleOpenAddModal(nextDayIndex, `Day ${nextDayIndex} (New Session)`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500 dark:text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mr-3" />
        Loading your weekly split...
      </div>
    )
  }

  // Group exercises by day_index & day_label
  const daysMap = new Map<number, { label: string; exercises: PlannedExerciseWithDetails[] }>()
  if (plan?.exercises) {
    plan.exercises.forEach((ex) => {
      if (!daysMap.has(ex.day_index)) {
        daysMap.set(ex.day_index, { label: ex.day_label, exercises: [] })
      }
      daysMap.get(ex.day_index)!.exercises.push(ex)
    })
  }

  // Ensure exercises within each day are sorted by exercise_order ASC
  daysMap.forEach((dayData) => {
    dayData.exercises.sort((a, b) => (a.exercise_order || 0) - (b.exercise_order || 0))
  })

  const sortedDays = Array.from(daysMap.entries()).sort(([a], [b]) => a - b)
  const totalExercises = plan?.exercises.length || 0
  const loggedExercises = plan?.exercises.filter((e) => Boolean(e.actual_log?.trim())).length || 0
  const progressPercent = totalExercises > 0 ? Math.round((loggedExercises / totalExercises) * 100) : 0

  // Filter exercises inside Add Modal
  const modalFilteredExercises = catalog.filter((ex) => {
    const matchesMuscle = modalMuscle === 'all' || ex.muscle_group === modalMuscle
    const matchesSearch =
      ex.name.toLowerCase().includes(modalSearch.toLowerCase()) ||
      ex.muscle_group.toLowerCase().includes(modalSearch.toLowerCase())
    return matchesMuscle && matchesSearch
  })

  return (
    <div className="space-y-8 pb-16">
      {/* Top Banner / Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs p-6 sm:p-8 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Week of {plan?.week_start ? new Date(plan.week_start).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Current Week'}
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Weekly Training Split
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base max-w-xl">
              Split style: <span className="text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider">{plan?.split_type.replace(/_/g, ' ') || 'Push-Pull-Legs'}</span>. Track your lifts, reps, and overload week after week.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={handleAddNewDay}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-sm transition-all border border-slate-300 dark:border-slate-700 shadow-xs"
                >
                  <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Add Training Day
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (plan) await persistPlan(plan)
                    setIsEditing(false)
                  }}
                  disabled={savingPlan}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all shadow-md shadow-emerald-600/20"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  {savingPlan ? 'Saving...' : 'Done Editing'}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold text-sm transition-all shadow-sm border border-transparent dark:border-slate-700"
                >
                  <Edit3 className="w-4 h-4 text-emerald-400" />
                  Edit Plan
                </button>
                <Link
                  to="/builder"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm transition-all border border-slate-200 dark:border-slate-700"
                >
                  <Layers className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  New Split
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 mb-2 font-medium">
            <span>Weekly Completion</span>
            <span className="font-bold text-emerald-700 dark:text-emerald-400">
              {loggedExercises} / {totalExercises} exercises logged ({progressPercent}%)
            </span>
          </div>
          <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200/60 dark:border-slate-700/60">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Editing Mode Banner */}
      {isEditing && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-4 text-emerald-900 dark:text-emerald-200 text-sm">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <div>
              <p className="font-bold">Edit Mode Active</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                Use the up/down arrows or drag & drop to reorder exercises, click the trash icon to remove, or "+ Add Exercise" to insert exercises into any session.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              if (plan) await persistPlan(plan)
              setIsEditing(false)
            }}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs flex-shrink-0"
          >
            Done
          </button>
        </div>
      )}

      {/* Notice Toast */}
      {notice && (
        <div className="p-3.5 rounded-2xl bg-emerald-600 text-white text-sm font-semibold flex items-center gap-2 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle2 className="w-4 h-4" />
          {notice}
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-sm font-medium">
          {error}
        </div>
      )}

      {/* Week Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Sessions This Week
          </h2>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {sortedDays.length} training days scheduled
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedDays.map(([dayIndex, dayData]) => {
            const completedCount = dayData.exercises.filter((e) => Boolean(e.actual_log?.trim())).length
            const isAllCompleted = completedCount === dayData.exercises.length && dayData.exercises.length > 0
            const isPartiallyDone = completedCount > 0 && !isAllCompleted

            return (
              <div
                key={dayIndex}
                className={`flex flex-col justify-between rounded-3xl bg-white dark:bg-slate-900 border transition-all p-6 shadow-xs ${
                  isEditing
                    ? 'border-emerald-300 dark:border-emerald-700/80 ring-2 ring-emerald-500/10'
                    : 'border-slate-200/90 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-lg'
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                        Day {dayIndex}
                      </span>
                      {isEditing ? (
                        <input
                          type="text"
                          value={dayData.label}
                          onChange={(e) => handleDayLabelChange(dayIndex, e.target.value)}
                          onBlur={() => plan && persistPlan(plan)}
                          placeholder="Session Name"
                          className="mt-2 text-base font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1 w-full focus:border-emerald-500 outline-none"
                        />
                      ) : (
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1.5 transition-colors">
                          {dayData.label}
                        </h3>
                      )}
                    </div>

                    {!isEditing && (
                      <div className="flex items-center gap-2">
                        {isAllCompleted ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Done
                          </span>
                        ) : isPartiallyDone ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-800">
                            <Clock className="w-3.5 h-3.5" /> {completedCount}/{dayData.exercises.length}
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                            {dayData.exercises.length} exercises
                          </span>
                        )}

                        {/* Quick Edit/Reorder Button */}
                        <button
                          type="button"
                          onClick={() => setIsEditing(true)}
                          title="Edit & reorder session"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <ArrowUpDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Exercise Preview List */}
                  <div className="space-y-2 mb-6">
                    {dayData.exercises.length === 0 ? (
                      <div className="text-center py-6 text-xs text-slate-400 dark:text-slate-500 italic">
                        No exercises in this session. Click "+ Add Exercise" below.
                      </div>
                    ) : (
                      dayData.exercises.map((ex, idx) => {
                        const isBeingDragged =
                          draggedItem?.dayIndex === dayIndex && draggedItem?.index === idx
                        const isDragOver =
                          dragOverItem?.dayIndex === dayIndex && dragOverItem?.index === idx

                        return (
                          <div
                            key={ex.id}
                            draggable={isEditing}
                            onDragStart={(e) => handleDragStart(e, dayIndex, idx)}
                            onDragOver={(e) => handleDragOver(e, dayIndex, idx)}
                            onDrop={(e) => handleDrop(e, dayIndex, idx)}
                            onDragEnd={handleDragEnd}
                            className={`flex items-center justify-between text-xs py-2 px-3 rounded-xl border transition-all ${
                              isBeingDragged
                                ? 'opacity-40 bg-slate-100 dark:bg-slate-800 border-dashed border-emerald-500'
                                : isDragOver
                                ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20'
                                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/70 dark:border-slate-700/70 hover:border-slate-300 dark:hover:border-slate-600'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate mr-2 flex-1 min-w-0">
                              {/* Drag Handle in Edit Mode */}
                              {isEditing && (
                                <span
                                  className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 p-0.5"
                                  title="Drag to reorder"
                                >
                                  <GripVertical className="w-3.5 h-3.5" />
                                </span>
                              )}

                              {/* Order Badge */}
                              <span
                                className="w-5 h-5 flex-shrink-0 flex items-center justify-center rounded-md bg-slate-200/80 dark:bg-slate-700/80 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300"
                                title={`Exercise #${idx + 1}`}
                              >
                                {idx + 1}
                              </span>

                              <div
                                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                  ex.actual_log ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                                }`}
                              />
                              <span
                                className={`font-semibold truncate ${
                                  ex.actual_log
                                    ? 'text-slate-400 dark:text-slate-500 line-through'
                                    : 'text-slate-800 dark:text-slate-200'
                                }`}
                              >
                                {ex.exercise_name}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono font-medium hidden sm:inline">
                                {ex.target_sets}×{ex.target_reps}{' '}
                                {ex.target_weight_kg ? `@${ex.target_weight_kg}kg` : ''}
                              </span>

                              {/* Reorder Up / Down & Remove buttons in Edit Mode */}
                              {isEditing && (
                                <div className="flex items-center gap-0.5 ml-1">
                                  <button
                                    type="button"
                                    onClick={() => handleMoveExercise(dayIndex, idx, idx - 1)}
                                    disabled={idx === 0}
                                    title="Move exercise up"
                                    className={`p-1 rounded-lg transition-colors ${
                                      idx === 0
                                        ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                                        : 'text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                                    }`}
                                  >
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveExercise(dayIndex, idx, idx + 1)}
                                    disabled={idx === dayData.exercises.length - 1}
                                    title="Move exercise down"
                                    className={`p-1 rounded-lg transition-colors ${
                                      idx === dayData.exercises.length - 1
                                        ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                                        : 'text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                                    }`}
                                  >
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveExercise(ex.id)}
                                    title="Remove exercise from session"
                                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors ml-0.5"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* Card CTA: Edit Mode vs Normal Mode */}
                {isEditing ? (
                  <button
                    type="button"
                    onClick={() => handleOpenAddModal(dayIndex, dayData.label)}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold text-xs transition-all shadow-2xs"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    Add Exercise to Day {dayIndex}
                  </button>
                ) : (
                  <Link
                    to={`/workout/${dayIndex}`}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-emerald-600 dark:bg-slate-800 dark:hover:bg-emerald-600 text-white font-semibold text-sm transition-all shadow-xs border border-transparent dark:border-slate-700"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    {isAllCompleted ? 'Review Workout Log' : 'Start & Log Workout'}
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Add Exercise Modal */}
      {isAddModalOpen && targetDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                  Day {targetDay.dayIndex}
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                  Add Exercise to {targetDay.dayLabel}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddExerciseSubmit} className="space-y-4">
              {/* Muscle Filter and Search */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Select Movement
                </label>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {MUSCLE_FILTER_OPTIONS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setModalMuscle(m.value)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                        modalMuscle === m.value
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search exercise..."
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <select
                  value={modalExerciseId}
                  onChange={(e) => setModalExerciseId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:border-emerald-500 outline-none shadow-2xs"
                >
                  {modalFilteredExercises.length === 0 ? (
                    <option disabled>No matching exercises found</option>
                  ) : (
                    modalFilteredExercises.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.name} ({ex.muscle_group})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Target Sets, Reps, Weight */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    Sets
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={modalSets}
                    onChange={(e) => setModalSets(parseInt(e.target.value) || 3)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-mono font-bold text-center text-slate-900 dark:text-white focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    Target Reps
                  </label>
                  <input
                    type="text"
                    value={modalReps}
                    onChange={(e) => setModalReps(e.target.value)}
                    placeholder="8-10"
                    required
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-mono font-bold text-center text-slate-900 dark:text-white focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    step="2.5"
                    value={modalWeight}
                    onChange={(e) => setModalWeight(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-mono font-bold text-center text-emerald-700 dark:text-emerald-400 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              {/* Coaching Notes */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                  Coaching Notes / Cue (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2 sec pause at chest, explode up"
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:border-emerald-500 outline-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPlan || !modalExerciseId}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  Add Exercise
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
