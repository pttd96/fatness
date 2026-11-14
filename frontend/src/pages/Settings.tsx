import { useState, useEffect } from 'react'
import { Check, Flame, Save, Settings as SettingsIcon, User } from 'lucide-react'
import { api } from '../lib/api'
import type { FitnessLevel, Goal, SplitType } from '../types'
import { useAuth } from '../hooks/useAuth'

export function Settings() {
  const { user, role, refreshProfile } = useAuth()
  const [displayName, setDisplayName] = useState('Athlete')
  const [fitnessLevel, setFitnessLevel] = useState<FitnessLevel>('intermediate')
  const [goal, setGoal] = useState<Goal>('hypertrophy')
  const [splitType, setSplitType] = useState<SplitType>('push_pull_legs')
  const [trainingDays, setTrainingDays] = useState(4)
  const [equipmentNotes, setEquipmentNotes] = useState('Full commercial gym with barbells, dumbbells, cables')
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const profile = await api.profile.get()
        if (profile) {
          setDisplayName(profile.display_name || 'Athlete')
          setFitnessLevel(profile.fitness_level || 'intermediate')
          setGoal(profile.goal || 'hypertrophy')
          setSplitType(profile.split_type || 'push_pull_legs')
          setTrainingDays(profile.training_days_per_week || 4)
          if (profile.preferences?.equipment) {
            setEquipmentNotes(profile.preferences.equipment)
          }
        }
      } catch {
        // If no profile yet, use defaults
      }
    }
    load()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.profile.update({
        display_name: displayName,
        fitness_level: fitnessLevel,
        goal,
        split_type: splitType,
        training_days_per_week: trainingDays,
        preferences: { equipment: equipmentNotes },
      })
      await refreshProfile()
      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 2500)
    } catch (err: any) {
      alert(`Failed to save settings: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
          <SettingsIcon className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          User Profile & Training Preferences
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
          Tailor your fitness goals and default training parameters.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Personal Info
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-medium focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-700 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Account & Role
              </label>
              <div className="px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-sm flex items-center justify-between gap-2">
                <span className="text-slate-800 dark:text-slate-200 font-semibold text-xs truncate">
                  {user?.email || 'Authenticated User'}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    role === 'COACH'
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {role}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Flame className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Fitness Target & Style
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Fitness Level
              </label>
              <select
                value={fitnessLevel}
                onChange={(e) => setFitnessLevel(e.target.value as FitnessLevel)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-semibold focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-700 outline-none capitalize"
              >
                <option value="beginner">Beginner (&lt;1 year)</option>
                <option value="intermediate">Intermediate (1-3 years)</option>
                <option value="advanced">Advanced (3+ years)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Primary Goal
              </label>
              <select
                value={goal}
                onChange={(e) => setGoal(e.target.value as Goal)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-semibold focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-700 outline-none capitalize"
              >
                <option value="strength">Strength (Heavy triples/fives)</option>
                <option value="hypertrophy">Hypertrophy (Muscle growth)</option>
                <option value="endurance">Endurance & Conditioning</option>
                <option value="general">General Fitness & Health</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Preferred Split
              </label>
              <select
                value={splitType}
                onChange={(e) => setSplitType(e.target.value as SplitType)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-semibold focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-700 outline-none"
              >
                <option value="push_pull_legs">Push - Pull - Legs</option>
                <option value="upper_lower">Upper - Lower</option>
                <option value="bro_split">Bro Split (1 muscle/day)</option>
                <option value="full_body">Full Body</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Training Days / Week ({trainingDays} days)
              </label>
              <input
                type="range"
                min="1"
                max="7"
                value={trainingDays}
                onChange={(e) => setTrainingDays(parseInt(e.target.value))}
                className="w-full accent-emerald-600"
              />
              <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono font-bold">
                <span>1</span>
                <span>2</span>
                <span>3</span>
                <span>4</span>
                <span>5</span>
                <span>6</span>
                <span>7</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Equipment & Health Notes
              </label>
              <input
                type="text"
                value={equipmentNotes}
                onChange={(e) => setEquipmentNotes(e.target.value)}
                placeholder="e.g. Dumbbells, barbell, bench, no leg press machine"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-medium focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-700 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition-all"
          >
            {saving ? (
              'Saving...'
            ) : savedSuccess ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" /> Saved Successfully!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Save Profile Preferences
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
