import { exportStudentScoresWithTemplate } from './export.js'

const collectStudentsFromSheets = (sheets) => {
    const list = Array.isArray(sheets) ? sheets : []
    const sorted = list
        .map((s) => ({
            students: Array.isArray(s?.students) ? s.students : [],
            len: s?.students?.length || 0,
        }))
        .sort((a, b) => b.len - a.len)
    return sorted[0]?.students || []
}

export const exportStudentScoresXlsx = async ({
    filename,
    studentConfig,
    sheets,
    students,
    scope = 'class',
    className = '',
    operator = '',
    templateBuffer,
}) => {
    const exportStudents = Array.isArray(students) ? students : collectStudentsFromSheets(sheets)
    return await exportStudentScoresWithTemplate({
        filename,
        studentConfig,
        students: exportStudents,
        scope,
        className,
        operator,
        templateBuffer,
    })
}
