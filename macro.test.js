const { spawnSync } = require("child_process")
const path = require("path")

// TODO: Use babel API directly
test("macro", () => {
    expect(
        spawnSync(
            "node",
            [
                path.join("node_modules", "@babel", "cli", "bin", "babel.js"),
                "--plugins",
                "babel-plugin-macros",
                "./__fixtures__/index.js"
            ],
            {
                cwd: __dirname
            }
        )
            .stdout.toString()
            .trim()
    ).toMatchInlineSnapshot(`
"const b = 5;
const foo = {
  \\"config\\": {
    [\\"a\\"]: [1, 2, 3],
    [\`\${5 + b}\${20} \${\\"hello\\"}\`]: [\\"a\\", 100],
    \\"c\\": 1000
  }
};"
`)
})
