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

export const generateExcelReport = async (wargaData, iuranData, targetMonth, targetYear) => {
  const workbook = new ExcelJS.Workbook();
  const sheet1 = workbook.addWorksheet('Data Warga & Tagihan');

  const currentMonth = targetMonth !== undefined ? parseInt(targetMonth) : new Date().getMonth() + 1;
  const currentYear = targetYear !== undefined ? parseInt(targetYear) : new Date().getFullYear();
  const exportDate = new Date().toLocaleString('id-ID');

  const getBulanName = (bln) => {
    const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return bulan[bln - 1] || bln;
  };

  // --- TITLES ---
  applyTitleStyling(sheet1.getCell('A1'), 'LAPORAN DATA WARGA & TAGIHAN IURAN RT 03 - LIMO');
  applyTitleStyling(sheet1.getCell('A2'), `Tanggal Ekspor: ${exportDate}`, false);
  sheet1.mergeCells('A1:J1');
  sheet1.mergeCells('A2:J2');
  sheet1.getRow(1).height = 30;

  // Define Columns starting from row 4
  const startRow = 4;
  sheet1.getRow(startRow).values = ['NO', 'NO KK', 'NAMA', 'NIK', 'NO RUMAH', 'IURAN WARGA', 'IURAN MAKAM', 'PERIODE', 'JUMLAH (Rp)', 'STATUS'];
  
  sheet1.columns = [
    { key: 'no', width: 5 },
    { key: 'noKK', width: 20 },
    { key: 'nama', width: 30 },
    { key: 'nik', width: 20 },
    { key: 'noRumah', width: 12 },
    { key: 'iuranWarga', width: 15 },
    { key: 'iuranMakam', width: 15 },
    { key: 'periode', width: 18 },
    { key: 'jumlah', width: 18 },
    { key: 'status', width: 15 },
  ];

  const headerBlue = 'FFB5D4F4';
  const zebraGray = 'FFF1EFE8';
  const totalYellow = 'FFFAEEDA';
  const kepalaKKColor = 'FFE8F4EA';

  // Header Styling
  sheet1.getRow(startRow).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerBlue } };
    cell.font = { bold: true };
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // Build rows: each warga with kepala keluarga + anggota keluarga
  // Sort: Lunas first, then Pending, then Belum
  const sortedWargaData = [...wargaData].sort((a, b) => {
    const getStatus = (w) => {
      const iuranWarga = iuranData.find(i => i.wargaId === w.id && i.tipe === 'warga' && i.bulan === currentMonth && i.tahun === currentYear);
      const iuranMakam = iuranData.find(i => i.wargaId === w.id && i.tipe === 'makam' && i.bulan === currentMonth && i.tahun === currentYear);
      const wargaLunas = iuranWarga?.status === 'lunas';
      const makamLunas = iuranMakam?.status === 'lunas';
      const wargaPending = iuranWarga?.status === 'pending';
      const makamPending = iuranMakam?.status === 'pending';
      if (wargaLunas && makamLunas) return 0; // Lunas
      if (wargaPending || makamPending) return 1; // Pending
      return 2; // Belum
    };
    return getStatus(a) - getStatus(b);
  });

  let rowNum = 0;
  sortedWargaData.forEach((w) => {
    const nomorKK = w.user?.nomorKK || '-';
    const noRumah = w.alamat || '-';
    
    // Get iuran data for this warga
    const iuranWarga = iuranData.find(i => i.wargaId === w.id && i.tipe === 'warga' && i.bulan === currentMonth && i.tahun === currentYear);
    const iuranMakam = iuranData.find(i => i.wargaId === w.id && i.tipe === 'makam' && i.bulan === currentMonth && i.tahun === currentYear);
    
    const iuranWargaStatus = iuranWarga ? (iuranWarga.status === 'lunas' ? 'Lunas' : iuranWarga.status === 'pending' ? 'Pending' : 'Belum') : '-';
    const iuranMakamStatus = iuranMakam ? (iuranMakam.status === 'lunas' ? 'Lunas' : iuranMakam.status === 'pending' ? 'Pending' : 'Belum') : '-';
    const totalJumlah = (iuranWarga ? Number(iuranWarga.jumlah) : 0) + (iuranMakam ? Number(iuranMakam.jumlah) : 0);
    const overallStatus = (iuranWargaStatus === 'Lunas' && iuranMakamStatus === 'Lunas') ? 'Lunas' : 
                          (iuranWargaStatus === 'Pending' || iuranMakamStatus === 'Pending') ? 'Pending' : 'Belum';
    
    // Row 1: Kepala Keluarga
    rowNum++;
    const kepalaRow = sheet1.addRow({
      no: rowNum,
      noKK: nomorKK,
      nama: w.user?.nama || '-',
      nik: w.user?.nik || '-',
      noRumah: noRumah,
      iuranWarga: iuranWargaStatus,
      iuranMakam: iuranMakamStatus,
      periode: `${getBulanName(currentMonth)} ${currentYear}`,
      jumlah: totalJumlah,
      status: overallStatus,
    });
    
    // Style kepala keluarga row (bold, light green background)
    kepalaRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kepalaKKColor } };
      cell.font = { bold: true };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
    kepalaRow.getCell('jumlah').numFmt = '#,##0';
    
    // Rows for anggota keluarga
    const anggotaList = Array.isArray(w.anggotaKeluarga) ? w.anggotaKeluarga : [];
    anggotaList.forEach((anggota) => {
      const anggotaRow = sheet1.addRow({
        no: '',
        noKK: '',
        nama: anggota.nama || '-',
        nik: anggota.nik || '-',
        noRumah: '',
        iuranWarga: '',
        iuranMakam: '',
        periode: '',
        jumlah: '',
        status: '',
      });
      
      anggotaRow.eachCell((cell) => {
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });
      // Indent anggota nama
      anggotaRow.getCell('nama').alignment = { indent: 2 };
    });
  });

  // --- SHEET 2: RINGKASAN ---
  const sheet2 = workbook.addWorksheet('Ringkasan');
  applyTitleStyling(sheet2.getCell('A1'), 'RINGKASAN LAPORAN DATA WARGA');
  applyTitleStyling(sheet2.getCell('A2'), `Tanggal Ekspor: ${exportDate}`, false);
  sheet2.mergeCells('A1:C1');
  sheet2.mergeCells('A2:C2');

  const startRow2 = 4;
  sheet2.getRow(startRow2).values = ['Kategori', 'Total KK', 'Total Nilai (Rp)'];
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

  // Calculate summary
  const totalKK = wargaData.length;
  const totalAnggota = wargaData.reduce((sum, w) => sum + (Array.isArray(w.anggotaKeluarga) ? w.anggotaKeluarga.length : 0), 0);
  const totalOrang = totalKK + totalAnggota;
  
  const iuranWargaLunas = iuranData.filter(i => i.tipe === 'warga' && i.bulan === currentMonth && i.tahun === currentYear && i.status === 'lunas');
  const iuranMakamLunas = iuranData.filter(i => i.tipe === 'makam' && i.bulan === currentMonth && i.tahun === currentYear && i.status === 'lunas');
  const totalWargaTerkumpul = iuranWargaLunas.reduce((sum, i) => sum + Number(i.jumlah), 0);
  const totalMakamTerkumpul = iuranMakamLunas.reduce((sum, i) => sum + Number(i.jumlah), 0);

  const summaryData = [
    { kategori: 'Total Kepala Keluarga (KK)', total_item: totalKK, total_nilai: '-' },
    { kategori: 'Total Anggota Keluarga', total_item: totalAnggota, total_nilai: '-' },
    { kategori: 'Total Orang', total_item: totalOrang, total_nilai: '-' },
    { kategori: 'Iuran Warga Terkumpul', total_item: iuranWargaLunas.length, total_nilai: totalWargaTerkumpul },
    { kategori: 'Iuran Makam Terkumpul', total_item: iuranMakamLunas.length, total_nilai: totalMakamTerkumpul },
  ];

  summaryData.forEach((item) => {
    const row = sheet2.addRow(item);
    row.eachCell(c => c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } });
    if (typeof item.total_nilai === 'number') row.getCell('total_nilai').numFmt = '#,##0';
  });

  const totalRow = sheet2.addRow({
    kategori: 'TOTAL TERKUMPUL',
    total_item: iuranWargaLunas.length + iuranMakamLunas.length,
    total_nilai: totalWargaTerkumpul + totalMakamTerkumpul,
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

export const generateTransactionReport = async (dataIuran, wargaData, selectedBulan = 'SEMUA', selectedTahun = 'SEMUA') => {
  const workbook = new ExcelJS.Workbook();
  const sheet1 = workbook.addWorksheet('Data Transaksi');
  const exportDate = new Date().toLocaleString('id-ID');

  const getBulanName = (bln) => {
    const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return bulan[bln - 1] || bln;
  };

  let periodTitle = '';
  if (selectedBulan !== 'SEMUA' && selectedTahun !== 'SEMUA') {
    periodTitle = ` - PERIODE ${getBulanName(parseInt(selectedBulan)).toUpperCase()} ${selectedTahun}`;
  } else if (selectedBulan === 'SEMUA' && selectedTahun !== 'SEMUA') {
    periodTitle = ` - TAHUN ${selectedTahun}`;
  } else if (selectedBulan !== 'SEMUA' && selectedTahun === 'SEMUA') {
    periodTitle = ` - BULAN ${getBulanName(parseInt(selectedBulan)).toUpperCase()}`;
  }

  applyTitleStyling(sheet1.getCell('A1'), `LAPORAN TRANSAKSI IURAN RT 03 - LIMO${periodTitle}`);
  sheet1.getRow(1).height = 30;
  applyTitleStyling(sheet1.getCell('A2'), `Tanggal Ekspor: ${exportDate}`, false);
  sheet1.mergeCells('A1:J1');
  sheet1.mergeCells('A2:J2');

  const startRow = 4;
  sheet1.getRow(startRow).values = ['NO', 'NAMA', 'NIK', 'IURAN WARGA', 'IURAN MAKAM', 'PERIODE', 'JUMLAH (Rp)', 'METODE', 'STATUS', 'TANGGAL BAYAR'];
  sheet1.columns = [
    { key: 'no', width: 5 },
    { key: 'nama', width: 40 },
    { key: 'nik', width: 22, style: { numFmt: '@' } },
    { key: 'iuranWarga', width: 15 },
    { key: 'iuranMakam', width: 15 },
    { key: 'periode', width: 18 },
    { key: 'jumlah', width: 18 },
    { key: 'metode', width: 18 },
    { key: 'status', width: 15 },
    { key: 'tanggalBayar', width: 18 },
  ];

  const headerBlue = 'FFB5D4F4';
  const zebraGray = 'FFF1EFE8';
  const totalYellow = 'FFFAEEDA';
  const lunasColor = 'FFE8F4EA';
  const belumColor = 'FFFDE8E8';

  sheet1.getRow(startRow).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerBlue } };
    cell.font = { bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
  });

  // Group iuran by wargaId and periode
  const groupedData = {};
  dataIuran.forEach((item) => {
    const key = `${item.wargaId}-${item.bulan}-${item.tahun}`;
    if (!groupedData[key]) {
      groupedData[key] = {
        wargaId: item.wargaId,
        warga: item.warga,
        bulan: item.bulan,
        tahun: item.tahun,
        iuranWarga: null,
        iuranMakam: null,
      };
    }
    if (item.tipe === 'warga') {
      groupedData[key].iuranWarga = item;
    } else {
      groupedData[key].iuranMakam = item;
    }
  });

  // Convert to array and sort (Lunas first)
  const sortedData = Object.values(groupedData).sort((a, b) => {
    const getStatus = (g) => {
      const wargaLunas = g.iuranWarga?.status === 'lunas';
      const makamLunas = g.iuranMakam?.status === 'lunas';
      if (wargaLunas && makamLunas) return 0;
      if (g.iuranWarga?.status === 'pending' || g.iuranMakam?.status === 'pending') return 1;
      return 2;
    };
    return getStatus(a) - getStatus(b);
  });

  let rowNum = 0;
  sortedData.forEach((group) => {
    // Build nama with anggota keluarga (multi-line format)
    const wargaInfo = wargaData?.find(w => w.id === group.wargaId);
    const kepalaName = group.warga?.user?.nama || wargaInfo?.user?.nama || '-';
    const anggotaList = wargaInfo?.anggotaKeluarga || [];
    
    // Format: Kepala Keluarga\n- anggota 1\n- anggota 2\n dst
    // NIK must be string to prevent Excel from converting to scientific notation
    const kepalanik = String(group.warga?.user?.nik || wargaInfo?.user?.nik || '-');
    let fullName = kepalaName;
    let fullNik = kepalanik;
    if (Array.isArray(anggotaList) && anggotaList.length > 0) {
      const anggotaLines = anggotaList.map(a => `- ${a.nama || '-'}`).join('\n');
      const nikLines = anggotaList.map(a => String(a.nik || '-')).join('\n');
      fullName = `${kepalaName}\n${anggotaLines}`;
      fullNik = `${kepalanik}\n${nikLines}`;
    }
    
    const iuranWargaJumlah = group.iuranWarga ? Number(group.iuranWarga.jumlah) : 0;
    const iuranMakamJumlah = group.iuranMakam ? Number(group.iuranMakam.jumlah) : 0;
    const totalJumlah = iuranWargaJumlah + iuranMakamJumlah;
    
    const wargaLunas = group.iuranWarga?.status === 'lunas';
    const makamLunas = group.iuranMakam?.status === 'lunas';
    const wargaPending = group.iuranWarga?.status === 'pending';
    const makamPending = group.iuranMakam?.status === 'pending';
    
    const overallStatus = (wargaLunas && makamLunas) ? 'Lunas' : 
                          (wargaPending || makamPending) ? 'Pending' : 'Belum Bayar';
    
    const metode = group.iuranWarga?.metode || group.iuranMakam?.metode || '-';
    const tanggalBayar = group.iuranWarga?.tanggalBayar || group.iuranMakam?.tanggalBayar;
    const tanggalBayarStr = tanggalBayar ? new Date(tanggalBayar).toLocaleDateString('id-ID') : '-';
    
    rowNum++;
    const row = sheet1.addRow({
      no: rowNum,
      nama: fullName,
      nik: fullNik,
      iuranWarga: iuranWargaJumlah || '-',
      iuranMakam: iuranMakamJumlah || '-',
      periode: `${getBulanName(group.bulan)} ${group.tahun}`,
      jumlah: totalJumlah,
      metode: metode,
      status: overallStatus,
      tanggalBayar: tanggalBayarStr,
    });

    // Calculate row height based on number of lines (more space per line)
    const lineCount = fullName.split('\n').length;
    row.height = Math.max(25, lineCount * 18);

    // Style row based on status
    const bgColor = overallStatus === 'Lunas' ? lunasColor : overallStatus === 'Belum Bayar' ? belumColor : zebraGray;
    row.eachCell((cell, colNumber) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      // Center alignment for all columns except NAMA (column 2) and NIK (column 3)
      if (colNumber !== 2 && colNumber !== 3) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
    });

    if (typeof iuranWargaJumlah === 'number' && iuranWargaJumlah > 0) row.getCell('iuranWarga').numFmt = '#,##0';
    if (typeof iuranMakamJumlah === 'number' && iuranMakamJumlah > 0) row.getCell('iuranMakam').numFmt = '#,##0';
    row.getCell('jumlah').numFmt = '#,##0';
    row.getCell('nama').alignment = { wrapText: true, vertical: 'middle' };
    // Force NIK to be text format to preserve all 16 digits
    row.getCell('nik').numFmt = '@';
    row.getCell('nik').alignment = { wrapText: true, vertical: 'middle' };
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

  const lastRow = sortedData.length + startRow;
  const cats = ['Lunas', 'Pending', 'Belum Bayar'];
  cats.forEach((cat) => {
    const row = sheet2.addRow({
      kategori: `Status: ${cat}`,
      total_item: { formula: `=COUNTIF('Data Transaksi'!I${startRow + 1}:I${lastRow}, "${cat}")` },
      total_nilai: { formula: `=SUMIF('Data Transaksi'!I${startRow + 1}:I${lastRow}, "${cat}", 'Data Transaksi'!G${startRow + 1}:G${lastRow})` },
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
  
  let filename = 'LAPORAN_TRANSAKSI_RT03';
  if (selectedBulan !== 'SEMUA') {
    filename += `_${getBulanName(parseInt(selectedBulan)).toUpperCase()}`;
  }
  if (selectedTahun !== 'SEMUA') {
    filename += `_${selectedTahun}`;
  }
  filename += `_${new Date().toISOString().split('T')[0]}.xlsx`;

  saveAs(blob, filename);
};
