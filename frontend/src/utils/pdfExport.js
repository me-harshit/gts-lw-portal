import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper to format raw seconds into HH:MM:SS
const formatDuration = (totalSeconds) => {
    if (!totalSeconds) return "00:00:00";
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// Helper to determine the ROW color based on the screenshot's exact thresholds
const getRowColor = (totalSeconds) => {
    const minutes = totalSeconds / 60;
    if (minutes >= 150) return [217, 234, 211];    // > 2 hr 30 min (Pale Green)
    if (minutes >= 120) return [207, 226, 243];    // 2 hr - 2 hr 30 min (Pale Blue)
    if (minutes >= 105) return [255, 242, 204];    // 1 hr 45 min - 2 hr (Pale Yellow)
    return [244, 204, 204];                        // < 1 hr 45 min (Pale Red)
};

export const generateLeaderboardPDF = (data, startDate, endDate, teamName = "GTS Inhouse") => {
    const doc = new jsPDF();

    // --- 1. PRE-CALCULATE DATA & TOTALS ---
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
            dailyAvg // Hidden column [4] used to determine the row color
        ];
    });

    // --- 2. HEADER SECTION ---
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(31, 41, 55); 
    doc.text('PRODUCER STATISTICS', 14, 22);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 114, 128); 
    
    const startStr = startDate ? new Date(startDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }) : 'All Time';
    const endStr = endDate ? new Date(endDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }) : 'Present';
    doc.text(`Date: ${startStr} to ${endStr}`, 14, 32);
    doc.text(`Team: ${teamName}`, 14, 38);

    // --- 3. GRAND TOTAL BOX (TOP RIGHT) ---
    // Draw the box background and border
    doc.setFillColor(234, 209, 220); // Pale pinkish background
    doc.setDrawColor(0, 0, 0); // Black border
    doc.setLineWidth(0.8);
    doc.rect(130, 14, 65, 16, 'FD'); // x, y, width, height, Fill & Draw

    // Draw the "GRAND TOTAL" text
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(110, 30, 60); // Dark burgundy text
    doc.text("GRAND", 132, 20);
    doc.text("TOTAL", 132, 26);

    // Draw the actual time
    doc.setFontSize(18);
    doc.setTextColor(0, 0, 0); // Black text
    doc.text(formatDuration(grandTotalSeconds), 149, 24);

    // --- 4. COLOR LEGEND ---
    let legendY = 48;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    
    // Green
    doc.setFillColor(217, 234, 211);
    doc.rect(14, legendY, 4, 4, 'F');
    doc.text('> 2 hr 30 min', 21, legendY + 3.5);

    // Blue
    doc.setFillColor(207, 226, 243);
    doc.rect(50, legendY, 4, 4, 'F');
    doc.text('2 hr - 2 hr 30 min', 57, legendY + 3.5);

    // Yellow
    doc.setFillColor(255, 242, 204);
    doc.rect(95, legendY, 4, 4, 'F');
    doc.text('1 hr 45 min - 2 hr', 102, legendY + 3.5);

    // Red
    doc.setFillColor(244, 204, 204);
    doc.rect(140, legendY, 4, 4, 'F');
    doc.text('< 1 hr 45 min', 147, legendY + 3.5);

    // --- 5. GENERATE TABLE ---
    autoTable(doc, {
        startY: 56,
        head: [['RANK', 'PRODUCER', 'TOTAL HOURS', 'DAILY AVERAGE']],
        body: tableBody,
        theme: 'grid',
        headStyles: {
            fillColor: [243, 244, 246], // Light gray header
            textColor: [31, 41, 55],    // Dark text
            lineColor: [0, 0, 0],       // Black borders
            lineWidth: 0.2,
            fontSize: 10,
            fontStyle: 'bold',
            halign: 'center'
        },
        styles: {
            lineColor: [0, 0, 0], // Black gridlines for the whole table
            lineWidth: 0.1
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 20 }, 
            1: { halign: 'left' },                  
            2: { halign: 'center', fontStyle: 'bold' }, 
            3: { halign: 'center' }                 
        },
        // This hook runs for every single cell as it is drawn
        didParseCell: function (data) {
            if (data.section === 'body') {
                // Look at the hidden column (index 4) for the daily average
                const dailyAvgSeconds = data.row.raw[4]; 
                
                // Color the cell background based on our logic
                data.cell.styles.fillColor = getRowColor(dailyAvgSeconds);
                
                // Force text to be black so it is readable against the colors
                data.cell.styles.textColor = [0, 0, 0]; 
            }
        }
    });

    // --- 6. SAVE FILE ---
    const safeStartDate = startDate || 'AllTime';
    doc.save(`${teamName.replace(/\s+/g, '_')}_Report_${safeStartDate}.pdf`);
};