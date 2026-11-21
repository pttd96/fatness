import React, { useState, useEffect } from 'react'
import {
  Search,
  User,
  Calendar,
  Plus,
  Trash2,
  Save,
  Check,
  CheckCircle2,
  Copy,
  AlertCircle,
  ExternalLink,
  X,
  Pencil,
} from 'lucide-react'
import { api } from '../lib/api'
import { ExerciseCombobox } from '../components/ExerciseCombobox'
import type {
  ClientLookupResponse,
  Exercise,
  PlannedExerciseWithDetails,
} from '../types'

interface CoachDay {
  dayIndex: number
  dayLabel: string
}

export function CoachClients() {
  const [searchEmail, setSearchEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [clientData, setClientData] = useState<ClientLookupResponse | null>(null)

  // Plan Days management
  const [planDays, setPlanDays] = useState<CoachDay[]>([])
  const [editingDayIndex, setEditingDayIndex] = useState<number | null>(null)
  const [tempDayLabel, setTempDayLabel] = useState<string>('')
  const [savingDayIndex, setSavingDayIndex] = useState<number | null>(null)
  const [daySaveSuccessIndex, setDaySaveSuccessIndex] = useState<number | null>(null)

  // Catalog for adding exercises
  const [catalog, setCatalog] = useState<Exercise[]>([])
  const [savingExerciseId, setSavingExerciseId] = useState<string | null>(null)
  const [saveSuccessId, setSaveSuccessId] = useState<string | null>(null)
  const [deletingExerciseId, setDeletingExerciseId] = useState<string | null>(null)

  // Add Exercise Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [targetDayIndex, setTargetDayIndex] = useState<number>(1)
  const [targetDayLabel, setTargetDayLabel] = useState<string>('Workout Day')
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>('')
  const [newSets, setNewSets] = useState<number>(3)
  const [newReps, setNewReps] = useState<string>('8-10')
  const [newWeight, setNewWeight] = useState<number>(60)
  const [newNotes, setNewNotes] = useState<string>('')
  const [addingExercise, setAddingExercise] = useState(false)
  const [rollingOver, setRollingOver] = useState(false)
  const [rolloverSuccess, setRolloverSuccess] = useState<string | null>(null)

  // Local edits map: planned_exercise_id -> { target_sets, target_reps, target_weight_kg, coaching_notes }
  const [exerciseEdits, setExerciseEdits] = useState<
    Record<
      string,
      {
        target_sets: number
        target_reps: string
        target_weight_kg: number
        coaching_notes: string
      }
    >
  >({})

  // Load catalog on mount
  useEffect(() => {
    async function loadCatalog() {
      try {
        const exercises = await api.exercises.list()
        setCatalog(exercises)
        if (exercises.length > 0) {
          setSelectedCatalogId(exercises[0].id)
        }
      } catch (err) {
        console.error('Failed to load exercises catalog', err)
      }
    }
    loadCatalog()
  }, [])

  const syncPlanDaysFromExercises = (exercises?: PlannedExerciseWithDetails[]): CoachDay[] => {
    if (!exercises || exercises.length === 0) return []
    const map = new Map<number, string>()
    for (const ex of exercises) {
      if (!map.has(ex.day_index)) {
        map.set(ex.day_index, ex.day_label || `Day ${ex.day_index}`)
      }
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([dayIndex, dayLabel]) => ({ dayIndex, dayLabel }))
  }

  const handleLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = searchEmail.trim()
    if (!trimmed) return

    setLoading(true)
    setLookupError(null)
    setClientData(null)
    setExerciseEdits({})
    setPlanDays([])
    setEditingDayIndex(null)

    try {
      const data = await api.coach.lookupClient(trimmed)
      setClientData(data)

      // Initialize edit fields
      if (data.active_plan?.exercises) {
        const initialEdits: Record<string, any> = {}
        for (const ex of data.active_plan.exercises) {
          initialEdits[ex.id] = {
            target_sets: ex.target_sets ?? 3,
            target_reps: ex.target_reps ?? '10',
            target_weight_kg: ex.target_weight_kg ?? 0,
            coaching_notes: ex.coaching_notes ?? '',
          }
        }
        setExerciseEdits(initialEdits)
        setPlanDays(syncPlanDaysFromExercises(data.active_plan.exercises))
      } else {
        setPlanDays([])
      }
    } catch (err: any) {
      setLookupError(err.message || 'Failed to find client. Please verify the email.')
    } finally {
      setLoading(false)
    }
  }

  const handleFieldChange = (
    exerciseId: string,
    field: 'target_sets' | 'target_reps' | 'target_weight_kg' | 'coaching_notes',
    value: any
  ) => {
    setExerciseEdits((prev) => ({
      ...prev,
      [exerciseId]: {
        ...prev[exerciseId],
        [field]: value,
      },
    }))
  }

  const handleSaveExerciseTargets = async (
    plannedExerciseId: string
  ) => {
    if (!clientData) return
    const edit = exerciseEdits[plannedExerciseId]
    if (!edit) return

    setSavingExerciseId(plannedExerciseId)
    setSaveSuccessId(null)

    try {
      const updated = await api.coach.updatePlannedExercise(
        clientData.client_id,
        plannedExerciseId,
        {
          target_sets: Number(edit.target_sets),
          target_reps: String(edit.target_reps),
          target_weight_kg: Number(edit.target_weight_kg),
          coaching_notes: edit.coaching_notes,
        }
      )

      // Update state in clientData
      setClientData((prev) => {
        if (!prev || !prev.active_plan) return prev
        return {
          ...prev,
          active_plan: {
            ...prev.active_plan,
            exercises: prev.active_plan.exercises.map((ex) =>
              ex.id === plannedExerciseId ? { ...ex, ...updated } : ex
            ),
          },
        }
      })

      setSaveSuccessId(plannedExerciseId)
      setTimeout(() => setSaveSuccessId(null), 2500)
    } catch (err: any) {
      alert(`Failed to save exercise targets: ${err.message}`)
    } finally {
      setSavingExerciseId(null)
    }
  }

  const handleDeleteExercise = async (plannedExerciseId: string) => {
    if (!clientData) return
    if (!confirm('Are you sure you want to remove this exercise from the client plan?')) {
      return
    }

    setDeletingExerciseId(plannedExerciseId)

    try {
      await api.coach.deletePlannedExercise(
        clientData.client_id,
        plannedExerciseId
      )

      setClientData((prev) => {
        if (!prev || !prev.active_plan) return prev
        return {
          ...prev,
          active_plan: {
            ...prev.active_plan,
            exercises: prev.active_plan.exercises.filter(
              (ex) => ex.id !== plannedExerciseId
            ),
          },
        }
      })
    } catch (err: any) {
      alert(`Failed to delete exercise: ${err.message}`)
    } finally {
      setDeletingExerciseId(null)
    }
  }

  const handleRolloverPlan = async () => {
    if (!clientData?.active_plan) return
    setRollingOver(true)
    setRolloverSuccess(null)
    try {
      const newPlan = await api.coach.rolloverPlan(clientData.client_id)
      setClientData((prev) => (prev ? { ...prev, active_plan: newPlan } : null))

      // Re-initialize edits with the new exercises
      const initialEdits: Record<string, any> = {}
      for (const ex of newPlan.exercises) {
        initialEdits[ex.id] = {
          target_sets: ex.target_sets ?? 3,
          target_reps: ex.target_reps ?? '10',
          target_weight_kg: ex.target_weight_kg ?? 0,
          coaching_notes: ex.coaching_notes ?? '',
        }
      }
      setExerciseEdits(initialEdits)
      if (newPlan.exercises) {
        setPlanDays(syncPlanDaysFromExercises(newPlan.exercises))
      } else {
        setPlanDays([])
      }
      setRolloverSuccess(`Plan rolled over to week of ${newPlan.week_start}! You can now adjust targets.`)
      setTimeout(() => setRolloverSuccess(null), 4000)
    } catch (err: any) {
      alert(`Failed to rollover plan: ${err.message}`)
    } finally {
      setRollingOver(false)
    }
  }

  const handleAddDay = async () => {
    if (!clientData) return

    // If client doesn't have an active plan yet, initialize one
    let currentPlan = clientData.active_plan
    if (!currentPlan) {
      try {
        const d = new Date()
        const day = d.getDay()
        const diff = d.getDate() - day + (day === 0 ? -6 : 1)
        const monday = new Date(d.setDate(diff)).toISOString().split('T')[0]

        const initializedPlan = await api.coach.createOrUpdatePlan(clientData.client_id, {
          week_start: monday,
          split_type: 'custom',
          exercises: [],
        })
        currentPlan = initializedPlan
        setClientData((prev) => (prev ? { ...prev, active_plan: initializedPlan } : null))
      } catch (err: any) {
        alert(`Failed to initialize plan for client: ${err.message}`)
        return
      }
    }

    const currentMax = planDays.reduce((max, d) => Math.max(max, d.dayIndex), 0)
    const exerciseMax = (currentPlan?.exercises || []).reduce((max, ex) => Math.max(max, ex.day_index), 0)
    const nextIndex = Math.max(currentMax, exerciseMax) + 1
    const newDayLabel = `Day ${nextIndex}`

    setPlanDays((prev) => [...prev, { dayIndex: nextIndex, dayLabel: newDayLabel }])
    setEditingDayIndex(nextIndex)
    setTempDayLabel(newDayLabel)
  }

  const handleRemoveEmptyDay = (dayIndex: number) => {
    const exercisesForDay = clientData?.active_plan?.exercises?.filter((e) => e.day_index === dayIndex) || []
    if (exercisesForDay.length > 0) {
      alert('Cannot delete a day that contains movements. Please delete the movements first.')
      return
    }
    setPlanDays((prev) => prev.filter((d) => d.dayIndex !== dayIndex))
    if (editingDayIndex === dayIndex) {
      setEditingDayIndex(null)
    }
  }

  const handleSaveDayLabel = async (dayIndex: number) => {
    if (!clientData) return
    const trimmed = tempDayLabel.trim()
    if (!trimmed) {
      alert('Day label cannot be empty')
      return
    }

    setSavingDayIndex(dayIndex)
    try {
      const dayHasExercises = clientData.active_plan?.exercises?.some((e) => e.day_index === dayIndex)

      if (dayHasExercises) {
        await api.coach.updateDayLabel(clientData.client_id, dayIndex, trimmed)

        // Update day_label in clientData.active_plan.exercises
        setClientData((prev) => {
          if (!prev || !prev.active_plan) return prev
          return {
            ...prev,
            active_plan: {
              ...prev.active_plan,
              exercises: prev.active_plan.exercises.map((ex) =>
                ex.day_index === dayIndex ? { ...ex, day_label: trimmed } : ex
              ),
            },
          }
        })
      }

      // Update in planDays
      setPlanDays((prev) =>
        prev.map((d) => (d.dayIndex === dayIndex ? { ...d, dayLabel: trimmed } : d))
      )

      setEditingDayIndex(null)
      setDaySaveSuccessIndex(dayIndex)
      setTimeout(() => setDaySaveSuccessIndex(null), 2500)
    } catch (err: any) {
      alert(`Failed to update day label: ${err.message}`)
    } finally {
      setSavingDayIndex(null)
    }
  }

  const openAddModal = (dayIndex: number, dayLabel: string) => {
    setTargetDayIndex(dayIndex)
    setTargetDayLabel(dayLabel)
    if (catalog.length > 0) {
      setSelectedCatalogId(catalog[0].id)
    }
    setNewSets(3)
    setNewReps('8-10')
    setNewWeight(60)
    setNewNotes('')
    setIsAddModalOpen(true)
  }

  const handleAddExerciseSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientData || !selectedCatalogId) return

    setAddingExercise(true)
    try {
      const added = await api.coach.addExerciseToDay(clientData.client_id, {
        exercise_id: selectedCatalogId,
        day_index: targetDayIndex,
        day_label: targetDayLabel,
        target_sets: newSets,
        target_reps: newReps,
        target_weight_kg: newWeight,
        coaching_notes: newNotes,
      })

      setClientData((prev) => {
        if (!prev || !prev.active_plan) return prev
        return {
          ...prev,
          active_plan: {
            ...prev.active_plan,
            exercises: [...prev.active_plan.exercises, added],
          },
        }
      })

      setPlanDays((prev) => {
        if (prev.some((d) => d.dayIndex === targetDayIndex)) {
          return prev
        }
        return [...prev, { dayIndex: targetDayIndex, dayLabel: targetDayLabel }].sort(
          (a, b) => a.dayIndex - b.dayIndex
        )
      })

      // Add to local edits
      setExerciseEdits((prev) => ({
        ...prev,
        [added.id]: {
          target_sets: added.target_sets ?? newSets,
          target_reps: added.target_reps ?? newReps,
          target_weight_kg: added.target_weight_kg ?? newWeight,
          coaching_notes: added.coaching_notes ?? newNotes,
        },
      }))

      setIsAddModalOpen(false)
    } catch (err: any) {
      alert(`Failed to add exercise: ${err.message}`)
    } finally {
      setAddingExercise(false)
    }
  }

  // Group exercises by dayIndex
  const groupedExercises: Record<number, PlannedExerciseWithDetails[]> = {}
  if (clientData?.active_plan?.exercises) {
    for (const ex of clientData.active_plan.exercises) {
      if (!groupedExercises[ex.day_index]) {
        groupedExercises[ex.day_index] = []
      }
      groupedExercises[ex.day_index].push(ex)
    }
  }

  // Combine planDays with any day_index present in exercises
  const combinedDaysMap = new Map<number, string>()
  for (const d of planDays) {
    combinedDaysMap.set(d.dayIndex, d.dayLabel)
  }
  if (clientData?.active_plan?.exercises) {
    for (const ex of clientData.active_plan.exercises) {
      if (!combinedDaysMap.has(ex.day_index)) {
        combinedDaysMap.set(ex.day_index, ex.day_label || `Day ${ex.day_index}`)
      }
    }
  }
  const allDays: CoachDay[] = Array.from(combinedDaysMap.entries())
    .map(([dayIndex, dayLabel]) => ({ dayIndex, dayLabel }))
    .sort((a, b) => a.dayIndex - b.dayIndex)

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <User className="w-3.5 h-3.5" /> Coach Portal
          </div>
          <h1 className="text-3xl font-black tracking-tight">Client Roster & Workout Management</h1>
          <p className="text-slate-300 text-sm leading-relaxed">
            Search for an athlete by their registered email address to view their profile, review their training progress, and modify their active weekly workout plan.
          </p>
        </div>
      </div>

      {/* Client Search Bar (Initially Empty) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <form onSubmit={handleLookup} className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
            Look Up Client by Email
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
              <input
                type="email"
                required
                placeholder="Enter client's email (e.g. athlete@example.com)..."
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:bg-white dark:focus:bg-slate-700 focus:border-emerald-500 outline-none transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !searchEmail.trim()}
              className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 flex-shrink-0"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" /> Look Up Client
                </>
              )}
            </button>
          </div>
        </form>

        {lookupError && (
          <div className="mt-4 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm font-medium flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{lookupError}</span>
          </div>
        )}
      </div>

      {/* Client Profile & Active Plan Display */}
      {clientData && (
        <div className="space-y-6">
          {/* Athlete Profile Summary Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-black text-xl">
                {(clientData.display_name || clientData.email || 'A')[0].toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    {clientData.display_name || 'Athlete'}
                  </h2>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                    CLIENT
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {clientData.email}
                </p>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Experience</div>
                <div className="text-sm font-black text-slate-800 dark:text-slate-200 capitalize mt-0.5">
                  {clientData.fitness_level || 'Intermediate'}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Goal</div>
                <div className="text-sm font-black text-slate-800 dark:text-slate-200 capitalize mt-0.5">
                  {clientData.goal || 'Hypertrophy'}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Split Type</div>
                <div className="text-sm font-black text-slate-800 dark:text-slate-200 capitalize mt-0.5">
                  {(clientData.split_type || 'push_pull_legs').replace(/_/g, ' ')}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Days/Week</div>
                <div className="text-sm font-black text-slate-800 dark:text-slate-200 mt-0.5">
                  {clientData.training_days_per_week || 4} Days
                </div>
              </div>
            </div>
          </div>

          {/* Plan Section */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-emerald-600" />
                    Weekly Training Plan
                  </h3>
                  {clientData.active_plan && (
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        clientData.active_plan.status === 'completed'
                          ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      }`}
                    >
                      {clientData.active_plan.status === 'completed' ? '✓ Completed' : 'Active'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {clientData.active_plan
                    ? `Week of ${clientData.active_plan.week_start} • Split: ${clientData.active_plan.split_type.replace(/_/g, ' ')}${
                        clientData.active_plan.created_by
                          ? ` • Created by: ${clientData.active_plan.created_by}`
                          : ''
                      }`
                    : 'No active plan currently scheduled for this client.'}
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                <button
                  type="button"
                  onClick={handleAddDay}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-emerald-700 dark:text-emerald-400 border border-slate-200 dark:border-slate-700 font-bold text-xs shadow-2xs transition-all"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Day
                </button>
                {clientData.active_plan && (
                  <button
                    type="button"
                    onClick={handleRolloverPlan}
                    disabled={rollingOver}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {rollingOver ? 'Rolling Over...' : 'Roll Over Plan to Next Week'}
                  </button>
                )}
              </div>
            </div>

            {rolloverSuccess && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2 shadow-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                {rolloverSuccess}
              </div>
            )}

            {!clientData.active_plan || allDays.length === 0 ? (
              <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 space-y-4 shadow-xs">
                <Calendar className="w-10 h-10 mx-auto text-emerald-600 dark:text-emerald-400 opacity-80" />
                <div className="space-y-1">
                  <p className="font-bold text-base text-slate-800 dark:text-slate-200">
                    No active workout schedule
                  </p>
                  <p className="text-xs max-w-md mx-auto">
                    This client does not have any workout days scheduled yet. Start building their weekly split by adding training days.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddDay}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all"
                >
                  <Plus className="w-4 h-4" /> Add Training Day
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {allDays.map((day) => {
                  const dayExercises = groupedExercises[day.dayIndex] || []
                  const isEditingThisDay = editingDayIndex === day.dayIndex
                  const isSavingThisDay = savingDayIndex === day.dayIndex
                  const isSaveSuccess = daySaveSuccessIndex === day.dayIndex

                  return (
                    <div
                      key={day.dayIndex}
                      className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs"
                    >
                      {/* Day Header */}
                      <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <span className="w-7 h-7 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center justify-center shadow-xs flex-shrink-0">
                            {day.dayIndex}
                          </span>

                          {isEditingThisDay ? (
                            <div className="flex items-center gap-2 flex-1 max-w-md">
                              <input
                                type="text"
                                value={tempDayLabel}
                                onChange={(e) => setTempDayLabel(e.target.value)}
                                placeholder={`Day ${day.dayIndex}`}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveDayLabel(day.dayIndex)
                                  if (e.key === 'Escape') setEditingDayIndex(null)
                                }}
                                className="flex-1 px-3 py-1 bg-white dark:bg-slate-800 border border-emerald-500 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none shadow-2xs"
                              />
                              <button
                                type="button"
                                disabled={isSavingThisDay}
                                onClick={() => handleSaveDayLabel(day.dayIndex)}
                                className="p-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                                title="Save Day Name"
                              >
                                {isSavingThisDay ? (
                                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingDayIndex(null)}
                                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base truncate">
                                {day.dayLabel}
                              </h4>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingDayIndex(day.dayIndex)
                                  setTempDayLabel(day.dayLabel)
                                }}
                                className="p-1 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                                title="Edit Day Name"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              {isSaveSuccess && (
                                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 animate-in fade-in">
                                  <Check className="w-3 h-3 stroke-[3]" /> Saved
                                </span>
                              )}
                              <span className="text-xs font-semibold text-slate-400">
                                ({dayExercises.length} movement{dayExercises.length === 1 ? '' : 's'})
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => openAddModal(day.dayIndex, day.dayLabel)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-emerald-600 dark:hover:bg-emerald-600 text-white text-xs font-bold transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Movement
                          </button>
                          {dayExercises.length === 0 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveEmptyDay(day.dayIndex)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                              title="Remove Empty Day"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Day Movements or Empty State */}
                      {dayExercises.length === 0 ? (
                        <div className="p-8 text-center bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl m-3 border border-dashed border-slate-200 dark:border-slate-700/80 space-y-2">
                          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            No movements scheduled for {day.dayLabel} yet.
                          </p>
                          <button
                            type="button"
                            onClick={() => openAddModal(day.dayIndex, day.dayLabel)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs transition-all"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add First Movement
                          </button>
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800/60 p-2 sm:p-4 space-y-2">
                          {dayExercises.map((ex) => {
                          const edits = exerciseEdits[ex.id] || {
                            target_sets: ex.target_sets ?? 3,
                            target_reps: ex.target_reps ?? '10',
                            target_weight_kg: ex.target_weight_kg ?? 0,
                            coaching_notes: ex.coaching_notes ?? '',
                          }
                          const isSaving = savingExerciseId === ex.id
                          const isSuccess = saveSuccessId === ex.id
                          const isDeleting = deletingExerciseId === ex.id

                          return (
                            <div
                              key={ex.id}
                              className="p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4 border border-transparent hover:border-slate-200 dark:hover:border-slate-800"
                            >
                              {/* Exercise Info */}
                              <div className="space-y-1 min-w-[200px]">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                                    {ex.muscle_group}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider ${
                                      ex.status === 'completed'
                                        ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                    }`}
                                  >
                                    {ex.status === 'completed' ? '✓ Logged' : 'Pending'}
                                  </span>
                                  {ex.youtube_url && (
                                    <a
                                      href={ex.youtube_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-slate-400 hover:text-red-500 transition-colors"
                                      title="Watch tutorial"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                </div>
                                <h5 className="font-bold text-slate-900 dark:text-white text-sm">
                                  {ex.exercise_name}
                                </h5>
                                {ex.actual_log && (
                                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                                    Athlete Log: {ex.actual_log}
                                  </p>
                                )}
                                {ex.updated_by && (
                                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                                    Updated by: {ex.updated_by}
                                  </p>
                                )}
                              </div>

                              {/* Editable Targets Grid */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 flex-1 max-w-2xl">
                                <div>
                                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                    Sets
                                  </label>
                                  <input
                                    type="number"
                                    min="1"
                                    max="20"
                                    value={edits.target_sets}
                                    onChange={(e) =>
                                      handleFieldChange(
                                        ex.id,
                                        'target_sets',
                                        parseInt(e.target.value) || 1
                                      )
                                    }
                                    className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:border-emerald-500 outline-none"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                    Reps
                                  </label>
                                  <input
                                    type="text"
                                    value={edits.target_reps}
                                    onChange={(e) =>
                                      handleFieldChange(
                                        ex.id,
                                        'target_reps',
                                        e.target.value
                                      )
                                    }
                                    className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:border-emerald-500 outline-none"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                    Weight (kg)
                                  </label>
                                  <input
                                    type="number"
                                    step="0.5"
                                    value={edits.target_weight_kg}
                                    onChange={(e) =>
                                      handleFieldChange(
                                        ex.id,
                                        'target_weight_kg',
                                        parseFloat(e.target.value) || 0
                                      )
                                    }
                                    className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:border-emerald-500 outline-none"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                    Coaching Notes
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="Cues, tempo, RPE..."
                                    value={edits.coaching_notes}
                                    onChange={(e) =>
                                      handleFieldChange(
                                        ex.id,
                                        'coaching_notes',
                                        e.target.value
                                      )
                                    }
                                    className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:border-emerald-500 outline-none"
                                  />
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center gap-2 pt-2 lg:pt-0 justify-end">
                                <button
                                  type="button"
                                  disabled={isSaving}
                                  onClick={() => handleSaveExerciseTargets(ex.id)}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                    isSuccess
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white border border-emerald-200 dark:border-emerald-800'
                                  }`}
                                  title="Save target parameters"
                                >
                                  {isSuccess ? (
                                    <>
                                      <Check className="w-3.5 h-3.5" /> Saved
                                    </>
                                  ) : isSaving ? (
                                    'Saving...'
                                  ) : (
                                    <>
                                      <Save className="w-3.5 h-3.5" /> Save
                                    </>
                                  )}
                                </button>

                                <button
                                  type="button"
                                  disabled={isDeleting}
                                  onClick={() => handleDeleteExercise(ex.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                                  title="Remove from plan"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Exercise Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="p-6 bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between rounded-t-3xl">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Add Exercise to {targetDayLabel}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select a movement from the catalog and configure client targets.
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddExerciseSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Select Movement
                </label>
                <ExerciseCombobox
                  exercises={catalog}
                  selectedExerciseId={selectedCatalogId}
                  onSelect={(exercise) => setSelectedCatalogId(exercise.id)}
                  placeholder="Search movement or muscle group (e.g. Incline Bench)..."
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Target Sets
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="15"
                    value={newSets}
                    onChange={(e) => setNewSets(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Target Reps
                  </label>
                  <input
                    type="text"
                    value={newReps}
                    onChange={(e) => setNewReps(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={newWeight}
                    onChange={(e) => setNewWeight(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Coaching Notes / Form Cues
                </label>
                <input
                  type="text"
                  placeholder="e.g. Pause 2s at chest, RPE 8"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingExercise}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5"
                >
                  {addingExercise ? 'Adding...' : 'Add Movement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
