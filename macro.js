const util = require('util')
const debug = require('debug')('yaml-to-js:macro')
const yaml = require('js-yaml')
const uniqueId = require('lodash/uniqueId')
const isString = require('lodash/isString')
const {createMacro} = require('babel-plugin-macros')
const utils = require('./utils')

module.exports = createMacro(({references, state, babel: {parse, traverse, types: t}}) => {
    if (!references.default) {
        throw new Error('yaml2js.macro incorrectly imported.');
    }
    const program = state.file.path
    const identifiers = utils.extractIdentifiers(program)
    debug('identifiers:', identifiers)
    const getIdentifier = utils.getIdentifier(identifiers)
    references.default.forEach(ref => {
        if (ref.parent.type !== 'TaggedTemplateExpression') {
            throw new Error(`Expected a TaggedTemplateExpression but found ${ref.parent.type} instead.`);
        }
        const {quasis, expressions} = ref.parent.quasi;
        const generatedIdentifiers = {}
        const yamlSrc = quasis.reduce((src, {value: {raw}}) => {
            if (!src) return raw
            const descriptor = {}
            if (src.charAt(src.length - 1) !== ' ') {
                src += ' '
                descriptor.preSpace = false
            } else {
                descriptor.preSpace = true
            }
            const id = getIdentifier(raw)
            src += id
            if (raw.charAt(0) !== ' ') {
                src += ' '
                descriptor.postSpace = false
            } else {
                descriptor.postSpace = true
            }
            src += raw
            descriptor.expression = expressions.shift()
            generatedIdentifiers[id] = descriptor
            return src
        }, undefined)
        debug('generated identifiers:', generatedIdentifiers)
        const parsed = yaml.safeLoad(yamlSrc);
        const ast = parse(`var x = ${JSON.stringify(parsed)}`);
        traverse(ast, {
            Literal(path) {
                const id = path.node.value
                let replacement
                if (generatedIdentifiers[id]) {
                    replacement = generatedIdentifiers[id].expression
                } else if (isString(id)) {
                    const partitions = id.split(utils.ID_SPLITTER_REGEX)
                    if (partitions.length > 1) {
                        const parsedPartitions = []
                        partitions.slice(1, -1).forEach((partition, idx) => {
                            const match = partition.match(utils.ID_PREFIX_REGEX)
                            let replaced = false
                            if (match) {
                                genId = `${utils.ID_PREFIX}${match[1]}`
                                if (generatedIdentifiers[genId]) {
                                    parsedPartitions.push(generatedIdentifiers[genId])
                                    replaced = true
                                }
                            } 
                            if (!replaced) {
                                parsedPartitions.push(partition)
                            }   
                        })
                        const literalArgs = {expressions: [], quasis: []}
                        for (let i = 0; i < parsedPartitions.length; i++) {
                            const item = parsedPartitions[i];
                            if (isString(parsedPartitions[i])) {
                                let id = item
                                if (parsedPartitions[i+1] && parsedPartitions[i+1].preSpace === false) {
                                    id = id.slice(0, -1)
                                }
                                if (parsedPartitions[i-1] && parsedPartitions[i-1].postSpace === false) {
                                    id = id.slice(1)
                                }
                                literalArgs.quasis.push(t.templateElement({
                                    raw: id,
                                    cooked: id
                                }, i === parsedPartitions.length - 1))
                            } else {
                                literalArgs.expressions.push(item.expression)
                            }
                        }
                        replacement = t.templateLiteral(literalArgs.quasis, literalArgs.expressions)
                    }
                }
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
        let node = ast.program.body[0].declarations[0].init;

        if (generatedIdentifiers.length > 0) {
            node = t.expressionStatement(
                t.callExpression(
                    t.functionExpression(
                        null,
                        generatedIdentifiers.map(genId => t.identifier(genId)),
                        t.blockStatement([
                            t.returnStatement(node)
                        ])
                    ),
                    expressions
                )
            )
        }
        ref.parentPath.parent.init = node;
    });
    
});
