import { Overlay } from './views/Overlay'
import { ControlCenter } from './views/ControlCenter'

export function App() {
  const route = window.location.hash.replace('#/', '') || 'control'
  return route === 'overlay' ? <Overlay /> : <ControlCenter />
}
