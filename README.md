# yaml-to-js.macro

Babel macro to convert yaml template strings to javascript objects at build time.

[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)


From: 

```js
import yml from "yaml-to-js.macro"

const foo = yml`
config: 
  a: 10
  b: 
    - 1
    - 2
`;
```

To:

```js
const foo = {
    config: {
        a: 10,
        b: [1, 2]
    }
}
```

There is a reasonable support for interpolated expressions: 

From: 

```js
import yml from "yaml-to-js.macro"

const a = 10
const b = 20

const foo = yml`
config: 
  a: ${10}
  b: 
    - ${a}
    - ${a + b}
`;
```

To:

```js
const a = 10
const b = 20

const foo = {
    config: {
        a: 10,
        b: [a, a+b]
    }
}
```

Note that when the interpolated expression is standalone, it will not be coerced as in the above example. 

However if there are multiple interpolated expressions in the same phrase, they will coerced into a string: 

```js
const foo = yml`
config: 
  a: ${10} ${20}
`;
```

Results in: 

```js
const foo = {
    config: {
        a: `${10} ${20}`
    }
}
```

If there are interpolations in property keys, they will be coerced to string template literals.

```js
const foo = yml`
${10}:
  a: 10
`
```

Results in: 

```js
const foo = {"10": {"a": 10}}
```

**Interpolation support has well defined limits:**

Note that because the interpolated expressions are retained in the generated code, it is not possible to compose yaml fragments 
together using interpolations. 

So something like this will not behave as expected: 

```js
const somYamlStr = `
config: 
  - a
`
const foo = yml`${someYamlStr}`
```

It is better to use multiple macro invocations along with normal javascript object compositions: 

```js
const someObj = yml`{ prop1: "val1"}`
const someOtherObj = yml`{prop2: ${someObj}}`
```

Results in: 

```js
const someObj = { prop1: "val1" }
const someOtherObj = { prop2: someObj }
```

## Installation

This macro relies on [babel](https://babeljs.io) & [babel-plugin-macros](https://github.com/kentcdodds/babel-plugin-macros) being configured properly.

If you are not familiar with babel, checkout the [usage guide](https://babeljs.io/docs/en/usage).

If you are not familiar with babel-plugin-macros, checkout the [introduction](https://babeljs.io/blog/2017/09/11/zero-config-with-babel-macros) and the [installation section](https://github.com/kentcdodds/babel-plugin-macros#installation).

### tl;dr

```
npm install --save-dev @babel/core babel-plugin-macros yaml-to-js.macro
```

In `.babelrc`: 

```
{
    "plugins": ["babel-plugin-macros"]
}
```

## Support for interpolated expressions
