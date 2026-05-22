export const globalSyncState = {
    isSyncing: false,
    type: null, 
    message: '',
    progress: 0
};

// ADD THESE: A safe place to store and retrieve the Socket instance
export let ioInstance = null;

export const setIO = (io) => {
    ioInstance = io;
};