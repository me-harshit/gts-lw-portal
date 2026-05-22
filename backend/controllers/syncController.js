import { io } from '../server.js'; // Import the socket instance

// Global memory state (The Lock)
export const globalSyncState = {
    isSyncing: false,
    type: null, // 'TASK', 'QC', etc.
    message: '',
    progress: 0
};

export const triggerSync = async (req, res) => {
    // 1. Check the Lock
    if (globalSyncState.isSyncing) {
        return res.status(409).json({ message: "A sync is already in progress by another user." });
    }

    // 2. Engage the Lock
    const syncType = req.body.type || 'TASK';
    globalSyncState.isSyncing = true;
    globalSyncState.type = syncType;
    globalSyncState.message = 'Initializing...';
    globalSyncState.progress = 0;

    // Broadcast to everyone that sync started
    io.emit('sync_update', globalSyncState);
    
    // Return immediately to the user who clicked the button so their request doesn't hang
    res.status(200).json({ message: "Sync started successfully." });

    try {
        // 3. Perform the actual sync logic in the background
        const totalRows = 5000; // Example total
        for (let i = 0; i <= totalRows; i += 100) {
            // Simulate work (e.g., fetching from API, saving to DB)
            await new Promise(resolve => setTimeout(resolve, 500)); 
            
            // Update state & Broadcast progress
            globalSyncState.progress = i;
            globalSyncState.message = `Processing chunk...`;
            io.emit('sync_update', globalSyncState);
        }

        // 4. Finish and Release the Lock
        globalSyncState.isSyncing = false;
        globalSyncState.message = 'Sync Complete!';
        io.emit('sync_finished', globalSyncState);

    } catch (error) {
        // Handle Error and Release the Lock
        globalSyncState.isSyncing = false;
        globalSyncState.message = 'Sync Failed.';
        io.emit('sync_error', { message: error.message });
    }
};