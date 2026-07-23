import { NextRequest,NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getSmtpSettings } from '@/lib/smtp-settings';

async function adminOnly(req:NextRequest){
  const token=req.headers.get('authorization')?.replace('Bearer ','');
  if(!token)return false;
  const a=getSupabaseAdmin();
  const {data}=await a.auth.getUser(token);
  if(!data.user)return false;
  const {data:p}=await a.from('profiles').select('roles(name)').eq('id',data.user.id).maybeSingle();
  const role=Array.isArray(p?.roles)?p.roles[0]?.name:(p?.roles as {name?:string}|null)?.name;
  return role==='Administrador';
}

export async function POST(req:NextRequest){
  if(!await adminOnly(req))return NextResponse.json({error:'No autorizado.'},{status:403});
  const {to}=await req.json();

  try{
    const smtp=await getSmtpSettings();
    if(!smtp)return NextResponse.json({error:'Primero guarda la configuración SMTP.'},{status:400});

    const transport=nodemailer.createTransport({host:smtp.host,port:smtp.port,secure:smtp.secure,auth:{user:smtp.username,pass:smtp.password}});
    await transport.sendMail({from:`${smtp.fromName} <${smtp.fromEmail}>`,to,subject:'Prueba SMTP de PsyCore',html:'<h2>Configuración correcta</h2><p>PsyCore puede enviar correos.</p>'});
    return NextResponse.json({ok:true});
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:'No se pudo enviar.'},{status:500});
  }
}
