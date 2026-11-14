import { useEffect, useState } from 'react'
import {
  BookOpen,
  Edit2,
  ExternalLink,
  Filter,
  Plus,
  Search,
  Trash2,
  X,
  Youtube,
  Dumbbell,
  Check,
  Shield,
} from 'lucide-react'
import { api } from '../lib/api'
import { MOCK_EXERCISES } from '../lib/mockData'
import type { Exercise, MuscleGroup } from '../types'
import { useAuth } from '../hooks/useAuth'

const MUSCLE_GROUPS: { label: string; value: MuscleGroup | 'all' }[] = [
  { label: 'All Muscles', value: 'all' },
  { label: 'Chest', value: 'chest' },
  { label: 'Back', value: 'back' },
  { label: 'Shoulders', value: 'shoulders' },
  { label: 'Legs', value: 'legs' },
  { label: 'Arms', value: 'arms' },
  { label: 'Core', value: 'core' },
]

export function ExerciseCatalog() {
  const { isCoach } = useAuth()
  const [exercises, setExercises] = useState<Exercise[]>(MOCK_EXERCISES)
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null)
  const [formName, setFormName] = useState('')
  const [formMuscle, setFormMuscle] = useState<MuscleGroup>('chest')
  const [formDescription, setFormDescription] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formYoutube, setFormYoutube] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchExercises() {
      try {
        setLoading(true)
        const data = await api.exercises.list()
        if (data && data.length > 0) {
          setExercises(data)
        } else {
          setExercises(MOCK_EXERCISES)
        }
      } catch {
        setExercises(MOCK_EXERCISES)
      } finally {
        setLoading(false)
      }
    }

    fetchExercises()
  }, [])

  const openCreateModal = () => {
    if (!isCoach) return
    setEditingExercise(null)
    setFormName('')
    setFormMuscle(selectedMuscle !== 'all' ? selectedMuscle : 'chest')
    setFormDescription('')
    setFormNotes('')
    setFormYoutube('')
    setIsModalOpen(true)
  }

  const openEditModal = (ex: Exercise) => {
    if (!isCoach) return
    setEditingExercise(ex)
    setFormName(ex.name)
    setFormMuscle(ex.muscle_group as MuscleGroup)
    setFormDescription(ex.description || '')
    setFormNotes(ex.notes || '')
    setFormYoutube(ex.youtube_url || '')
    setIsModalOpen(true)
  }

  const handleSaveExercise = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim() || !isCoach) return

    setIsSubmitting(true)
    try {
      if (editingExercise) {
        const updated = await api.exercises.update(editingExercise.id, {
          name: formName.trim(),
          muscle_group: formMuscle,
          description: formDescription.trim() || null,
          notes: formNotes.trim() || null,
          youtube_url: formYoutube.trim() || null,
        })
        setExercises((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item))
        )
      } else {
        const created = await api.exercises.create({
          name: formName.trim(),
          muscle_group: formMuscle,
          description: formDescription.trim() || null,
          notes: formNotes.trim() || null,
          youtube_url: formYoutube.trim() || null,
        })
        setExercises((prev) => [created, ...prev])
      }
      setIsModalOpen(false)
    } catch (err: any) {
      alert(`Error saving exercise: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteExercise = async (ex: Exercise) => {
    if (!isCoach) return
    const confirmed = window.confirm(
      `Are you sure you want to delete "${ex.name}"? This will remove it from the catalog.`
    )
    if (!confirmed) return

    setDeletingId(ex.id)
    try {
      await api.exercises.delete(ex.id)
      setExercises((prev) => prev.filter((item) => item.id !== ex.id))
    } catch (err: any) {
      alert(`Error deleting exercise: ${err.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  const filtered = exercises.filter((ex) => {
    const matchesMuscle = selectedMuscle === 'all' || ex.muscle_group === selectedMuscle
    const matchesSearch =
      ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ex.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ex.muscle_group.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesMuscle && matchesSearch
  })

  return (
    <div className="space-y-6 pb-20 max-w-6xl mx-auto">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            Exercise Catalog & Library
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
            Explore movement mechanics, proper execution cues, and form video tutorials.
          </p>
        </div>

        {!isCoach && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-semibold border border-slate-200 dark:border-slate-700 self-start sm:self-auto">
            <Shield className="w-3.5 h-3.5 text-slate-400" />
            <span>Library (View-Only)</span>
          </div>
        )}
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
        {/* Search + Create Button Group */}
        <div className="flex items-center gap-3 flex-1 max-w-lg">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search exercises by name or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-500 outline-none transition-all shadow-2xs"
            />
          </div>

          {/* Create Button: Only visible to Coaches */}
          {isCoach && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-sm transition-all flex-shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              New Exercise
            </button>
          )}
        </div>

        {/* Muscle group filter pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
          <Filter className="w-3.5 h-3.5 text-slate-400 mr-1 flex-shrink-0" />
          {MUSCLE_GROUPS.map((mg) => (
            <button
              key={mg.value}
              onClick={() => setSelectedMuscle(mg.value)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shadow-xs ${
                selectedMuscle === mg.value
                  ? 'bg-emerald-600 text-white border border-emerald-600'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              {mg.label}
            </button>
          ))}
        </div>
      </div>

      {/* Exercise Cards Grid */}
      {loading ? (
        <div className="text-center py-20 text-slate-500 dark:text-slate-400">Loading exercise library...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-sm font-medium space-y-3">
          <p>No exercises found matching your criteria.</p>
          {isCoach && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold hover:bg-emerald-600 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Create "{searchQuery || 'New Exercise'}"
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((ex) => (
            <div
              key={ex.id}
              className="flex flex-col justify-between rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 p-6 transition-all group shadow-xs hover:shadow-lg relative"
            >
              <div>
                {/* Top Badge & Action Icons */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                    {ex.muscle_group}
                  </span>

                  {/* Actions: Edit & Delete (Coach Only) + Video (All) */}
                  <div className="flex items-center gap-1">
                    {ex.youtube_url && (
                      <a
                        href={ex.youtube_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 p-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                        title="Watch tutorial"
                      >
                        <Youtube className="w-4 h-4" />
                      </a>
                    )}
                    {isCoach && (
                      <>
                        <button
                          onClick={() => openEditModal(ex)}
                          className="text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors"
                          title="Edit exercise"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteExercise(ex)}
                          disabled={deletingId === ex.id}
                          className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                          title="Delete exercise"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                  {ex.name}
                </h3>

                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 line-clamp-3 leading-relaxed">
                  {ex.description || 'Compound or isolation movement targeting primary muscle groups.'}
                </p>

                {ex.notes && (
                  <div className="mt-3.5 p-3 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 text-[11px] text-slate-700 dark:text-slate-300">
                    <span className="font-bold text-emerald-800 dark:text-emerald-400">Pro Tip: </span>
                    {ex.notes}
                  </div>
                )}
              </div>

              {ex.youtube_url && (
                <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <a
                    href={ex.youtube_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                  >
                    Watch form video <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Exercise Modal Popup (Coach Only) */}
      {isModalOpen && isCoach && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                  <Dumbbell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {editingExercise ? 'Edit Exercise' : 'Create New Exercise'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {editingExercise
                      ? 'Update exercise details and mechanics'
                      : 'Add a new movement to your training library'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveExercise} className="p-6 space-y-4">
              {/* Exercise Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Exercise Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Incline Dumbbell Press"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-700 focus:border-emerald-500 outline-none transition-all"
                />
              </div>

              {/* Muscle Group Select */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Primary Muscle Group *
                </label>
                <select
                  value={formMuscle}
                  onChange={(e) => setFormMuscle(e.target.value as MuscleGroup)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-700 focus:border-emerald-500 outline-none transition-all capitalize"
                >
                  {MUSCLE_GROUPS.filter((m) => m.value !== 'all').map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Briefly describe setup and biomechanics..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-700 focus:border-emerald-500 outline-none transition-all resize-none"
                />
              </div>

              {/* Pro Tip Notes */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Form Cues / Pro Tips
                </label>
                <input
                  type="text"
                  placeholder="e.g. Retract scapula, 3-second eccentric tempo"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-700 focus:border-emerald-500 outline-none transition-all"
                />
              </div>

              {/* YouTube Link */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  YouTube Tutorial Link
                </label>
                <input
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={formYoutube}
                  onChange={(e) => setFormYoutube(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-700 focus:border-emerald-500 outline-none transition-all"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    'Saving...'
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      {editingExercise ? 'Update Exercise' : 'Save Movement'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
