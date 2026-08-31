import React from 'react';
import { CandidateFormData } from '../../types/candidate';
import { EmployeeItem } from '../../types/employee';
import { ContractFormData } from '../../types/contract';
import { Download01Icon } from 'hugeicons-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface ReportsViewProps {
  candidates: CandidateFormData[];
  employees: EmployeeItem[];
  contracts: ContractFormData[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  candidates,
  employees,
  contracts,
}) => {
  // Exportar Candidatos a Excel
  const exportCandidatesToExcel = () => {
    const data = candidates.map((c) => ({
      Nombres: c.firstNames,
      Apellidos: c.lastNames,
      Documento: `${c.documentType} ${c.documentNumber}`,
      Email: c.email || '',
      Telefono: c.phone || '',
      Ciudad: c.cityResidence || '',
      Direccion: c.address || '',
      LugarNacimiento: c.birthPlace || '',
      Genero: c.gender || '',
      EstadoCivil: c.maritalStatus || '',
      LicenciaConduccion: c.driverLicense || '',
      LibretaMilitar: c.militaryCard || '',
      TarjetaProfesional: c.professionalCard || '',
      RedesSociales: c.socialLinks ? c.socialLinks.join(', ') : '',
      AspiracionSalarial: c.salaryExpectation ? `$${c.salaryExpectation.toLocaleString('es-CO')}` : '',
      Disponibilidad: c.availability || '',
      Estado: c.status,
      Titular: c.headline || '',
      Idiomas: (c.languages || []).map((l) => `${l.language} (${l.level})`).join(', '),
      Certificaciones: (c.certifications || []).map((ct) => `${ct.name} ${ct.year ? `(${ct.year})` : ''}`).join('; '),
      Habilidades: c.skills.map((s) => s.skillName).join(', '),
      Educacion: c.education.map((e) => `${e.level}: ${e.degree} (${e.institution})`).join('; '),
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Candidatos');
    XLSX.writeFile(workbook, `Rosimar_Candidatos_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Exportar Empleados a Excel
  const exportEmployeesToExcel = () => {
    const data = employees.map((emp) => ({
      Codigo: emp.employeeCode,
      Nombres: emp.candidateData.firstNames,
      Apellidos: emp.candidateData.lastNames,
      Documento: `${emp.candidateData.documentType} ${emp.candidateData.documentNumber}`,
      Estado: emp.status,
      FechaIngreso: emp.hireDate,
      FechaSalida: emp.terminationDate || '',
      RazonSalida: emp.terminationReason || '',
      Memorandos: emp.memoCount,
      Email: emp.candidateData.email || '',
      Telefono: emp.candidateData.phone || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Empleados');
    XLSX.writeFile(workbook, `Rosimar_Empleados_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Exportar Contratos a Excel
  const exportContractsToExcel = () => {
    const data = contracts.map((con) => ({
      Trabajador: con.workerName,
      Documento: con.workerDocumentNumber,
      Cargo: con.position,
      TipoContrato: con.contractType,
      Salario: con.salary,
      FormaPago: con.paymentFrequency,
      FechaInicio: con.startDate,
      FechaVencimiento: con.endDate || 'Indefinido',
      PeriodoPruebaDias: con.trialPeriodDays,
      Estado: con.status,
      LugarEjecucion: con.executionPlace,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Contratos');
    XLSX.writeFile(workbook, `Rosimar_Contratos_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Exportar Informe General en PDF
  const exportPdfReport = () => {
    const doc = new jsPDF();

    // Membrete Institucional Rosimar S.A.S.
    doc.setFontSize(16);
    doc.setTextColor(22, 101, 52); // Brand green
    doc.text('ROSIMAR S.A.S. — GESTION DE TALENTO HUMANO', 14, 18);

    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text('Informe General de Talento Humano y Hojas de Vida', 14, 25);
    doc.text(`Fecha de emision: ${new Date().toLocaleDateString('es-CO')}`, 14, 30);
    doc.line(14, 33, 196, 33);

    // Resumen Ejecutivo
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('Resumen Ejecutivo', 14, 42);

    const summaryData = [
      ['Total Candidatos Registrados', candidates.length.toString()],
      ['Empleados Activos en Plantilla', employees.filter((e) => e.status === 'activo').length.toString()],
      ['Empleados Inactivos', employees.filter((e) => e.status === 'inactivo').length.toString()],
      ['Contratos Vigentes', contracts.filter((c) => c.status === 'vigente').length.toString()],
    ];

    autoTable(doc, {
      startY: 46,
      head: [['Metrica', 'Cantidad']],
      body: summaryData,
      theme: 'grid',
      headStyles: { fillColor: [22, 163, 74] },
      styles: { fontSize: 9 },
    });

    // Tabla de Empleados Activos
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lastY = (doc as any).lastAutoTable.finalY + 12;
    doc.setFontSize(12);
    doc.text('Plantilla de Empleados Activos', 14, lastY);

    const empTableData = employees
      .filter((e) => e.status === 'activo')
      .map((e) => [
        e.employeeCode,
        `${e.candidateData.firstNames} ${e.candidateData.lastNames}`,
        `${e.candidateData.documentType} ${e.candidateData.documentNumber}`,
        e.hireDate,
        e.memoCount.toString(),
      ]);

    autoTable(doc, {
      startY: lastY + 4,
      head: [['Codigo', 'Empleado', 'Documento', 'Fecha Ingreso', 'Memorandos']],
      body: empTableData.length > 0 ? empTableData : [['Sin registros', '', '', '', '']],
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 8 },
    });

    doc.save(`Rosimar_Informe_TalentoHumano_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-paper p-4 rounded-lg border border-fog flex items-center space-x-3">
        <Download01Icon className="h-6 w-6 text-steel" />
        <div>
          <h2 className="text-lg font-bold text-ink">
            Modulo de Reportes e Informes (M10)
          </h2>
          <p className="text-xs text-steel">
            Exporta listados y documentos con logo y formato institucional para Rosimar S.A.S.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Reportes en Excel */}
        <div className="bg-paper p-5 rounded-lg border border-fog space-y-4">
          <h3 className="text-sm font-bold text-ink flex items-center">
            Exportacion a Microsoft Excel (.xlsx)
          </h3>
          <p className="text-xs text-steel">
            Genera hojas de calculo con todos los campos estructurados para analisis o respaldo.
          </p>
          <div className="space-y-2">
            <button
              onClick={exportCandidatesToExcel}
              className="w-full flex items-center justify-between p-3 bg-mist hover:bg-mist rounded-lg border border-fog text-xs font-semibold text-ink transition-colors"
            >
              <span>Exportar Listado de Candidatos ({candidates.length})</span>
              <Download01Icon className="h-4 w-4 text-steel" />
            </button>
            <button
              onClick={exportEmployeesToExcel}
              className="w-full flex items-center justify-between p-3 bg-mist hover:bg-mist rounded-lg border border-fog text-xs font-semibold text-ink transition-colors"
            >
              <span>Exportar Plantilla de Empleados ({employees.length})</span>
              <Download01Icon className="h-4 w-4 text-steel" />
            </button>
            <button
              onClick={exportContractsToExcel}
              className="w-full flex items-center justify-between p-3 bg-mist hover:bg-mist rounded-lg border border-fog text-xs font-semibold text-ink transition-colors"
            >
              <span>Exportar Contratos Laborales ({contracts.length})</span>
              <Download01Icon className="h-4 w-4 text-steel" />
            </button>
          </div>
        </div>

        {/* Informes en PDF */}
        <div className="bg-paper p-5 rounded-lg border border-fog space-y-4">
          <h3 className="text-sm font-bold text-ink flex items-center">
            Informes Oficiales en PDF (con Membrete)
          </h3>
          <p className="text-xs text-steel">
            Genera documentos formateados listos para impresion con membrete oficial de Rosimar S.A.S.
          </p>
          <div className="space-y-2">
            <button
              onClick={exportPdfReport}
              className="w-full flex items-center justify-between p-3 bg-mist hover:bg-mist rounded-lg border border-fog text-xs font-semibold text-ink transition-colors"
            >
              <span>Descargar Informe General Ejecutivo (PDF)</span>
              <Download01Icon className="h-4 w-4 text-steel" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
