const toInt = (value, fallback = 0) => {
    const n = Number(value)
    return Number.isFinite(n) ? Math.trunc(n) : fallback
}

export const toColumnName = (colIndex) => {
    let n = toInt(colIndex, 1)
    if (n < 1) n = 1
    let out = ''
    while (n > 0) {
        const r = (n - 1) % 26
        out = String.fromCharCode(65 + r) + out
        n = Math.floor((n - 1) / 26)
    }
    return out
}

export const toA1Address = (rowIndex, colIndex) => `${toColumnName(colIndex)}${toInt(rowIndex, 1)}`

const parseRcToken = (token, base) => {
    const text = String(token || '')
    if (!text) return base
    const relMatch = /^\[(-?\d+)\]$/.exec(text)
    if (relMatch) return base + toInt(relMatch[1], 0)
    return toInt(text, base)
}

export const rcFormulaToA1 = (r1c1Formula, baseRow = 1, baseCol = 1) => {
    const source = String(r1c1Formula || '')
    return source.replace(/R(\[?-?\d+\]?|\d+)C(\[?-?\d+\]?|\d+)/g, (_, rToken, cToken) => {
        const row = parseRcToken(rToken, toInt(baseRow, 1))
        const col = parseRcToken(cToken, toInt(baseCol, 1))
        return toA1Address(row, col)
    })
}

export const buildSumFormula = ({ rowIndex, startCol, endCol }) => {
    const row = toInt(rowIndex, 1)
    const left = toInt(startCol, 1)
    const right = toInt(endCol, 1)
    const r1c1 = `SUM(R${row}C${left}:R${row}C${right})`
    return rcFormulaToA1(r1c1, row, left)
}

export const buildRefFormula = ({ fromSheet, rowIndex, colIndex }) => {
    const row = toInt(rowIndex, 1)
    const col = toInt(colIndex, 1)
    const sheet = String(fromSheet || '').replace(/'/g, "''")
    return rcFormulaToA1(`'${sheet}'!R${row}C${col}`, row, col)
}

export const buildDiffFormula = ({ rowIndex, leftCol, rightCol }) => {
    const row = toInt(rowIndex, 1)
    const left = toInt(leftCol, 1)
    const right = toInt(rightCol, 1)
    return rcFormulaToA1(`R${row}C${left}-R${row}C${right}`, row, left)
}

export const buildTotalFormula = ({ rowIndex, baseCol, rewardCol, punishCol, specialCol }) => {
    const row = toInt(rowIndex, 1)
    return rcFormulaToA1(
        `R${row}C${toInt(baseCol, 1)}+R${row}C${toInt(rewardCol, 1)}-R${row}C${toInt(
            punishCol,
            1,
        )}+R${row}C${toInt(specialCol, 1)}`,
        row,
        toInt(baseCol, 1),
    )
}
