# Mermaid State

```mermaid
stateDiagram-v2
  [*] --> Idle
  Idle --> Working: start
  Working --> Idle: stop
  Working --> Error: fail
  Error --> Idle: reset
```
