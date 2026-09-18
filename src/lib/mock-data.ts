import type { HavenData } from '@/lib/types'

export const initialData: HavenData = {
  complianceChecks: [
    {
      id: 'CHK-1048',
      title: 'Medication administration records',
      kloe: 'Safe',
      owner: 'Amelia Wright',
      dueDate: '2026-09-19',
      status: 'Action required',
      progress: 88
    },
    {
      id: 'CHK-1047',
      title: 'Care plan quality review',
      kloe: 'Effective',
      owner: 'Jack Thompson',
      dueDate: '2026-09-23',
      status: 'In progress',
      progress: 92
    },
    {
      id: 'CHK-1046',
      title: 'Resident dignity observations',
      kloe: 'Caring',
      owner: 'Priya Shah',
      dueDate: '2026-09-25',
      status: 'Compliant',
      progress: 100
    },
    {
      id: 'CHK-1045',
      title: 'Activities and feedback review',
      kloe: 'Responsive',
      owner: 'Sophie Martin',
      dueDate: '2026-10-02',
      status: 'In progress',
      progress: 85
    },
    {
      id: 'CHK-1044',
      title: 'Governance meeting actions',
      kloe: 'Well-led',
      owner: 'Olivia Bennett',
      dueDate: '2026-09-16',
      status: 'Overdue',
      progress: 87
    },
    {
      id: 'CHK-1043',
      title: 'Fire door weekly inspection',
      kloe: 'Safe',
      owner: 'Daniel Hughes',
      dueDate: '2026-09-27',
      status: 'Compliant',
      progress: 100
    }
  ],
  residents: [
    {
      id: 'RES-204',
      name: 'Margaret Wilson',
      room: '12A',
      dateOfBirth: '1938-02-17',
      carePlan: 'Up to date',
      medication: 'Reviewed',
      risk: 'Medium',
      nextReview: '2026-09-22',
      status: 'Active'
    },
    {
      id: 'RES-203',
      name: 'Arthur Davies',
      room: '8',
      dateOfBirth: '1941-11-03',
      carePlan: 'Review due',
      medication: 'Reviewed',
      risk: 'High',
      nextReview: '2026-09-20',
      status: 'Active'
    },
    {
      id: 'RES-202',
      name: 'Eileen Patel',
      room: '21',
      dateOfBirth: '1935-06-24',
      carePlan: 'Up to date',
      medication: 'Review due',
      risk: 'Low',
      nextReview: '2026-10-04',
      status: 'Active'
    },
    {
      id: 'RES-201',
      name: 'George Evans',
      room: '5B',
      dateOfBirth: '1940-01-15',
      carePlan: 'Up to date',
      medication: 'Reviewed',
      risk: 'Medium',
      nextReview: '2026-09-29',
      status: 'Hospital'
    },
    {
      id: 'RES-200',
      name: 'Joan Clarke',
      room: '17',
      dateOfBirth: '1932-09-08',
      carePlan: 'Up to date',
      medication: 'Reviewed',
      risk: 'Low',
      nextReview: '2026-10-12',
      status: 'Active'
    },
    {
      id: 'RES-199',
      name: 'Brian Morgan',
      room: '3',
      dateOfBirth: '1944-04-21',
      carePlan: 'Review due',
      medication: 'Reviewed',
      risk: 'Medium',
      nextReview: '2026-09-24',
      status: 'Respite'
    }
  ],
  staff: [
    {
      id: 'STF-088',
      name: 'Amelia Wright',
      role: 'Deputy Manager',
      employment: 'Permanent',
      dbsExpiry: '2028-03-14',
      nextTraining: '2026-10-18',
      supervisionDate: '2026-09-28',
      completion: 100,
      status: 'Compliant'
    },
    {
      id: 'STF-087',
      name: 'Jack Thompson',
      role: 'Senior Care Assistant',
      employment: 'Permanent',
      dbsExpiry: '2027-08-09',
      nextTraining: '2026-09-21',
      supervisionDate: '2026-09-25',
      completion: 84,
      status: 'Due soon'
    },
    {
      id: 'STF-086',
      name: 'Priya Shah',
      role: 'Registered Nurse',
      employment: 'Permanent',
      dbsExpiry: '2029-01-22',
      nextTraining: '2026-11-03',
      supervisionDate: '2026-10-01',
      completion: 96,
      status: 'Compliant'
    },
    {
      id: 'STF-085',
      name: 'Daniel Hughes',
      role: 'Maintenance Lead',
      employment: 'Permanent',
      dbsExpiry: '2027-05-11',
      nextTraining: '2026-09-19',
      supervisionDate: '2026-09-30',
      completion: 68,
      status: 'Action required'
    },
    {
      id: 'STF-084',
      name: 'Sophie Martin',
      role: 'Activities Coordinator',
      employment: 'Bank',
      dbsExpiry: '2028-12-02',
      nextTraining: '2026-10-22',
      supervisionDate: '2026-10-04',
      completion: 88,
      status: 'Due soon'
    },
    {
      id: 'STF-083',
      name: 'Helen Brooks',
      role: 'Care Assistant',
      employment: 'Agency',
      dbsExpiry: '2027-10-16',
      nextTraining: '2026-11-12',
      supervisionDate: '2026-10-09',
      completion: 92,
      status: 'Compliant'
    }
  ],
  audits: [
    {
      id: 'AUD-341',
      title: 'Monthly medicines audit',
      kloe: 'Safe',
      auditor: 'Priya Shah',
      date: '2026-09-20',
      status: 'Scheduled',
      score: 0,
      actions: 0
    },
    {
      id: 'AUD-340',
      title: 'Nutrition and hydration',
      kloe: 'Effective',
      auditor: 'Amelia Wright',
      date: '2026-09-15',
      status: 'Complete',
      score: 94,
      actions: 2
    },
    {
      id: 'AUD-339',
      title: 'Dignity and privacy',
      kloe: 'Caring',
      auditor: 'Olivia Bennett',
      date: '2026-09-12',
      status: 'Complete',
      score: 97,
      actions: 1
    },
    {
      id: 'AUD-338',
      title: 'Complaints handling',
      kloe: 'Responsive',
      auditor: 'Sophie Martin',
      date: '2026-09-08',
      status: 'In progress',
      score: 76,
      actions: 3
    },
    {
      id: 'AUD-337',
      title: 'Quality governance',
      kloe: 'Well-led',
      auditor: 'Olivia Bennett',
      date: '2026-08-29',
      status: 'Complete',
      score: 91,
      actions: 2
    }
  ],
  incidents: [
    {
      id: 'INC-2026-118',
      reference: 'INC-2026-118',
      type: 'Fall',
      severity: 'Medium',
      status: 'Investigating',
      location: 'First floor corridor',
      date: '2026-09-17',
      time: '19:35',
      resident: 'Arthur Davies',
      reporter: 'Jack Thompson',
      summary: 'Unwitnessed fall with no visible injury; observations commenced.'
    },
    {
      id: 'INC-2026-117',
      reference: 'INC-2026-117',
      type: 'Medication',
      severity: 'High',
      status: 'Open',
      location: 'Treatment room',
      date: '2026-09-16',
      time: '08:10',
      resident: 'Eileen Patel',
      reporter: 'Priya Shah',
      summary: 'Morning dose omitted and escalated to GP and home manager.'
    },
    {
      id: 'INC-2026-116',
      reference: 'INC-2026-116',
      type: 'Safeguarding',
      severity: 'Critical',
      status: 'Investigating',
      location: 'Lounge',
      date: '2026-09-14',
      time: '15:20',
      resident: 'Margaret Wilson',
      reporter: 'Amelia Wright',
      summary: 'Concern recorded and local safeguarding process initiated.'
    },
    {
      id: 'INC-2026-115',
      reference: 'INC-2026-115',
      type: 'Behaviour',
      severity: 'Low',
      status: 'Closed',
      location: 'Dining room',
      date: '2026-09-10',
      time: '12:45',
      resident: 'George Evans',
      reporter: 'Helen Brooks',
      summary: 'Distress during lunch resolved with reassurance and care-plan review.'
    },
    {
      id: 'INC-2026-114',
      reference: 'INC-2026-114',
      type: 'Skin integrity',
      severity: 'Medium',
      status: 'Closed',
      location: 'Room 17',
      date: '2026-09-05',
      time: '07:30',
      resident: 'Joan Clarke',
      reporter: 'Priya Shah',
      summary: 'Early pressure-area redness reviewed and preventative plan updated.'
    }
  ],
  assets: [
    {
      id: 'AST-142',
      name: 'Oxford Journey Hoist',
      category: 'Mobility',
      serial: 'OXJ-42918',
      purchaseDate: '2024-03-12',
      warrantyUntil: '2027-03-11',
      lastService: '2026-03-10',
      nextService: '2026-09-24',
      condition: 'Good',
      status: 'Service due',
      location: 'First floor equipment bay'
    },
    {
      id: 'AST-141',
      name: 'Philips HeartStart AED',
      category: 'Medical',
      serial: 'PH-AED-80142',
      purchaseDate: '2025-01-20',
      warrantyUntil: '2030-01-19',
      lastService: '2026-07-18',
      nextService: '2027-01-18',
      condition: 'Excellent',
      status: 'Operational',
      location: 'Main reception'
    },
    {
      id: 'AST-140',
      name: 'Fire panel – addressable',
      category: 'Safety',
      serial: 'FP-AC-2207',
      purchaseDate: '2022-06-14',
      warrantyUntil: '2027-06-13',
      lastService: '2026-08-28',
      nextService: '2027-02-28',
      condition: 'Good',
      status: 'Operational',
      location: 'Ground floor office'
    },
    {
      id: 'AST-139',
      name: 'Profiling bed',
      category: 'Furniture',
      serial: 'PB-90231',
      purchaseDate: '2021-11-05',
      warrantyUntil: '2026-11-04',
      lastService: '2026-04-02',
      nextService: '2026-10-02',
      condition: 'Fair',
      status: 'Operational',
      location: 'Room 8'
    },
    {
      id: 'AST-138',
      name: 'Portable suction unit',
      category: 'Medical',
      serial: 'SU-77102',
      purchaseDate: '2023-09-16',
      warrantyUntil: '2026-09-15',
      lastService: '2025-09-16',
      nextService: '2026-09-16',
      condition: 'Poor',
      status: 'Out of service',
      location: 'Clinical store'
    }
  ],
  notifications: [
    {
      id: 'NTF-51',
      title: 'Medication incident requires review',
      message: 'INC-2026-117 is awaiting manager review and duty-of-candour assessment.',
      type: 'Alert',
      priority: 'High',
      date: '2026-09-18T08:42:00',
      read: false
    },
    {
      id: 'NTF-50',
      title: 'Hoist service due in 6 days',
      message: 'Oxford Journey Hoist in the first floor equipment bay requires service.',
      type: 'Warning',
      priority: 'Medium',
      date: '2026-09-18T07:15:00',
      read: false
    },
    {
      id: 'NTF-49',
      title: 'DBS and training review',
      message: 'Two staff compliance items are due before the end of September.',
      type: 'Warning',
      priority: 'Medium',
      date: '2026-09-17T16:20:00',
      read: false
    },
    {
      id: 'NTF-48',
      title: 'Audit completed',
      message: 'Nutrition and hydration audit completed with a 94% score.',
      type: 'Update',
      priority: 'Low',
      date: '2026-09-15T14:05:00',
      read: true
    },
    {
      id: 'NTF-47',
      title: 'Governance action overdue',
      message: 'Governance meeting actions were due on 16 September.',
      type: 'Alert',
      priority: 'High',
      date: '2026-09-16T09:00:00',
      read: false
    }
  ]
}

export const complianceTrend = [
  { month: 'Apr', overall: 84, safe: 81, effective: 86 },
  { month: 'May', overall: 86, safe: 84, effective: 87 },
  { month: 'Jun', overall: 88, safe: 87, effective: 89 },
  { month: 'Jul', overall: 89, safe: 88, effective: 91 },
  { month: 'Aug', overall: 91, safe: 90, effective: 92 },
  { month: 'Sep', overall: 92, safe: 91, effective: 94 }
]

export const incidentTrend = [
  { month: 'Apr', incidents: 8, closed: 7 },
  { month: 'May', incidents: 6, closed: 6 },
  { month: 'Jun', incidents: 7, closed: 5 },
  { month: 'Jul', incidents: 5, closed: 5 },
  { month: 'Aug', incidents: 9, closed: 8 },
  { month: 'Sep', incidents: 5, closed: 2 }
]

export const kloeScores = [
  { name: 'Safe', score: 91, colour: '#2563eb' },
  { name: 'Effective', score: 94, colour: '#0ea5e9' },
  { name: 'Caring', score: 97, colour: '#8b5cf6' },
  { name: 'Responsive', score: 89, colour: '#14b8a6' },
  { name: 'Well-led', score: 90, colour: '#f59e0b' }
]
