import { useEffect, useState } from 'react'
import type { ActivityEvent } from '../types'

export function useActivity() {
  const [activity, setActivity] = useState<ActivityEvent[]>([])

  useEffect(() => {
    window.rata.getActivity().then(setActivity)
    return window.rata.onActivity(event => {
      setActivity(current => [event, ...current].slice(0, 100))
    })
  }, [])

  return activity
}
