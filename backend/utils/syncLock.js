export const globalSyncState = {
    isSyncing: false,
    type: null, 
    message: '',
    progress: 0
};

let ioInstance = null;

export const setIO = (io) => {
    ioInstance = io;
};

export const updateSyncState = (updates) => {
    Object.assign(globalSyncState, updates);
    console.log(`[Socket Broadcast] ${globalSyncState.type} | ${globalSyncState.message} | Progress: ${globalSyncState.progress}`);
    
    if (ioInstance) {
        ioInstance.emit('sync_update', globalSyncState);
    } else {
        console.warn("⚠️ [Socket Error] ioInstance is null! Broadcast failed.");
    }
};

export const finishSync = (message) => {
    globalSyncState.isSyncing = false;
    globalSyncState.message = message;
    console.log(`[Socket Broadcast] SUCCESS: ${message}`);
    
    if (ioInstance) ioInstance.emit('sync_finished', globalSyncState);
};

export const errorSync = (errorMessage) => {
    globalSyncState.isSyncing = false;
    console.error(`[Socket Broadcast] ERROR: ${errorMessage}`);
    
    if (ioInstance) ioInstance.emit('sync_error', { message: errorMessage });
};