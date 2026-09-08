export type StudentTableRowActionKey = string

export type StudentTableRowActionPermissionResult =
    | boolean
    | Record<StudentTableRowActionKey, boolean>

export type StudentTableRowActionPermissionFn<Row = Record<string, unknown>> = (row: Row) => StudentTableRowActionPermissionResult

export type StudentTableExportFormat = 'xlsx' | 'csv'

export type StudentTableExportColumn<Row = Record<string, unknown>> = {
    header: string
    key: string
    width?: number
    numFmt?: string
    value?: (row: Row) => unknown
}

export type StudentTableExportOptions<Row = Record<string, unknown>> = {
    format?: StudentTableExportFormat
    rows?: Row[]
    columns: StudentTableExportColumn<Row>[]
    fileName?: string
    sheetName?: string
}
