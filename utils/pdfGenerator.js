const PDFDocument = require('pdfkit');
const getStream = require('get-stream');
const fs = require('fs');
const path = require('path');

// Map status to image icon filenames
const statusImages = {
  Hot: 'marker-icon-red.png',
  Warm: 'marker-icon-orange.png',
  Cold: 'marker-icon-blue.png',
  FollowUp: 'marker-icon-yellow.png',
  Converted: 'marker-icon-green.png',
  Research: 'marker-icon-black.png',
  Unspecified: 'marker-icon-grey.png'
};

// Group logic
function groupLeads(leads) {
  const groups = {
    Meetings: [],
    Quality: [],
  };

  leads.forEach(lead => {
    const note = (lead['Notes'] || '').toLowerCase();
    if (note.includes('meeting') || note.includes('booked')) {
      groups.Meetings.push(lead);
    } else if (
      note.includes('interested') ||
      note.includes('demo') ||
      note.includes('engaged') ||
      note.includes('quality')
    ) {
      groups.Quality.push(lead);
    }
  });

  return groups;
}

async function generatePdf(leads, summaryText) {
  const doc = new PDFDocument({ margin: 50 });
  const stream = doc.pipe(getStream.buffer());

  // Header
  doc.fontSize(22).text('🧠 AI Summary', { underline: true });
  doc.moveDown().fontSize(12).text(summaryText || 'No summary returned.', { align: 'left' });
  doc.moveDown();

  const grouped = groupLeads(leads);

  // Render group
  function renderGroup(title, leads) {
    doc.fontSize(16).fillColor('black').text(title, { underline: true });
    leads.forEach(lead => {
      const status = (lead['Status'] || 'Unspecified').replace(/\s+/g, '');
      const iconFilename = statusImages[status] || statusImages['Unspecified'];
      const iconPath = path.join(__dirname, '../public/icons', iconFilename);

      try {
        doc.moveDown(0.5);
        doc.image(iconPath, { width: 12, continued: true });
      } catch (e) {
        doc.text('❔', { continued: true });
      }

      doc.fontSize(12).text(` ${lead['Company'] || 'Unnamed Company'} — ${lead['City'] || ''}, ${lead['State'] || ''}`);
      if (lead['Notes']) {
        doc.fontSize(10).fillColor('gray').text(lead['Notes'], { indent: 20 });
      }
    });
    doc.moveDown();
  }

  // Add sections
  if (grouped.Meetings.length > 0) renderGroup('📅 Meetings Booked', grouped.Meetings);
  if (grouped.Quality.length > 0) renderGroup('💬 Quality Conversations', grouped.Quality);

  doc.end();
  return await stream;
}

module.exports = { generatePdf };
