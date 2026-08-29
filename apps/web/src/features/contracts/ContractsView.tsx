import React, { useState } from 'react';
import { ContractFormData } from '../../types/contract';
import { DocumentValidationIcon, Search01Icon, Calendar01Icon, Dollar01Icon, Clock01Icon } from 'hugeicons-react';

interface ContractsViewProps {
  contracts: ContractFormData[];
  onReload: () => void;
}

export const ContractsView: React.FC<ContractsViewProps> = ({ contracts }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredContracts = contracts.filter((c) =>
    `${c.workerName} ${c.workerDocumentNumber} ${c.position} ${c.contractType}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-xl border border-navy-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <DocumentValidationIcon className="h-6 w-6 text-brand-600" />
          <h2 className="text-lg font-bold text-navy-900">
            Contratos Laborales Registrados ({filteredContracts.length})
          </h2>
        </div>

        <div className="relative w-full sm:w-64">
          <Search01Icon className="h-4 w-4 absolute left-3 top-2.5 text-navy-400" />
          <input
            type="text"
            placeholder="Buscar por trabajador, cargo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-navy-300 rounded-lg text-xs focus:outline-none"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-navy-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-navy-200 text-left text-xs">
            <thead className="bg-navy-50 text-navy-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Trabajador</th>
                <th className="px-4 py-3">Cargo</th>
                <th className="px-4 py-3">Tipo Contrato</th>
                <th className="px-4 py-3">Salario</th>
                <th className="px-4 py-3">Vigencia</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100 bg-white">
              {filteredContracts.map((con) => (
                <tr key={con.id} className="hover:bg-navy-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-navy-900">{con.workerName}</div>
                    <div className="text-[11px] text-navy-500 font-mono">CC: {con.workerDocumentNumber}</div>
                  </td>
                  <td className="px-4 py-3 font-medium text-navy-700">{con.position}</td>
                  <td className="px-4 py-3 text-navy-600 capitalize">
                    {con.contractType.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-3 font-semibold text-brand-700">
                    ${con.salary.toLocaleString('es-CO')} COP
                  </td>
                  <td className="px-4 py-3 text-navy-600">
                    <div>Inicio: {con.startDate}</div>
                    <div className="text-[11px] text-navy-500">
                      Fin: {con.endDate || 'Indefinido'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      con.status === 'vigente' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {con.status}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredContracts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-navy-400 italic">
                    No hay contratos registrados. Puedes escanearlos desde el <strong>Lector OCR</strong>.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
