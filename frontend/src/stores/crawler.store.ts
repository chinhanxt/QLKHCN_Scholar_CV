import { create } from 'zustand'

export interface SubTaskState {
  status: string
  progress: number
  message: string
}

export interface CrawlerTaskState {
  taskId: string | null
  taskStatus: string
  progress: number
  consoleLogs: string[]
  subTasks?: {
    clarivate?: SubTaskState
    scimago?: SubTaskState
    bioxbio?: SubTaskState
    mapping?: SubTaskState
  }
}

interface CrawlerStoreState {
  scholar: CrawlerTaskState
  bioxbio: CrawlerTaskState
  scimago: CrawlerTaskState
  clarivate: CrawlerTaskState
  integrator: CrawlerTaskState
  unified: CrawlerTaskState

  // Actions
  setTaskState: (
    key: 'scholar' | 'bioxbio' | 'scimago' | 'clarivate' | 'integrator' | 'unified',
    state: Partial<CrawlerTaskState>
  ) => void
  addConsoleLog: (
    key: 'scholar' | 'bioxbio' | 'scimago' | 'clarivate' | 'integrator' | 'unified',
    log: string
  ) => void
  clearLogs: (
    key: 'scholar' | 'bioxbio' | 'scimago' | 'clarivate' | 'integrator' | 'unified'
  ) => void
  resetTask: (
    key: 'scholar' | 'bioxbio' | 'scimago' | 'clarivate' | 'integrator' | 'unified'
  ) => void
}

const initialTaskState: CrawlerTaskState = {
  taskId: null,
  taskStatus: 'IDLE',
  progress: 0,
  consoleLogs: [],
}

export const useCrawlerStore = create<CrawlerStoreState>((set) => ({
  scholar: { ...initialTaskState },
  bioxbio: { ...initialTaskState },
  scimago: { ...initialTaskState },
  clarivate: { ...initialTaskState },
  integrator: { ...initialTaskState },
  unified: { ...initialTaskState },

  setTaskState: (key, state) =>
    set((prev) => ({
      [key]: {
        ...prev[key],
        ...state,
      },
    })),

  addConsoleLog: (key, log) =>
    set((prev) => {
      const logs = prev[key].consoleLogs
      // Avoid duplicate consecutive logs
      if (logs.length > 0 && logs[logs.length - 1] === log) {
        return {}
      }
      return {
        [key]: {
          ...prev[key],
          consoleLogs: [...logs, log],
        },
      }
    }),

  clearLogs: (key) =>
    set((prev) => ({
      [key]: {
        ...prev[key],
        consoleLogs: [],
      },
    })),

  resetTask: (key) =>
    set(() => ({
      [key]: {
        ...initialTaskState,
        consoleLogs: [],
      },
    })),
}))
