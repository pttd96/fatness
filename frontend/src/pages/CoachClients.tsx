import React, { useState, useEffect } from 'react'
import {
  Search,
  User,
  Calendar,
  Plus,
  Trash2,
  Save,
  Check,
  AlertCircle,
  ExternalLink,
  X,
} from 'lucide-react'
import { api } from '../lib/api'
import type {
  ClientLookupResponse,
  Exercise,
  PlannedExerciseWithDetails,
} from '../types'

export function CoachClients() {
  const [searchEmail, setSearchEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [clientData, setClientData] = useState<ClientLookupResponse | null>(null)

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

  const handleLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = searchEmail.trim()
    if (!trimmed) return

    setLoading(true)
    setLookupError(null)
    setClientData(null)
    setExerciseEdits({})

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

  const sortedDayIndices = Object.keys(groupedExercises)
    .map(Number)
    .sort((a, b) => a - b)

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
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-600" />
                  Active Weekly Plan & Planned Exercises
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {clientData.active_plan
                    ? `Week of ${clientData.active_plan.week_start} • Split: ${clientData.active_plan.split_type.replace(/_/g, ' ')}`
                    : 'No active plan currently scheduled for this client.'}
                </p>
              </div>
            </div>

            {!clientData.active_plan || sortedDayIndices.length === 0 ? (
              <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 space-y-2">
                <p className="font-semibold text-sm">This client currently has no active workout plan.</p>
                <p className="text-xs">Once the client generates or selects a plan, their workout schedule will appear here for you to coach and adjust.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {sortedDayIndices.map((dayIdx) => {
                  const dayExercises = groupedExercises[dayIdx]
                  const dayLabel = dayExercises[0]?.day_label || `Day ${dayIdx}`

                  return (
                    <div
                      key={dayIdx}
                      className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs"
                    >
                      {/* Day Header */}
                      <div className="p-5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                            {dayIdx}
                          </span>
                          <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                            {dayLabel}
                          </h4>
                          <span className="text-xs font-semibold text-slate-400">
                            ({dayExercises.length} movement{dayExercises.length === 1 ? '' : 's'})
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => openAddModal(dayIdx, dayLabel)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-emerald-600 dark:hover:bg-emerald-600 text-white text-xs font-bold transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Movement
                        </button>
                      </div>

                      {/* Day Exercise Rows */}
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
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6 bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
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
                <select
                  value={selectedCatalogId}
                  onChange={(e) => setSelectedCatalogId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:border-emerald-500 outline-none"
                >
                  {catalog.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.muscle_group})
                    </option>
                  ))}
                </select>
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
