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
// THE MAGIC: LOCAL CHINESE FONT LOADER
// ==========================================
let cachedFontBase64 = null;

const loadCJKFont = async (doc) => {
    try {
        if (!cachedFontBase64) {
            const res = await fetch('/NotoSansSC-Regular.ttf');

            if (!res.ok) throw new Error("Local font file not found in public folder");

            // Safely convert to Base64 using FileReader
            const blob = await res.blob();
            const base64Text = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result.split(',')[1]); // Extract base64
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });

            cachedFontBase64 = base64Text;
        }

        doc.addFileToVFS('NotoSansSC.ttf', cachedFontBase64);
        doc.addFont('NotoSansSC.ttf', 'NotoSansSC', 'normal');

        doc.addFont('NotoSansSC.ttf', 'NotoSansSC', 'normal');
        
        doc.addFont('NotoSansSC.ttf', 'NotoSansSC', 'bold');

        return 'NotoSansSC';
    } catch (error) {
        console.error("Failed to load Chinese font. Falling back to default:", error);
        return 'helvetica'; // Fallback
    }
};

// ==========================================
// 1. PERFORMANCE LEADERBOARD PDF
// ==========================================
export const generateLeaderboardPDF = async (data, startDate, endDate, teamName = "GTS Inhouse") => {
    const doc = new jsPDF();
    const fontName = await loadCJKFont(doc); // LOAD FONT

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
            dailyAvg
        ];
    });

    const teamAverageSeconds = data.length > 0 ? (grandTotalSeconds / data.length) : 0;

    doc.setFontSize(22);
    doc.setFont(fontName, "normal"); // APPLY FONT
    doc.setTextColor(31, 41, 55);
    doc.text('PRODUCER LEADERBOARD', 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    const startStr = startDate ? new Date(startDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }) : 'All Time';
    const endStr = endDate ? new Date(endDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }) : 'Present';
    doc.text(`Date: ${startStr} to ${endStr}`, 14, 32);
    doc.text(`Team: ${teamName}`, 14, 38);

    doc.setFillColor(207, 226, 243);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.6);
    doc.rect(105, 14, 42, 14, 'FD');
    doc.setFontSize(8);
    doc.setTextColor(31, 41, 55);
    doc.text("TEAM", 107, 19);
    doc.text("AVG", 107, 24);
    doc.setFontSize(13);
    doc.setTextColor(0, 0, 0);
    doc.text(formatDuration(teamAverageSeconds), 121, 22);

    doc.setFillColor(234, 209, 220);
    doc.rect(152, 14, 45, 14, 'FD');
    doc.setFontSize(8);
    doc.setTextColor(110, 30, 60);
    doc.text("GRAND", 154, 19);
    doc.text("TOTAL", 154, 24);
    doc.setFontSize(13);
    doc.setTextColor(0, 0, 0);
    doc.text(formatDuration(grandTotalSeconds), 171, 22);

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
            halign: 'center'
        },
        styles: {
            font: fontName, // APPLY FONT TO TABLE
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
export const generateAnomaliesPDF = async (data, startDate, endDate) => {
    const doc = new jsPDF();
    const fontName = await loadCJKFont(doc); // LOAD FONT

    doc.setFontSize(22);
    doc.setFont(fontName, "normal"); // APPLY FONT
    doc.setTextColor(31, 41, 55);
    doc.text('QC ANOMALIES REPORT', 14, 22);

    doc.setFontSize(10);
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
            halign: 'center'
        },
        styles: {
            font: fontName, // APPLY FONT TO TABLE
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

// ==========================================
// 3. ATTENDANCE ROSTER PDF
// ==========================================
export const generateAttendancePDF = async (data, startDate, endDate, expectedWorkingDays, teamName = "ALL") => {
    const doc = new jsPDF();
    const fontName = await loadCJKFont(doc); // LOAD FONT

    const formatOfficeHours = (seconds) => {
        if (!seconds || seconds <= 0) return '0h 0m';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return `${h}h ${m}m`;
    };

    doc.setFontSize(22);
    doc.setFont(fontName, "normal"); // APPLY FONT
    doc.setTextColor(31, 41, 55);
    doc.text('ATTENDANCE ROSTER', 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);

    const startStr = startDate ? new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'All Time';
    const endStr = endDate ? new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Present';

    doc.text(`Date Range: ${startStr} to ${endStr}`, 14, 30);
    doc.text(`Team Filter: ${teamName === 'ALL' ? 'Global (All Teams)' : teamName}`, 14, 36);
    doc.text(`Expected Working Days: ${expectedWorkingDays}`, 14, 42);

    doc.setFillColor(207, 226, 243);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.6);
    doc.rect(145, 14, 50, 16, 'FD');

    doc.setFontSize(9);
    doc.setTextColor(31, 41, 55);
    doc.text("TOTAL", 148, 20);
    doc.text("PRODUCERS", 148, 25);

    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text(data.length.toString(), 175, 23);

    const tableBody = data.map((row) => {
        const leaves = Math.max(0, expectedWorkingDays - row.presentDays);
        return [
            row.producer,
            `${row.presentDays} / ${expectedWorkingDays}`,
            leaves.toString(),
            row.totalVideos.toString(),
            formatOfficeHours(row.totalRecordedSec),
            formatOfficeHours(row.totalOfficeDurationSec)
        ];
    });

    autoTable(doc, {
        startY: 50,
        head: [['PRODUCER', 'PRESENT DAYS', 'LEAVES', 'TOTAL VIDEOS', 'RECORDED HOURS', 'OFFICE HOURS']],
        body: tableBody,
        theme: 'grid',
        headStyles: {
            fillColor: [243, 244, 246],
            textColor: [31, 41, 55],
            lineColor: [0, 0, 0],
            lineWidth: 0.2,
            fontSize: 9,
            halign: 'center'
        },
        styles: {
            font: fontName, // APPLY FONT TO TABLE
            lineColor: [0, 0, 0],
            lineWidth: 0.1,
            fontSize: 8
        },
        columnStyles: {
            0: { halign: 'left', fontStyle: 'bold' },
            1: { halign: 'center', textColor: [16, 185, 129] },
            2: { halign: 'center', textColor: [239, 68, 68] },
            3: { halign: 'center' },
            4: { halign: 'center', textColor: [59, 130, 246], fontStyle: 'bold' },
            5: { halign: 'center', fontStyle: 'bold' }
        }
    });

    const safeStartDate = startDate || 'AllTime';
    doc.save(`Attendance_Roster_${safeStartDate}.pdf`);
};