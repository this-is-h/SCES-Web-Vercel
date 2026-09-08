export interface ServerConfigEncryption {
  enabled: boolean
  rsaPublicKeyJwk: JsonWebKey | null
  rsaAlgorithm?: { name: string; hash: string }
  aesAlgorithm?: { name: string; length: number }
}

export interface ServerConfig {
  version: string
  year: number
  semester: number
  studentRequiredCategories: string[]
  studentRequiredExtraItemNumbers: number[]
  adminRequiredCategories: string[]
  adminRequiredExtraItemNumbers: number[]
  encryption: ServerConfigEncryption
}

declare const config: ServerConfig
export default config
