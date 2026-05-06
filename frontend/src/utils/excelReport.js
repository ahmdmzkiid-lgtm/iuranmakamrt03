import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const applyTitleStyling = (cell, text, isTitle = true) => {
  cell.value = text;
  cell.font = {
    name: 'Arial',
    family: 2,
    size: isTitle ? 16 : 10,
    bold: true,
  };
  cell.alignment = { vertical: 'middle', horizontal: 'left' };
};

export const generateExcelReport = async (wargaData, iuranData) => {
  const workbook = new ExcelJS.Workbook();
  const sheet1 = workbook.addWorksheet('Data');

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const exportDate = new Date().toLocaleString('id-ID');

  // --- TITLES ---
  applyTitleStyling(sheet1.getCell('A1'), 'LAPORAN DATA WARGA & TAGIHAN RT 03 - LIMO');
  applyTitleStyling(sheet1.getCell('A2'), `Tanggal Ekspor: ${exportDate}`, false);
  sheet1.mergeCells('A1:G1');
  sheet1.mergeCells('A2:G2');

  // Define Columns starting from row 4
  const startRow = 4;
  sheet1.getRow(startRow).values = ['No', 'Nama Warga', 'No. Rumah', 'Periode', 'Jumlah (Rp)', 'Status', 'Persentase'];
  
  sheet1.columns = [
    { key: 'no', width: 5 },
    { key: 'nama', width: 30 },
    { key: 'alamat', width: 15 },
    { key: 'periode', width: 15 },
    { key: 'jumlah', width: 18 },
    { key: 'status', width: 15 },
    { key: 'persen', width: 15 },
  ];

  const headerBlue = 'FFB5D4F4';
  const zebraGray = 'FFF1EFE8';
  const totalYellow = 'FFFAEEDA';

  // Header Styling
  sheet1.getRow(startRow).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerBlue } };
    cell.font = { bold: true };
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  wargaData.forEach((w, index) => {
    const iuran = iuranData.find(
      (i) => i.wargaId === w.id && i.bulan === currentMonth && i.tahun === currentYear
    );
    
    const rowIdx = startRow + 1 + index;
    const jumlah = iuran ? iuran.jumlah : (w.jumlahMakam || 1) * 10000;
    const statusText = iuran ? (iuran.status === 'lunas' ? 'Selesai' : iuran.status === 'pending' ? 'Pending' : 'Proses') : 'Proses';

    const row = sheet1.addRow({
      no: index + 1,
      nama: w.user?.nama || '-',
      alamat: w.alamat || '-',
      periode: `${currentMonth}/${currentYear}`,
      jumlah: jumlah,
      status: statusText,
      persen: { formula: `=(E${rowIdx}/10000)*100` },
    });

    if (rowIdx % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebraGray } };
      });
    }

    row.eachCell((cell) => {
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    row.getCell('status').dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"Selesai,Proses,Pending"'],
    };

    row.getCell('jumlah').numFmt = '#,##0';
    row.getCell('persen').numFmt = '0.00"%"';
  });

  // --- SHEET 2: RINGKASAN ---
  const sheet2 = workbook.addWorksheet('Ringkasan');
  applyTitleStyling(sheet2.getCell('A1'), 'RINGKASAN LAPORAN DATA WARGA');
  applyTitleStyling(sheet2.getCell('A2'), `Tanggal Ekspor: ${exportDate}`, false);
  sheet2.mergeCells('A1:C1');
  sheet2.mergeCells('A2:C2');

  const startRow2 = 4;
  sheet2.getRow(startRow2).values = ['Kategori', 'Total Item', 'Total Nilai (Rp)'];
  sheet2.columns = [
    { key: 'kategori', width: 30 },
    { key: 'total_item', width: 15 },
    { key: 'total_nilai', width: 25 },
  ];

  sheet2.getRow(startRow2).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerBlue } };
    cell.font = { bold: true };
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
  });

  const lastDataRow = wargaData.length + startRow;
  const categories = ['Selesai', 'Proses', 'Pending'];
  categories.forEach((cat) => {
    const row = sheet2.addRow({
      kategori: `Status: ${cat}`,
      total_item: { formula: `=COUNTIF(Data!F${startRow + 1}:F${lastDataRow}, "${cat}")` },
      total_nilai: { formula: `=SUMIF(Data!F${startRow + 1}:F${lastDataRow}, "${cat}", Data!E${startRow + 1}:E${lastDataRow})` },
    });
    row.eachCell(c => c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } });
    row.getCell('total_nilai').numFmt = '#,##0';
  });

  const totalRow = sheet2.addRow({
    kategori: 'TOTAL KESELURUHAN',
    total_item: { formula: `=SUM(B${startRow2 + 1}:B${startRow2 + 3})` },
    total_nilai: { formula: `=SUM(C${startRow2 + 1}:C${startRow2 + 3})` },
  });

  totalRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: totalYellow } };
    cell.font = { bold: true };
    cell.border = { top: { style: 'double' }, left: { style: 'thin' }, bottom: { style: 'double' }, right: { style: 'thin' } };
  });
  totalRow.getCell('total_nilai').numFmt = '#,##0';

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `Laporan_Warga_RT03_${currentMonth}_${currentYear}.xlsx`);
};

