# Rata Character Assets

The renderer character engine lives in `src/components/character/`. It consumes agent `CharacterState` only. It does not choose tools, approve actions, or talk to Electron.

## Runtime states

These states are driven by agent events:

- `idle`
- `listening`
- `thinking`
- `awaiting_approval`
- `working` (also used for typing)
- `success`
- `error`
- `sleeping`

Place one transparent asset per state under `public/character/<state>.svg` (or `.webp` / `.webm` later). The catalog is `src/components/character/states.json`. Until those production files exist, the engine shows the original concept-sheet crop from `public/rata-concept.png` for every state. Unknown states map to `idle`. If the image is missing or fails to load, the engine shows a letter-mark silhouette and keeps the resolved state class. The renderer must not start sleeping or other states on a timer; those remain agent events.

The files currently in `public/character/` are **placeholders**, not production art. Remove `temporaryArt` from the catalog when replacing them in place; do not put tool logic in the animation.

## Later animation set

Optional extra clips can be added later without changing the agent runtime:

- idle-blink
- wave
- glasses-on
- coffee
- confused
- warning
- walking-left
- walking-right
- dragging

## Five-second working animation

A useful early production asset is: put the cup down, put on glasses and type on a laptop. Map it to `working`.

## Requirements

- preserve character proportions and clothing
- transparent background
- seamless idle loop
- keep visible bounds reasonably consistent between states
- character engine decides presentation; animation never decides tool behaviour
