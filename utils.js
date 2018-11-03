const uniqueId = require('lodash/uniqueId')
const ID_PREFIX = '__y2j_placeholder__'
const ID_PREFIX_REGEX = new RegExp(`^${ID_PREFIX}(\\d+)$`)
const ID_SPLITTER_REGEX = new RegExp(`(^|\\s+)(${ID_PREFIX}\\d+)(\\s+|$)`)

const extractIdentifiers = (program) => {
    const identifiers = []
    program.traverse({
        Identifier(path) {
            identifiers.push(path.node.name)
        }
    })
    return identifiers
}

const getIdentifier = (knownIdentifiers) => (parentContent) => {
    while (true) {
        const id = uniqueId(ID_PREFIX)
        if (knownIdentifiers.indexOf(id) === -1 && parentContent.indexOf(id) === -1) {
            return id
        }
    }
}

module.exports = {
    ID_PREFIX,
    ID_PREFIX_REGEX,
    ID_SPLITTER_REGEX,
    extractIdentifiers,
    getIdentifier
}