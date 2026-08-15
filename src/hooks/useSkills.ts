import { useEffect, useState } from 'react'
import type { SkillsSnapshot } from '../types'

const emptySnapshot: SkillsSnapshot = { loaded: false, error: null, pack: null, skills: [] }

export function useSkills() {
  const [snapshot, setSnapshot] = useState<SkillsSnapshot>(emptySnapshot)

  useEffect(() => {
    window.rata.getSkills().then(setSnapshot).catch(() => setSnapshot(emptySnapshot))
  }, [])

  return snapshot
}
