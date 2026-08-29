import React from 'react';
import { CandidateFormData } from '../../types/candidate';
import { EmployeeItem } from '../../types/employee';
import { ContractFormData } from '../../types/contract';
import { AlertItem } from '../../types/alert';
import { UserGroupIcon, Briefcase01Icon, DocumentValidationIcon, Notification01Icon, BarChartIcon, Shield01Icon } from 'hugeicons-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

interface DashboardViewProps {
  candidates: CandidateFormData[];
  employees: EmployeeItem[];
  contracts: ContractFormData[];
  alerts: AlertItem[];
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  candidates,
  employees,
  contracts,
  alerts,
}) => {
  // Metricas
  const totalCandidates = candidates.length;
  const activeEmployees = employees.filter((e) => e.status === 'activo').length;
  const activeContracts = contracts.filter((c) => c.status === 'vigente').length;
  const pendingAlerts = alerts.filter((a) => a.status !== 'resuelta').length;

  // Datos para grafico de estado de candidatos
  const statusCounts: Record<string, number> = {};
  candidates.forEach((c) => {
    statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
  });

  const candidateChartData = [
    { name: 'Nuevo', cantidad: statusCounts['nuevo'] || 0 },
    { name: 'En Revision', cantidad: statusCounts['en_revision'] || 0 },
    { name: 'Preseleccionado', cantidad: statusCounts['preseleccionado'] || 0 },
    { name: 'En Entrevista', cantidad: statusCounts['en_entrevista'] || 0 },
    { name: 'Contratado', cantidad: statusCounts['contratado'] || 0 },
    { name: 'Descartado', cantidad: statusCounts['descartado'] || 0 },
  ];

  // Datos para grafico de tipo de contratos
  const contractTypeCounts: Record<string, number> = {};
  contracts.forEach((c) => {
    const key = c.contractType.replace(/_/g, ' ');
    contractTypeCounts[key] = (contractTypeCounts[key] || 0) + 1;
  });

  const contractChartData = Object.entries(contractTypeCounts).map(([name, value]) => ({
    name,
    value,
  }));

  const COLORS = ['#16a34a', '#0284c7', '#8b5cf6', '#f59e0b', '#ef4444'];

  return (
    <div className="space-y-6">
      {/* Tarjetas de Metricas Clave */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-navy-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-blue-100 text-blue-700 rounded-lg">
            <UserGroupIcon className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-navy-500 uppercase tracking-wider">Candidatos</span>
            <h3 className="text-2xl font-extrabold text-navy-900">{totalCandidates}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-navy-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-green-100 text-green-700 rounded-lg">
            <Briefcase01Icon className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-navy-500 uppercase tracking-wider">Empleados Activos</span>
            <h3 className="text-2xl font-extrabold text-navy-900">{activeEmployees}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-navy-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-purple-100 text-purple-700 rounded-lg">
            <DocumentValidationIcon className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-navy-500 uppercase tracking-wider">Contratos Vigentes</span>
            <h3 className="text-2xl font-extrabold text-navy-900">{activeContracts}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-navy-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-amber-100 text-amber-700 rounded-lg">
            <Notification01Icon className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-navy-500 uppercase tracking-wider">Alertas Pendientes</span>
            <h3 className="text-2xl font-extrabold text-navy-900">{pendingAlerts}</h3>
          </div>
        </div>
      </div>

      {/* Graficos Estadisticos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Grafico de Candidatos por Estado */}
        <div className="bg-white p-5 rounded-xl border border-navy-200 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-navy-900 flex items-center">
            <BarChartIcon className="h-4 w-4 mr-1.5 text-brand-600" />
            Candidatos por Estado en el Pipeline
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={candidateChartData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="cantidad" fill="#16a34a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Grafico de Contratos por Tipo */}
        <div className="bg-white p-5 rounded-xl border border-navy-200 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-navy-900 flex items-center">
            <DocumentValidationIcon className="h-4 w-4 mr-1.5 text-brand-600" />
            Distribucion de Contratos por Tipo
          </h3>
          <div className="h-64">
            {contractChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={contractChartData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }: { name?: string; percent?: number }) => `${name || ''}: ${((percent || 0) * 100).toFixed(0)}%`}
                  >
                    {contractChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-navy-400 italic">
                No hay contratos suficientes para graficar.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
