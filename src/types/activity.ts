export type ActivityEvent = {
  id: string
  at: string
  action: string
  detail: string
  status: 'info' | 'success' | 'warning' | 'error'
}
