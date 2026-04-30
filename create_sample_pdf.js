import { PDFDocument, rgb } from 'pdf-lib';
import fs from 'fs';

async function createPdf() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 400]);
  page.drawText('Sample Student Answer Script', { x: 50, y: 350, size: 30, color: rgb(0, 0, 0) });
  page.drawText('Q1: Photosynthesis is the process by which plants make food.', { x: 50, y: 300, size: 15 });
  page.drawText('Q2: The capital of France is Paris.', { x: 50, y: 250, size: 15 });
  
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync('sample_script.pdf', pdfBytes);
  console.log('Created sample_script.pdf');
}

createPdf();
