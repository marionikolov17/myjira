export const API_BASE_URL: string = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api/v1'

export const USE_MOCKS: boolean = (process.env.NEXT_PUBLIC_USE_MOCKS ?? 'true') !== 'false'

export const WORKSPACE_NAME = 'MyJira'
