export const formatDuration = (totalSeconds) => {
    // If the value is 0, null, undefined, or NaN, return a clean dash
    if (!totalSeconds || isNaN(totalSeconds) || totalSeconds === 0) {
        return "-";
    }
    
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);

    // Pad with zeros to ensure HH:MM:SS format
    const pad = (num) => num.toString().padStart(2, '0');
    
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
};