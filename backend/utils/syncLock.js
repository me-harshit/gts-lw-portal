// backend/utils/syncLock.js
export const globalSyncState = {
    isSyncing: false,
    type: null, // 'TASK', 'QC', 'TRANSLATE'
    message: '',
    progress: 0
};