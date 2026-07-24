import { create } from 'zustand'

export interface QueueItemState {
  id: string
  scholarId: string
  userEmail: string
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILURE'
  progress: number
  taskId: string | null
  consoleLogs: string[]
  resultData?: any
}

export interface ScholarBatchQueueState {
  queue: QueueItemState[]
  activeTaskIds: string[]
  maxConcurrency: number
  selectedQueueId: string | null
}

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
  scholarQueue: ScholarBatchQueueState

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

  // Batch Queue Actions
  addToScholarQueue: (items: QueueItemState[]) => void
  updateScholarQueueItem: (id: string, updates: Partial<QueueItemState>) => void
  removeFromScholarQueue: (id: string) => void
  setSelectedQueueId: (id: string | null) => void
  clearScholarQueue: () => void
  setActiveTaskIds: (
    taskIds: string[] | ((prev: string[]) => string[])
  ) => void
}

const initialTaskState: CrawlerTaskState = {
  taskId: null,
  taskStatus: 'IDLE',
  progress: 0,
  consoleLogs: [],
}

const initialScholarQueueState: ScholarBatchQueueState = {
  queue: [],
  activeTaskIds: [],
  maxConcurrency: 2,
  selectedQueueId: null,
}

export const useCrawlerStore = create<CrawlerStoreState>((set) => ({
  scholar: { ...initialTaskState },
  bioxbio: { ...initialTaskState },
  scimago: { ...initialTaskState },
  clarivate: { ...initialTaskState },
  integrator: { ...initialTaskState },
  unified: { ...initialTaskState },
  scholarQueue: { ...initialScholarQueueState },

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

  addToScholarQueue: (items) =>
    set((prev) => ({
      scholarQueue: {
        ...prev.scholarQueue,
        queue: [...prev.scholarQueue.queue, ...items],
      },
    })),

  updateScholarQueueItem: (id, updates) =>
    set((prev) => ({
      scholarQueue: {
        ...prev.scholarQueue,
        queue: prev.scholarQueue.queue.map((item) =>
          item.id === id ? { ...item, ...updates } : item
        ),
      },
    })),

  removeFromScholarQueue: (id) =>
    set((prev) => ({
      scholarQueue: {
        ...prev.scholarQueue,
        queue: prev.scholarQueue.queue.filter((item) => item.id !== id),
        selectedQueueId:
          prev.scholarQueue.selectedQueueId === id
            ? null
            : prev.scholarQueue.selectedQueueId,
      },
    })),

  setSelectedQueueId: (id) =>
    set((prev) => ({
      scholarQueue: {
        ...prev.scholarQueue,
        selectedQueueId: id,
      },
    })),

  clearScholarQueue: () =>
    set((prev) => ({
      scholarQueue: {
        ...prev.scholarQueue,
        queue: [],
        activeTaskIds: [],
        selectedQueueId: null,
      },
    })),

  setActiveTaskIds: (taskIds) =>
    set((prev) => ({
      scholarQueue: {
        ...prev.scholarQueue,
        activeTaskIds:
          typeof taskIds === 'function'
            ? taskIds(prev.scholarQueue.activeTaskIds)
            : taskIds,
      },
    })),
}))

