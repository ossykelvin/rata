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

Place one transparent asset per state under `public/character/`. The catalog is `src/components/character/states.json`. **Idle/default** uses `public/rata-concept.png`. Other agent states swap to the matching sliced PNG. Unknown states map to `idle`. If an image is missing or fails to load, the engine shows a letter-mark silhouette and keeps the resolved state class. The renderer must not start sleeping or other states on a timer; those remain agent events.

Current mapping:

- `idle` → `rata-concept.png`
- `listening` → `14_widget_peeking.png`
- `thinking` → `09_expression_thinking.png`
- `awaiting_approval` → `08_expression_question.png`
- `working` / `typing` → `17_widget_laptop.png`
- `success` → `06_expression_happy.png`
- `error` → `11_expression_surprised.png`
- `sleeping` → `15_widget_sleeping.png`

Replace a catalog `file` (or idle `src`) in place to change art; do not put tool logic in the animation.

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
