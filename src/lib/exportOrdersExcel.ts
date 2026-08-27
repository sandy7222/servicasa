import ExcelJS from 'exceljs';
import type { ServiceOrder } from '../types';

const STATUS_LABELS: Record<ServiceOrder['status'], string> = {
  assigned: 'Asignada',
  in_progress: 'En curso',
  paused: 'Pausada',
  completed: 'Finalizada',
  cancelled: 'Cancelada',
};

const BRAND_NAVY = 'FF0F172A';
const BRAND_TEAL = 'FF0D9488';

const formatDate = (iso?: string) => (iso ? new Date(iso).toLocaleString('es-AR') : '');

/** #/hub?order=<id> opens that order's detail modal directly, even if archived
 * (AdminHubView reads this query param and looks it up in the full, unfiltered
 * orders list — see the deep-link effect near `selectedOrderId`). */
const detailUrlFor = (orderId: string) => `${window.location.origin}${window.location.pathname}#/hub?order=${orderId}`;

/** Builds a .xlsx styled like the TecniUrbano admin panel and downloads it. */
export async function downloadArchivedOrdersExcel(orders: ServiceOrder[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'TecniUrbano';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Órdenes archivadas', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = [
    { header: 'ID', key: 'id', width: 38 },
    { header: 'Título', key: 'title', width: 28 },
    { header: 'Rubro', key: 'serviceType', width: 18 },
    { header: 'Estado', key: 'status', width: 14 },
    { header: 'Cliente', key: 'clientName', width: 22 },
    { header: 'Dirección', key: 'clientAddress', width: 28 },
    { header: 'Técnico asignado', key: 'technician', width: 22 },
    { header: 'Creada', key: 'createdAt', width: 20 },
    { header: 'Cerrada', key: 'closedAt', width: 20 },
    { header: 'Estado de pago', key: 'paymentStatus', width: 16 },
    { header: 'Total presupuestado', key: 'totalQuoted', width: 18 },
    { header: 'Total pagado', key: 'totalPaid', width: 16 },
    { header: 'Ver ficha', key: 'detailLink', width: 14 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_NAVY } };
    cell.alignment = { vertical: 'middle' };
    cell.border = { bottom: { style: 'thin', color: { argb: BRAND_TEAL } } };
  });
  headerRow.height = 20;

  orders.forEach((order, index) => {
    const row = sheet.addRow({
      id: order.id,
      title: order.title,
      serviceType: order.serviceType,
      status: STATUS_LABELS[order.status] ?? order.status,
      clientName: order.clientName,
      clientAddress: order.clientAddress,
      technician: order.assignedTechnicianName ?? 'Sin asignar',
      createdAt: formatDate(order.createdAt),
      closedAt: formatDate(order.completedAt ?? order.cancelledAt),
      paymentStatus: order.paymentStatus ?? '',
      totalQuoted: order.totalQuotedAmount ?? 0,
      totalPaid: order.totalPaidAmount ?? 0,
    });
    if (index % 2 === 1) {
      row.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; });
    }
    row.getCell('totalQuoted').numFmt = '$#,##0';
    row.getCell('totalPaid').numFmt = '$#,##0';
    const linkCell = row.getCell('detailLink');
    linkCell.value = { text: 'Abrir ficha', hyperlink: detailUrlFor(order.id) };
    linkCell.font = { color: { argb: BRAND_TEAL }, underline: true, bold: true };
  });

  sheet.autoFilter = { from: 'A1', to: 'M1' };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `tecniurbano-ordenes-archivadas-${stamp}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
