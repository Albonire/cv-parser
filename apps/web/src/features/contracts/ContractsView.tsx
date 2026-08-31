import React, { useState } from 'react';
import { ContractFormData } from '../../types/contract';
import { Search01Icon } from 'hugeicons-react';

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
      <div className="flex flex-col items-start justify-between gap-4 pt-8 sm:flex-row sm:items-center">
        <p className="text-caption text-steel">
            {filteredContracts.length} {filteredContracts.length === 1 ? 'contrato' : 'contratos'}
          </p>

        <div className="relative w-full sm:w-64">
          <Search01Icon className="h-4 w-4 absolute left-3 top-2.5 text-steel" />
          <input
            type="text"
            placeholder="Buscar por trabajador, cargo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-fog rounded-lg text-xs focus:outline-none"
          />
        </div>
      </div>

      <div className="bg-paper rounded-lg border border-fog overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-mist text-left text-xs">
            <thead className="bg-mist text-steel font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Trabajador</th>
                <th className="px-4 py-3">Cargo</th>
                <th className="px-4 py-3">Tipo Contrato</th>
                <th className="px-4 py-3">Salario</th>
                <th className="px-4 py-3">Vigencia</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mist bg-paper">
              {filteredContracts.map((con) => (
                <tr key={con.id} className="hover:bg-paper transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-ink">{con.workerName}</div>
                    <div className="text-[11px] text-steel font-mono">CC: {con.workerDocumentNumber}</div>
                  </td>
                  <td className="px-4 py-3 font-medium text-ink">{con.position}</td>
                  <td className="px-4 py-3 text-steel capitalize">
                    {con.contractType.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-3 font-semibold text-ink">
                    ${con.salary.toLocaleString('es-CO')} COP
                  </td>
                  <td className="px-4 py-3 text-steel">
                    <div>Inicio: {con.startDate}</div>
                    <div className="text-[11px] text-steel">
                      Fin: {con.endDate || 'Indefinido'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      con.status === 'vigente' ? 'border border-ink text-ink font-semibold' : 'bg-warning-surface text-warning'
                    }`}>
                      {con.status}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredContracts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-steel italic">
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
