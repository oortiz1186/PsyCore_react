'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { Download, Eye, FileText, Image as ImageIcon, Trash2, UploadCloud } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

type PatientFile = {
  id: string;
  storage_path: string;
  original_name: string;
  display_name: string;
  document_type: string;
  description?: string | null;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string;
  created_at: string;
};

type Props = {
  patientId: string;
  psychologistId?: string | null;
};

const documentTypes = ['Consentimiento','Evaluación','Receta','Estudio','Identificación','Administrativo','Otro'];
const maxBytes = 10 * 1024 * 1024;

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function safeName(name: string) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-');
}

export function PatientFilesPanel({ patientId, psychologistId }: Props) {
  const [rows, setRows] = useState<PatientFile[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [documentType, setDocumentType] = useState('Consentimiento');
  const [description, setDescription] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState('');

  const canUpload = useMemo(() => Boolean(currentUserId && psychologistId === currentUserId), [currentUserId, psychologistId]);

  async function load() {
    setLoading(true);
    setMessage('');
    const supabase = getSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || '');
    const result = await supabase
      .from('patient_files')
      .select('id,storage_path,original_name,display_name,document_type,description,mime_type,size_bytes,uploaded_by,created_at')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });
    if (result.error) setMessage(result.error.message);
    else setRows((result.data || []) as PatientFile[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [patientId]);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] || null;
    setMessage('');
    if (selected && selected.size > maxBytes) {
      setFile(null);
      setMessage('El archivo supera el límite de 10 MB.');
      return;
    }
    setFile(selected);
    if (selected && !displayName) setDisplayName(selected.name.replace(/\.[^.]+$/, ''));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(''); setSuccess('');
    if (!file) return setMessage('Selecciona un archivo.');
    if (!displayName.trim()) return setMessage('Captura un nombre visible.');
    if (!canUpload) return setMessage('Solo la psicóloga asignada puede subir archivos clínicos.');

    setUploading(true);
    const supabase = getSupabaseBrowser();
    const extension = file.name.includes('.') ? `.${file.name.split('.').pop()}` : '';
    const path = `${patientId}/${currentUserId}/${crypto.randomUUID()}-${safeName(displayName)}${extension}`;

    const upload = await supabase.storage.from('patient-files').upload(path, file, { contentType: file.type, upsert: false });
    if (upload.error) {
      setUploading(false);
      return setMessage(upload.error.message);
    }

    const insert = await supabase.from('patient_files').insert({
      patient_id: patientId,
      storage_path: path,
      original_name: file.name,
      display_name: displayName.trim(),
      document_type: documentType,
      description: description.trim() || null,
      mime_type: file.type || 'application/octet-stream',
      size_bytes: file.size,
      uploaded_by: currentUserId,
    });

    if (insert.error) {
      await supabase.storage.from('patient-files').remove([path]);
      setUploading(false);
      return setMessage(insert.error.message);
    }

    setFile(null); setDisplayName(''); setDescription('');
    setSuccess('Archivo cargado correctamente.');
    setUploading(false);
    await load();
  }

  async function openFile(item: PatientFile, download = false) {
    setMessage('');
    const supabase = getSupabaseBrowser();
    const result = await supabase.storage.from('patient-files').createSignedUrl(item.storage_path, 60, { download: download ? item.original_name : false });
    if (result.error || !result.data?.signedUrl) return setMessage(result.error?.message || 'No se pudo abrir el archivo.');
    window.open(result.data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  async function removeFile(item: PatientFile) {
    if (item.uploaded_by !== currentUserId) return setMessage('Solo quien subió el archivo puede eliminarlo.');
    if (!window.confirm(`¿Eliminar “${item.display_name}”? Esta acción no se puede deshacer.`)) return;
    const supabase = getSupabaseBrowser();
    const storageResult = await supabase.storage.from('patient-files').remove([item.storage_path]);
    if (storageResult.error) return setMessage(storageResult.error.message);
    const dbResult = await supabase.from('patient_files').delete().eq('id', item.id);
    if (dbResult.error) return setMessage(dbResult.error.message);
    setSuccess('Archivo eliminado.');
    await load();
  }

  return <section className="record-section patient-files-section">
    <div className="section-heading">
      <div><span className="eyebrow">Documentación clínica</span><h2>Archivos del paciente</h2><p className="muted">Documentos privados, con enlaces temporales y acceso controlado.</p></div>
    </div>

    {canUpload ? <form className="card patient-file-uploader" onSubmit={submit}>
      <div className="patient-file-drop"><UploadCloud size={28}/><div><strong>Selecciona un archivo</strong><small>PDF, JPG, PNG, WEBP, DOC o DOCX · máximo 10 MB</small></div><input type="file" onChange={chooseFile} accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" /></div>
      <div className="patient-file-form-grid">
        <label className="field">Nombre visible<input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Ej. Consentimiento informado" /></label>
        <label className="field">Tipo<select value={documentType} onChange={e=>setDocumentType(e.target.value)}>{documentTypes.map(type=><option key={type}>{type}</option>)}</select></label>
      </div>
      <label className="field">Descripción<textarea rows={2} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Detalle opcional" /></label>
      {file ? <div className="selected-file"><FileText size={18}/><span><strong>{file.name}</strong><small>{formatSize(file.size)}</small></span></div> : null}
      <div className="patient-file-actions"><button className="btn btn-primary" disabled={uploading}>{uploading ? 'Subiendo...' : 'Subir archivo'}</button></div>
    </form> : <div className="notice-card">Puedes consultar los archivos disponibles. La carga está reservada para la psicóloga asignada al paciente.</div>}

    {message ? <div className="error">{message}</div> : null}
    {success ? <div className="success">{success}</div> : null}

    <div className="card patient-files-list">
      {loading ? <div className="empty-state">Cargando archivos...</div> : rows.length ? rows.map(item => {
        const previewable = item.mime_type === 'application/pdf' || item.mime_type.startsWith('image/');
        return <article className="patient-file-row" key={item.id}>
          <div className="patient-file-icon">{item.mime_type.startsWith('image/') ? <ImageIcon size={21}/> : <FileText size={21}/>}</div>
          <div className="patient-file-copy"><strong>{item.display_name}</strong><span>{item.document_type} · {formatSize(item.size_bytes)}</span>{item.description ? <small>{item.description}</small> : null}</div>
          <time>{new Intl.DateTimeFormat('es-MX',{dateStyle:'medium'}).format(new Date(item.created_at))}</time>
          <div className="patient-file-row-actions">
            {previewable ? <button className="btn btn-secondary btn-small" onClick={()=>void openFile(item)} title="Vista previa"><Eye size={16}/></button> : null}
            <button className="btn btn-secondary btn-small" onClick={()=>void openFile(item,true)} title="Descargar"><Download size={16}/></button>
            {item.uploaded_by === currentUserId ? <button className="btn btn-danger btn-small" onClick={()=>void removeFile(item)} title="Eliminar"><Trash2 size={16}/></button> : null}
          </div>
        </article>;
      }) : <div className="empty-state"><FileText size={30}/><h3>No hay archivos clínicos</h3><p>Los documentos que se carguen aparecerán aquí.</p></div>}
    </div>
  </section>;
}