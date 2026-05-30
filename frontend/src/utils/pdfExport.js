import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- HELPER FUNCTIONS ---
const formatDuration = (totalSeconds) => {
    if (!totalSeconds) return "00:00:00";
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const getRowColor = (totalSeconds) => {
    const minutes = totalSeconds / 60;
    if (minutes >= 150) return [217, 234, 211];    // > 2 hr 30 min (Pale Green)
    if (minutes >= 120) return [207, 226, 243];    // 2 hr - 2 hr 30 min (Pale Blue)
    if (minutes >= 105) return [255, 242, 204];    // 1 hr 45 min - 2 hr (Pale Yellow)
    return [244, 204, 204];                        // < 1 hr 45 min (Pale Red)
};

// ==========================================
// 1. PERFORMANCE LEADERBOARD PDF
// ==========================================
export const generateLeaderboardPDF = (data, startDate, endDate, teamName = "GTS Inhouse") => {
    const doc = new jsPDF();

    // --- PRE-CALCULATE DATA & TOTALS ---
    let grandTotalSeconds = 0;
    
    const tableBody = data.map((producer, index) => {
        const seconds = parseFloat(producer.totalDuration || 0); 
        grandTotalSeconds += seconds;
        const dailyAvg = parseFloat(producer.dailyAverage || 0); 

        return [
            (index + 1).toString(),
            producer.producer || 'Unknown',
            formatDuration(seconds),
            formatDuration(dailyAvg), 
            dailyAvg // Hidden column used for coloring
        ];
    });

    // Calculate Team Average (This matches the 1.94hr you see in the UI)
    const teamAverageSeconds = data.length > 0 ? (grandTotalSeconds / data.length) : 0;

    // --- HEADER SECTION ---
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(31, 41, 55); 
    doc.text('PRODUCER LEADERBOARD', 14, 22);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 114, 128); 
    
    const startStr = startDate ? new Date(startDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }) : 'All Time';
    const endStr = endDate ? new Date(endDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }) : 'Present';
    doc.text(`Date: ${startStr} to ${endStr}`, 14, 32);
    doc.text(`Team: ${teamName}`, 14, 38);

    // --- STATS BOXES (TOP RIGHT) ---
    
    // BOX 1: TEAM AVERAGE (The 1.94 hr metric)
    doc.setFillColor(207, 226, 243); // Pale blue
    doc.setDrawColor(0, 0, 0); 
    doc.setLineWidth(0.6);
    doc.rect(105, 14, 42, 14, 'FD'); 

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(31, 41, 55); 
    doc.text("TEAM", 107, 19);
    doc.text("AVG", 107, 24);

    doc.setFontSize(13);
    doc.setTextColor(0, 0, 0); 
    doc.text(formatDuration(teamAverageSeconds), 121, 22);

    // BOX 2: GRAND TOTAL (The 6+ hr metric)
    doc.setFillColor(234, 209, 220); // Pale pinkish
    doc.rect(152, 14, 45, 14, 'FD'); 

    doc.setFontSize(8);
    doc.setTextColor(110, 30, 60); 
    doc.text("GRAND", 154, 19);
    doc.text("TOTAL", 154, 24);

    doc.setFontSize(13);
    doc.setTextColor(0, 0, 0); 
    doc.text(formatDuration(grandTotalSeconds), 171, 22);

    // --- COLOR LEGEND ---
    let legendY = 48;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    
    doc.setFillColor(217, 234, 211);
    doc.rect(14, legendY, 4, 4, 'F');
    doc.text('> 2 hr 30 min', 21, legendY + 3.5);

    doc.setFillColor(207, 226, 243);
    doc.rect(50, legendY, 4, 4, 'F');
    doc.text('2 hr - 2 hr 30 min', 57, legendY + 3.5);

    doc.setFillColor(255, 242, 204);
    doc.rect(95, legendY, 4, 4, 'F');
    doc.text('1 hr 45 min - 2 hr', 102, legendY + 3.5);

    doc.setFillColor(244, 204, 204);
    doc.rect(140, legendY, 4, 4, 'F');
    doc.text('< 1 hr 45 min', 147, legendY + 3.5);

    // --- GENERATE TABLE ---
    autoTable(doc, {
        startY: 56,
        head: [['RANK', 'PRODUCER', 'TOTAL HOURS', 'DAILY AVERAGE']],
        body: tableBody,
        theme: 'grid',
        headStyles: {
            fillColor: [243, 244, 246], 
            textColor: [31, 41, 55],    
            lineColor: [0, 0, 0],       
            lineWidth: 0.2,
            fontSize: 10,
            fontStyle: 'bold',
            halign: 'center'
        },
        styles: {
            lineColor: [0, 0, 0], 
            lineWidth: 0.1
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 20 }, 
            1: { halign: 'left' },                  
            2: { halign: 'center', fontStyle: 'bold' }, 
            3: { halign: 'center' }                 
        },
        didParseCell: function (data) {
            if (data.section === 'body') {
                const dailyAvgSeconds = data.row.raw[4]; 
                data.cell.styles.fillColor = getRowColor(dailyAvgSeconds);
                data.cell.styles.textColor = [0, 0, 0]; 
            }
        }
    });

    const safeStartDate = startDate || 'AllTime';
    doc.save(`${teamName.replace(/\s+/g, '_')}_Report_${safeStartDate}.pdf`);
};

