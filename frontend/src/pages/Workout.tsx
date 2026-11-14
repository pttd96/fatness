import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Flame,
  Save,
  Youtube,
  Info,
} from 'lucide-react'
import { api } from '../lib/api'
import { MOCK_CURRENT_PLAN } from '../lib/mockData'
import type { PlannedExerciseWithDetails, WeeklyPlanWithExercises } from '../types'

export function Workout() {
  const { dayIndex } = useParams<{ dayIndex: string }>()
  const navigate = useNavigate()

  const currentDayNum = parseInt(dayIndex || '1', 10)
  const [plan, setPlan] = useState<WeeklyPlanWithExercises | null>(null)
  const [logs, setLogs] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedSuccessId, setSavedSuccessId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        let loadedPlan: WeeklyPlanWithExercises
        try {
          loadedPlan = await api.plans.getCurrent()
        } catch {
          loadedPlan = MOCK_CURRENT_PLAN
        }

        setPlan(loadedPlan)

        const initialLogs: Record<string, string> = {}
        loadedPlan.exercises.forEach((ex) => {
          if (ex.actual_log) {
            initialLogs[ex.id] = ex.actual_log
          }
        })
        setLogs(initialLogs)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const dayExercises = (plan?.exercises.filter((ex) => ex.day_index === currentDayNum) || [])
    .slice()
    .sort((a, b) => (a.exercise_order || 0) - (b.exercise_order || 0))
  const dayLabel = dayExercises[0]?.day_label || `Day ${currentDayNum}`

  const allDayIndexes = Array.from(new Set(plan?.exercises.map((e) => e.day_index) || [])).sort((a, b) => a - b)
  const currentIdxPos = allDayIndexes.indexOf(currentDayNum)
  const prevDay = currentIdxPos > 0 ? allDayIndexes[currentIdxPos - 1] : null
  const nextDay = currentIdxPos < allDayIndexes.length - 1 ? allDayIndexes[currentIdxPos + 1] : null

  const handleLogChange = (exerciseId: string, val: string) => {
    setLogs((prev) => ({ ...prev, [exerciseId]: val }))
  }

  const handleSaveLog = async (exercise: PlannedExerciseWithDetails) => {
    const text = logs[exercise.id] || ''
    setSavingId(exercise.id)

    try {
      await api.logs.updateLog(exercise.id, text.trim() ? text : null)

      // Keep local plan state synced
      if (plan) {
        const updatedExercises = plan.exercises.map((e) =>
          e.id === exercise.id
            ? { ...e, actual_log: text, logged_at: new Date().toISOString() }
            : e
        )
        setPlan({ ...plan, exercises: updatedExercises })
      }

      setSavedSuccessId(exercise.id)
      setTimeout(() => setSavedSuccessId(null), 2500)
    } catch (err: any) {
      alert(`Failed to save log: ${err.message}`)
    } finally {
      setSavingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mr-3" />
        Loading workout session...
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Header & Day Nav */}
      <div className="flex items-center justify-between">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        {/* Previous / Next Day Quick Switcher */}
        <div className="flex items-center gap-2">
          {prevDay !== null && (
            <button
              onClick={() => navigate(`/workout/${prevDay}`)}
              className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-200 transition-all text-xs font-semibold flex items-center gap-1 shadow-xs"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Day {prevDay}
            </button>
          )}
          {nextDay !== null && (
            <button
              onClick={() => navigate(`/workout/${nextDay}`)}
              className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-200 transition-all text-xs font-semibold flex items-center gap-1 shadow-xs"
            >
              Day {nextDay} <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="inline-block px-3 py-0.5 rounded-md text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 mb-2">
          SESSION {currentDayNum}
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{dayLabel}</h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
          Perform your sets, record actual reps and weight, and note how each lift felt.
        </p>
      </div>

      {/* Exercises List */}
      <div className="space-y-6">
        {dayExercises.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-medium">
            No exercises scheduled for this day.
          </div>
        ) : (
          dayExercises.map((exercise, idx) => {
            const hasSaved = Boolean(exercise.actual_log?.trim())
            const isSaving = savingId === exercise.id
            const isJustSaved = savedSuccessId === exercise.id

            return (
              <div
                key={exercise.id}
                className={`rounded-3xl border transition-all p-6 sm:p-7 shadow-xs ${
                  hasSaved
                    ? 'bg-white dark:bg-slate-900 border-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-500/10'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                }`}
              >
                {/* Exercise Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3.5">
                    <span className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-sm font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        {exercise.exercise_name}
                        {hasSaved && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                            <Check className="w-3 h-3" /> Logged
                          </span>
                        )}
                      </h2>
                      <span className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                        {exercise.muscle_group}
                      </span>
                    </div>
                  </div>

                  {exercise.youtube_url && (
                    <a
                      href={exercise.youtube_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 transition-all self-start sm:self-auto"
                    >
                      <Youtube className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                      Watch Form Tutorial
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {/* Targets & Coaching Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4 py-3.5 px-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Target Sets × Reps</span>
                    <p className="text-base font-extrabold text-slate-900 dark:text-white font-mono mt-0.5">
                      {exercise.target_sets || '—'} sets × {exercise.target_reps || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Target Weight</span>
                    <p className="text-base font-extrabold text-emerald-700 dark:text-emerald-400 font-mono mt-0.5">
                      {exercise.target_weight_kg ? `${exercise.target_weight_kg} kg` : 'Bodyweight / Form'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Info className="w-3.5 h-3.5 text-slate-400" /> Coaching Cue
                    </span>
                    <p className="text-xs text-slate-700 dark:text-slate-300 italic mt-0.5 line-clamp-2">
                      {exercise.coaching_notes || 'Focus on controlled eccentric and clean form.'}
                    </p>
                  </div>
                </div>

                {/* Actual Performance Log Text Area */}
                <div className="space-y-2 mt-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-amber-500" />
                      Your Actual Performance & Remarks:
                    </label>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Freeform (e.g. 4x8 @ 82.5kg, felt easy)</span>
                  </div>

                  <textarea
                    rows={2}
                    value={logs[exercise.id] ?? ''}
                    onChange={(e) => handleLogChange(exercise.id, e.target.value)}
                    placeholder="e.g. Set 1: 10x80kg, Set 2: 9x80kg, Set 3: 8x80kg. Left shoulder felt 100% fine."
                    className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white placeholder-slate-400 text-sm outline-none transition-all resize-y shadow-2xs"
                  />

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      {exercise.logged_at ? `Last saved ${new Date(exercise.logged_at).toLocaleTimeString()}` : ''}
                    </span>

                    <button
                      onClick={() => handleSaveLog(exercise)}
                      disabled={isSaving}
                      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
                        isJustSaved
                          ? 'bg-emerald-600 text-white'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      }`}
                    >
                      {isSaving ? (
                        'Saving...'
                      ) : isJustSaved ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Saved!
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" /> Save Set Log
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
