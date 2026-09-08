export interface StudentConfigTime {
  student: number
  class: number
  grade: number
}

export interface StudentConfig {
  version: number
  revision: number
  time: StudentConfigTime
  data: {
    personal: Record<string, unknown>
    dyf: Record<string, unknown>
  }
}

declare const config: StudentConfig
export default config