// ==========================================
// 2. QC ANOMALIES PDF
// ==========================================
export const generateAnomaliesPDF = (data, startDate, endDate) => {
    const doc = new jsPDF();

    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(31, 41, 55); 
    doc.text('QC ANOMALIES REPORT', 14, 22);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 114, 128); 
    
    const startStr = startDate ? new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'All Time';
    const endStr = endDate ? new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Present';
    
    doc.text(`Date Range: ${startStr} to ${endStr}`, 14, 30);
    doc.text(`Total Records Downgraded: ${data.length}`, 14, 36);

    let totalLostSeconds = 0;

    const tableBody = data.map((row, index) => {
        const seconds = parseFloat(row.locked_duration || 0);
        totalLostSeconds += seconds;

        const lockedHrs = seconds > 0 ? (seconds / 3600).toFixed(2) + ' hr' : 'N/A';
        const status = row.inspect_result ? row.inspect_result.replace('INSPECT_', '') : 'UNKNOWN';
        
        let changedDate = 'Unknown';
        if (row.status_history && row.status_history.length > 0) {
            const lastChange = row.status_history[row.status_history.length - 1];
            changedDate = new Date(lastChange.changedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' });
        } else if (row.updatedAt) {
            changedDate = new Date(row.updatedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' });
        }

        return [
            (index + 1).toString(),
            row.data_name || 'N/A',
            row.producer || 'Unknown',
            lockedHrs,
            status,
            changedDate
        ];
    });

    doc.setFillColor(254, 226, 226); 
    doc.setDrawColor(0, 0, 0); 
    doc.setLineWidth(0.8);
    doc.rect(130, 14, 65, 16, 'FD'); 

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(153, 27, 27); 
    doc.text("TOTAL LOST", 132, 20);
    doc.text("HOURS", 132, 26);

    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0); 
    const totalLostHrs = (totalLostSeconds / 3600).toFixed(2);
    doc.text(`${totalLostHrs} hr`, 155, 24);

    autoTable(doc, {
        startY: 44,
        head: [['#', 'VIDEO ID', 'PRODUCER', 'LOCKED HOURS', 'CURRENT STATUS', 'DOWNGRADED ON']],
        body: tableBody,
        theme: 'grid',
        headStyles: {
            fillColor: [239, 68, 68], 
            textColor: 255,
            fontSize: 9,
            fontStyle: 'bold',
            halign: 'center'
        },
        styles: {
            lineColor: [200, 200, 200],
            lineWidth: 0.1,
            fontSize: 9
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 10 }, 
            1: { halign: 'left', fontStyle: 'bold' },                  
            2: { halign: 'left' },                    
            3: { halign: 'center', textColor: [16, 185, 129] }, 
            4: { halign: 'center', textColor: [239, 68, 68], fontStyle: 'bold' }, 
            5: { halign: 'center' }                   
        }
    });

    const safeStartDate = startDate || 'AllTime';
    doc.save(`QC_Anomalies_${safeStartDate}.pdf`);
};