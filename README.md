# yaml-to-js.macro

Babel macro to convert yaml template strings to javascript objects at build time.

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

It handles interpolated expressions reasonably well: 

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

## Configuration

This macro relies on [babel](https://babeljs.io) & [babel-plugin-macros](https://github.com/kentcdodds/babel-plugin-macros) being configured properly.

If you are not familiar with babel, checkout the [usage guide](https://babeljs.io/docs/en/usage).

If you are not familiar with babel-plugin-macros, checkout the [introduction](https://babeljs.io/blog/2017/09/11/zero-config-with-babel-macros) and the [installation section](https://github.com/kentcdodds/babel-plugin-macros#installation).

### Recommended configuration: 

```
npm install --save-dev @babel/core babel-plugin-macros yaml-to-js.macro
```

In `.babelrc`: 

```
{
    "plugins": ["babel-plugin-macros"]
}
```

## License

MIT