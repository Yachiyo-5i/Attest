import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Gateway, Model, Profile, Protocol, Report, Run } from '../lib/types'

export function useModels(enabled = true) {
  return useQuery({ queryKey: ['models'], queryFn: () => api<Model[]>('/api/models'), staleTime: 5 * 60_000, enabled })
}

export function useGateways(enabled = true) {
  return useQuery({ queryKey: ['gateways'], queryFn: () => api<Gateway[]>('/api/gateways'), staleTime: 30_000, enabled })
}

export function useProfiles(enabled = true) {
  return useQuery({ queryKey: ['profiles'], queryFn: () => api<Profile[]>('/api/profiles'), staleTime: 10_000, enabled })
}

const hasActive = (runs?: Run[]) => runs?.some(run => run.status === 'queued' || run.status === 'running') ?? false

export function useRuns(enabled = true) {
  return useQuery({
    queryKey: ['runs'],
    queryFn: () => api<Run[]>('/api/runs'),
    refetchInterval: query => (hasActive(query.state.data) ? 3000 : false),
    enabled,
  })
}

export function useReport(runId: string | undefined) {
  return useQuery({
    queryKey: ['report', runId],
    queryFn: () => api<Report>(`/api/reports/${runId}`),
    enabled: Boolean(runId),
    refetchInterval: query => {
      const status = query.state.data?.run.status
      return status === 'queued' || status === 'running' ? 2000 : false
    },
  })
}

export function useCreateGateway() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { name: string; base_url: string; api_key: string }) =>
      api<Gateway>('/api/gateways', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gateways'] }),
  })
}

export function useUpdateGateway() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string; name?: string; base_url?: string; api_key?: string }) =>
      api<Gateway>(`/api/gateways/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gateways'] }),
  })
}

export function useDeleteGateway() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<{ deleted: string }>(`/api/gateways/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gateways'] }),
  })
}

export function useStartEnrollment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { model_id: string; protocol: Protocol; gateway_id: string; sample_count: number }) =>
      api<{ run_id: string }>('/api/enrollments', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runs'] })
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
    },
  })
}

export function useStartAudit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { profile_id: string; suspect_base_url: string; suspect_api_key: string; suspect_model_id?: string; suspect_path?: string; label?: string; sample_count: number }) =>
      api<{ run_id: string }>('/api/audits', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['runs'] }),
  })
}

export function useCancelRun() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (runId: string) => api<{ run_id: string; status: string }>(`/api/runs/${runId}/cancel`, { method: 'POST' }),
    onSuccess: (_data, runId) => {
      queryClient.invalidateQueries({ queryKey: ['runs'] })
      queryClient.invalidateQueries({ queryKey: ['report', runId] })
    },
  })
}

export function useDeleteRun() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (runId: string) => api<{ deleted: string; profile_deleted: boolean }>(`/api/runs/${runId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runs'] })
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
    },
  })
}
