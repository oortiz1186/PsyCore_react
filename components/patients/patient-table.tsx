'use client';

import Link from 'next/link';

export type PatientTableRow = {
  id: string;
  name: string;
  age: number | null;
  phone?: string | null;
  email?: string | null;
  status: string;
  psychologist?: string | null;
  clinicalAlert?: string | null;
};

type Props = {
  rows: PatientTableRow[];
  onEdit: (id: string) => void;
};

export function PatientTable({ rows, onEdit }: Props) {
  return (
    <div className="card table-wrap patient-table-card">
      <table className="table patient-table">
        <thead>
          <tr>
            <th>Paciente</th>
            <th>Edad</th>
            <th>Psicóloga</th>
            <th>Contacto</th>
            <th>Estado</th>
            <th>Alerta</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((patient) => (
            <tr key={patient.id}>
              <td><strong>{patient.name}</strong></td>
              <td>{patient.age === null ? '—' : `${patient.age} años`}</td>
              <td>{patient.psychologist || 'Sin asignar'}</td>
              <td>
                <span>{patient.phone || 'Sin teléfono'}</span>
                <small className="table-subtext">{patient.email || 'Sin correo'}</small>
              </td>
              <td><span className="chip">{patient.status}</span></td>
              <td>{patient.clinicalAlert ? <span className="patient-alert-dot" title={patient.clinicalAlert}>Alerta</span> : '—'}</td>
              <td>
                <div className="row-actions">
                  <Link className="btn btn-primary btn-small" href={`/patients/${patient.id}`}>Expediente</Link>
                  <button className="btn btn-secondary btn-small" type="button" onClick={() => onEdit(patient.id)}>Editar</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
