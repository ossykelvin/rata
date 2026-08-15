# Rata Character Assets

The MVP displays `public/rata-concept.png` inside a clipped viewport and uses CSS movement. If that file is missing, the avatar falls back to a letter mark so the overlay still launches.

## Target animation set

Place transparent assets under a future `assets/rata/animations/` directory:

- idle
- idle-blink
- wave
- listening
- thinking
- glasses-on
- typing
- coffee
- working
- success
- confused
- warning
- sleeping
- walking-left
- walking-right
- dragging

## Five-second working animation

A useful early asset is the sequence already defined for Rata: put the cup down, put on glasses and type on a laptop. Map it to the `working`/`typing` state.

## Requirements

- preserve character proportions and clothing
- transparent background
- seamless idle loop
- keep visible bounds reasonably consistent between states
- character engine decides state; animation never decides tool behaviour
