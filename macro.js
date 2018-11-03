const assert = require('assert')
const debug = require('debug')('yaml-to-js:macro')
const yaml = require('js-yaml')
const uniqueId = require('lodash/uniqueId')
const isString = require('lodash/isString')
const { createMacro } = require('babel-plugin-macros')

const ID_PREFIX = '__y2j_placeholder__'
const ID_PREFIX_REGEX = new RegExp(`^${ID_PREFIX}(\\d+)$`)
const ID_SPLITTER_REGEX = new RegExp(`(^|\\s+)(${ID_PREFIX}\\d+)(\\s+|$)`)

module.exports = createMacro(
    ({ references, state, babel }) => {
        const {parse} = babel

        // Only default export is supported
        if (!references.default) {
            throw new Error('yaml2js.macro incorrectly imported.')
        }

        const program = state.file.path

        // Extract all identifiers from the program
        // We will use this collection to ensure that the identifiers we inject later won't conflict
        // with any existing identifiers in use in the user code
        const identifiers = extractIdentifiers(program)
        debug('identifiers:', identifiers)

        // Utility to get identifiers which don't conflict with parent scope
        const getIdentifier = deriveUniqueIdentifier(identifiers)

        references.default.forEach(ref => {
            // Ensure that the macro is used as template expression and nothing else
            if (ref.parent.type !== 'TaggedTemplateExpression') {
                throw new Error(
                    `Expected a TaggedTemplateExpression but found ${
                        ref.parent.type
                    } instead.`
                )
            }

            // Yaml parser can not handle expressions interpolated into the template literal
            // So we replace the interpolations by generated identifiers
            const {
                generatedIdentifiers,
                parsableYamlStr
            } = substituteInterpolationsWithGeneratedIdentifiers(
                ref.parent.quasi,
                getIdentifier
            )

            // After we have substituted all interpolations with generated ids we can delegate to yaml parser
            // for actual parsing
            const parsed = yaml.safeLoad(parsableYamlStr)

            // To satisfy babel parser convert the object expression into a valid program by injecting a
            // dummy assignment
            const ast = parse(`var x = ${JSON.stringify(parsed)}`)
            substituteGeneratedIdentifiersWithInterpolations(
                ast,
                generatedIdentifiers,
                babel
            )

            // Get rid of the injected dummy assignment
            let node = ast.program.body[0].declarations[0].init

            // Substitute the generated js object AST into the original program code replacing the macro template expression
            ref.parentPath.parent.init = node
        })
    }
)

/**
 * Transform a template literal node so that all interpolations are substituted by generated unique identifiers
 */
const substituteInterpolationsWithGeneratedIdentifiers = (
    templateLiteralNode,
    getIdentifier
) => {
    debug('Transforming template literal:', templateLiteralNode)
    const { quasis, expressions } = templateLiteralNode
    const generatedIdentifiers = {}
    let parsableYamlStr = ''
    for (const {
        value: { raw }
    } of quasis) {
        if (!parsableYamlStr) {
            parsableYamlStr += raw
            continue
        }
        const descriptor = {}
        // We pad all identifier substitutions with spaces to simpify reverse substitution logic
        // But at the same time we need to keep track of the injecion of spaces so that
        // we don't end up extraneous whitespace in the generated javascript
        if (parsableYamlStr.charAt(parsableYamlStr.length - 1) !== ' ') {
            parsableYamlStr += ' '
            descriptor.preSpace = false
        } else {
            descriptor.preSpace = true
        }
        const id = getIdentifier(raw)
        parsableYamlStr += id
        if (raw.charAt(0) !== ' ') {
            parsableYamlStr += ' '
            descriptor.postSpace = false
        } else {
            descriptor.postSpace = true
        }
        parsableYamlStr += raw
        descriptor.expression = expressions.shift()
        generatedIdentifiers[id] = descriptor
    }
    debug('yaml string to be parsed:', parsableYamlStr)
    debug('generated identifiers:', generatedIdentifiers)
    return {
        parsableYamlStr,
        generatedIdentifiers
    }
}

