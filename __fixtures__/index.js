import yml from "../macro"

const b = 5

const foo = yml`
config:
  ${"a"}: [1, 2, 3]
  x${5 + b}${20} ${"hello"}:
    - a
    - ${100}   
  c: ${1000}`;