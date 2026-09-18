export type Kloe = 'Safe' | 'Effective' | 'Caring' | 'Responsive' | 'Well-led'
export type RecordStatus = 'Compliant' | 'In progress' | 'Action required' | 'Overdue'
export type IncidentStatus = 'Open' | 'Investigating' | 'Closed'
export type Severity = 'Low' | 'Medium' | 'High' | 'Critical'

export interface ComplianceCheck {
  id: string
  title: string
  kloe: Kloe
  owner: string
  dueDate: string
  status: RecordStatus
  progress: number
}

export interface Resident {
  id: string
  name: string
  room: string
  dateOfBirth: string
  carePlan: string
  medication: string
  risk: 'Low' | 'Medium' | 'High'
  nextReview: string
  status: 'Active' | 'Hospital' | 'Respite'
}

export interface StaffMember {
  id: string
  name: string
  role: string
  employment: 'Permanent' | 'Bank' | 'Agency'
  dbsExpiry: string
  nextTraining: string
  supervisionDate: string
  completion: number
  status: 'Compliant' | 'Due soon' | 'Action required'
}

export interface Audit {
  id: string
  title: string
  kloe: Kloe
  auditor: string
  date: string
  status: 'Scheduled' | 'In progress' | 'Complete'
  score: number
  actions: number
}

export interface Incident {
  id: string
  reference: string
  type: string
  severity: Severity
  status: IncidentStatus
  location: string
  date: string
  time: string
  resident: string
  reporter: string
  summary: string
}

export interface Asset {
  id: string
  name: string
  category: 'Medical' | 'Safety' | 'Mobility' | 'Furniture'
  serial: string
  purchaseDate: string
  warrantyUntil: string
  lastService: string
  nextService: string
  condition: 'Excellent' | 'Good' | 'Fair' | 'Poor'
  status: 'Operational' | 'Service due' | 'Out of service'
  location: string
}

export interface HavenNotification {
  id: string
  title: string
  message: string
  type: 'Alert' | 'Warning' | 'Update'
  priority: 'High' | 'Medium' | 'Low'
  date: string
  read: boolean
}

export interface HavenData {
  complianceChecks: ComplianceCheck[]
  residents: Resident[]
  staff: StaffMember[]
  audits: Audit[]
  incidents: Incident[]
  assets: Asset[]
  notifications: HavenNotification[]
}