const substituteGeneratedIdentifiersWithInterpolations = (
    ast,
    generatedIdentifiers,
    {traverse, types: t }
) =>
    traverse(ast, {
        Literal(path) {
            const id = path.node.value
            let replacement
            if (generatedIdentifiers[id]) {
                // The complete literal is an identifier
                // We avoid any coercion/interpolation and just substitute the
                // literal with the expression corresponding to the interpolation which
                // this generated identifier represents
                replacement = generatedIdentifiers[id].expression
            } else if (isString(id)) {
                // String may contain some generated identifiers
                // We will have to interpolate the expressions into a string
                const partitions = id.split(ID_SPLITTER_REGEX)
                if (partitions.length > 1) {
                    const parsedPartitions = []
                    let anyReplaced = false
                    partitions.slice(1, -1).forEach((partition, idx) => {
                        const match = partition.match(ID_PREFIX_REGEX)
                        let replaced = false
                        if (match) {
                            // Partition resembles a generated identifier
                            genId = `${ID_PREFIX}${match[1]}`
                            if (generatedIdentifiers[genId]) {
                                // This partition indeed represents a generated identifier
                                parsedPartitions.push(
                                    generatedIdentifiers[genId]
                                )
                                replaced = true
                            }
                        }
                        if (!replaced) {
                            // We will retain the original string partition
                            parsedPartitions.push(partition)
                        }
                        anyReplaced = anyReplaced || replaced
                    })
                    if (anyReplaced) {
                        // String contains generated identifiers and we need to substitute them with interpolations
                        const literalArgs = { expressions: [], quasis: [] }
                        for (let i = 0; i < parsedPartitions.length; i++) {
                            const item = parsedPartitions[i]
                            if (isString(parsedPartitions[i])) {
                                // We can just substitute the string into the generated literal
                                let id = item
                                if (
                                    parsedPartitions[i + 1] &&
                                    parsedPartitions[i + 1].preSpace === false
                                ) {
                                    id = id.slice(0, -1)
                                }
                                if (
                                    parsedPartitions[i - 1] &&
                                    parsedPartitions[i - 1].postSpace === false
                                ) {
                                    id = id.slice(1)
                                }
                                // Create static template literal
                                literalArgs.quasis.push(
                                    t.templateElement(
                                        {
                                            raw: id,
                                            cooked: id
                                        },
                                        i === parsedPartitions.length - 1
                                    )
                                )
                            } else {
                                // We need to substitute as interpolated expression
                                literalArgs.expressions.push(item.expression)
                            }
                        }
                        // Generator will be able to interleave them back only if for every expression there
                        // are two bounding template elements on either side.
                        //
                        // The above logic naturally incorporates empty template literal on either bounds
                        assert(
                            literalArgs.quasis.length ===
                                literalArgs.expressions.length + 1
                        )
                        // We will replace this string with an interpolated template literal
                        replacement = t.templateLiteral(
                            literalArgs.quasis,
                            literalArgs.expressions
                        )
                    }
                }
            }

            // Actually substitute the replacement into the target AST
            if (replacement) {
                let target = path.parent
                if (path.inList) {
                    target = target[path.listKey]
                }
                target[path.key] = replacement
                if (path.key === 'key' && !path.inList) {
                    target.computed = true
                }
            }
        }
    })

const extractIdentifiers = program => {
    const identifiers = []
    program.traverse({
        Identifier(path) {
            identifiers.push(path.node.name)
        }
    })
    return identifiers
}

const deriveUniqueIdentifier = knownIdentifiers => parentContent => {
    while (true) {
        const id = uniqueId(ID_PREFIX)
        if (
            knownIdentifiers.indexOf(id) === -1 &&
            parentContent.indexOf(id) === -1
        ) {
            return id
        }
    }
}
