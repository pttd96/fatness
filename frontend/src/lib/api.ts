import { supabase } from './supabase'
import type {
  AddExerciseToDayRequest,
  ClientLookupResponse,
  CreatePlanRequest,
  Exercise,
  MuscleGroup,
  PlannedExerciseWithDetails,
  PlanSummary,
  UpdatePlannedExerciseTargets,
  UserProfile,
  WeeklyPlanWithExercises,
} from '../types'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080'

async function getAuthHeader(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeader()
  const url = `${BACKEND_URL}${path.startsWith('/') ? path : `/${path}`}`

  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  })

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`
    try {
      const errorJson = await response.json()
      if (errorJson.error) {
        errorMessage = errorJson.error
      } else if (errorJson.message) {
        errorMessage = errorJson.message
      }
    } catch {
      // Non-json response
    }
    throw new Error(errorMessage)
  }

  if (response.status === 204) {
    return {} as T
  }

  return response.json()
}

export const api = {
  profile: {
    get: () => apiFetch<UserProfile>('/profile'),
    create: (data: Partial<UserProfile>) =>
      apiFetch<UserProfile>('/profile', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (data: Partial<UserProfile>) =>
      apiFetch<UserProfile>('/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  exercises: {
    list: (muscleGroup?: MuscleGroup | string) => {
      const query = muscleGroup && muscleGroup !== 'all' ? `?muscle_group=${encodeURIComponent(muscleGroup)}` : ''
      return apiFetch<Exercise[]>(`/exercises${query}`)
    },
    get: (id: string) => apiFetch<Exercise>(`/exercises/${id}`),
    create: (data: {
      name: string
      muscle_group: string
      description?: string | null
      notes?: string | null
      youtube_url?: string | null
    }) =>
      apiFetch<Exercise>('/exercises', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (
      id: string,
      data: {
        name?: string
        muscle_group?: string
        description?: string | null
        notes?: string | null
        youtube_url?: string | null
      }
    ) =>
      apiFetch<Exercise>(`/exercises/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      apiFetch<void>(`/exercises/${id}`, {
        method: 'DELETE',
      }),
  },

  plans: {
    getCurrent: () => apiFetch<WeeklyPlanWithExercises>('/plans/current'),
    get: (id: string) => apiFetch<WeeklyPlanWithExercises>(`/plans/${id}`),
    list: (page = 1, perPage = 10) =>
      apiFetch<PlanSummary[]>(`/plans?page=${page}&per_page=${perPage}`),
    create: (plan: CreatePlanRequest) =>
      apiFetch<WeeklyPlanWithExercises>('/plans', {
        method: 'POST',
        body: JSON.stringify(plan),
      }),
    addExercise: (planId: string, exercise: Partial<PlannedExerciseWithDetails> & { exercise_id: string; day_label: string; day_index: number; exercise_order?: number }) =>
      apiFetch<PlannedExerciseWithDetails>(`/plans/${planId}/exercises`, {
        method: 'POST',
        body: JSON.stringify(exercise),
      }),
    delete: (id: string) =>
      apiFetch<void>(`/plans/${id}`, {
        method: 'DELETE',
      }),
    generate: () =>
      apiFetch<{ message: string }>('/plans/generate', {
        method: 'POST',
      }),
  },

  logs: {
    updateLog: (plannedExerciseId: string, actualLog: string | null) =>
      apiFetch<PlannedExerciseWithDetails>(
        `/planned-exercises/${plannedExerciseId}/log`,
        {
          method: 'PATCH',
          body: JSON.stringify({ actual_log: actualLog }),
        }
      ),
    deletePlannedExercise: (plannedExerciseId: string) =>
      apiFetch<void>(`/planned-exercises/${plannedExerciseId}`, {
        method: 'DELETE',
      }),
  },

  coach: {
    lookupClient: (email: string) =>
      apiFetch<ClientLookupResponse>(
        `/coach/clients/lookup?email=${encodeURIComponent(email)}`
      ),
    createOrUpdatePlan: (clientId: string, plan: CreatePlanRequest) =>
      apiFetch<WeeklyPlanWithExercises>(`/coach/clients/${clientId}/plan`, {
        method: 'POST',
        body: JSON.stringify(plan),
      }),
    addExerciseToDay: (clientId: string, data: AddExerciseToDayRequest) =>
      apiFetch<PlannedExerciseWithDetails>(
        `/coach/clients/${clientId}/plan/exercises`,
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      ),
    updatePlannedExercise: (
      clientId: string,
      plannedExerciseId: string,
      data: UpdatePlannedExerciseTargets
    ) =>
      apiFetch<PlannedExerciseWithDetails>(
        `/coach/clients/${clientId}/planned-exercises/${plannedExerciseId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(data),
        }
      ),
    deletePlannedExercise: (clientId: string, plannedExerciseId: string) =>
      apiFetch<void>(
        `/coach/clients/${clientId}/planned-exercises/${plannedExerciseId}`,
        {
          method: 'DELETE',
        }
      ),
  },
}