export const generateTransactionReport = async (dataIuran) => {
  const workbook = new ExcelJS.Workbook();
  const sheet1 = workbook.addWorksheet('Data Transaksi');
  const exportDate = new Date().toLocaleString('id-ID');

  applyTitleStyling(sheet1.getCell('A1'), 'LAPORAN TRANSAKSI IURAN RT 03 - LIMO');
  applyTitleStyling(sheet1.getCell('A2'), `Tanggal Ekspor: ${exportDate}`, false);
  sheet1.mergeCells('A1:H1');
  sheet1.mergeCells('A2:H2');

  const startRow = 4;
  sheet1.getRow(startRow).values = ['No', 'Nama Warga', 'Periode', 'Jumlah (Rp)', 'Metode', 'Status', 'Jml Makam', 'Tanggal Bayar'];
  sheet1.columns = [
    { key: 'no', width: 5 },
    { key: 'nama', width: 30 },
    { key: 'periode', width: 20 },
    { key: 'jumlah', width: 18 },
    { key: 'metode', width: 15 },
    { key: 'status', width: 15 },
    { key: 'makam', width: 12 },
    { key: 'tanggal', width: 20 },
  ];

  const headerBlue = 'FFB5D4F4';
  const zebraGray = 'FFF1EFE8';
  const totalYellow = 'FFFAEEDA';

  sheet1.getRow(startRow).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerBlue } };
    cell.font = { bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
  });

  const getBulanName = (bln) => {
    const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return bulan[bln - 1] || bln;
  };

  dataIuran.forEach((item, index) => {
    const rowIdx = startRow + 1 + index;
    const row = sheet1.addRow({
      no: index + 1,
      nama: item.warga?.user?.nama || '-',
      periode: `${getBulanName(item.bulan)} ${item.tahun}`,
      jumlah: Number(item.jumlah),
      metode: item.metode || '-',
      status: item.status === 'lunas' ? 'Lunas' : item.status === 'pending' ? 'Pending' : 'Belum Bayar',
      makam: item.warga?.jumlahMakam || 1,
      tanggal: item.tanggalBayar ? new Date(item.tanggalBayar).toLocaleDateString('id-ID') : '-',
    });

    if (rowIdx % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebraGray } };
      });
    }

    row.eachCell((cell) => {
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    row.getCell('status').dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"Lunas,Pending,Belum Bayar"'],
    };

    row.getCell('jumlah').numFmt = '#,##0';
  });

  // --- SHEET 2: RINGKASAN ---
  const sheet2 = workbook.addWorksheet('Ringkasan');
  applyTitleStyling(sheet2.getCell('A1'), 'RINGKASAN TRANSAKSI IURAN');
  applyTitleStyling(sheet2.getCell('A2'), `Tanggal Ekspor: ${exportDate}`, false);
  sheet2.mergeCells('A1:C1');
  sheet2.mergeCells('A2:C2');

  const startRow2 = 4;
  sheet2.getRow(startRow2).values = ['Kategori', 'Total Item', 'Total Nilai (Rp)'];
  sheet2.columns = [
    { key: 'kategori', width: 30 },
    { key: 'total_item', width: 15 },
    { key: 'total_nilai', width: 25 },
  ];

  sheet2.getRow(startRow2).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerBlue } };
    cell.font = { bold: true };
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
  });

  const lastRow = dataIuran.length + startRow;
  const cats = ['Lunas', 'Pending', 'Belum Bayar'];
  cats.forEach((cat) => {
    const row = sheet2.addRow({
      kategori: `Status: ${cat}`,
      total_item: { formula: `=COUNTIF('Data Transaksi'!F${startRow + 1}:F${lastRow}, "${cat}")` },
      total_nilai: { formula: `=SUMIF('Data Transaksi'!F${startRow + 1}:F${lastRow}, "${cat}", 'Data Transaksi'!D${startRow + 1}:D${lastRow})` },
    });
    row.eachCell(c => c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } });
    row.getCell('total_nilai').numFmt = '#,##0';
  });

  const totalRow = sheet2.addRow({
    kategori: 'TOTAL KESELURUHAN',
    total_item: { formula: `=SUM(B${startRow2 + 1}:B${startRow2 + 3})` },
    total_nilai: { formula: `=SUM(C${startRow2 + 1}:C${startRow2 + 3})` },
  });

  totalRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: totalYellow } };
    cell.font = { bold: true };
    cell.border = { top: { style: 'double' }, left: { style: 'thin' }, bottom: { style: 'double' }, right: { style: 'thin' } };
  });
  totalRow.getCell('total_nilai').numFmt = '#,##0';

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `LAPORAN_TRANSAKSI_RT03_${new Date().toISOString().split('T')[0]}.xlsx`);
};
