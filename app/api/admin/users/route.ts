import { NextRequest,NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getSmtpSettings } from '@/lib/smtp-settings';

const ALLOWED_ROLES=['Administrador','Asistente','Psicóloga','Recepcionista'];

async function authorize(req:NextRequest){
  const token=req.headers.get('authorization')?.replace('Bearer ','');
  if(!token)return null;
  const admin=getSupabaseAdmin();
  const {data}=await admin.auth.getUser(token);
  if(!data.user)return null;
  const {data:profile}=await admin.from('profiles').select('role_id,roles(name)').eq('id',data.user.id).maybeSingle();
  const role=Array.isArray(profile?.roles)?profile.roles[0]?.name:(profile?.roles as {name?:string}|null)?.name;
  return role==='Administrador'?data.user:null;
}

function tempPassword(){return `Psy-${crypto.randomBytes(6).toString('base64url')}!9`;}

export async function POST(req:NextRequest){
  try{
    const actor=await authorize(req);
    if(!actor)return NextResponse.json({error:'No autorizado.'},{status:403});

    const {email,fullName,roleId}=await req.json();
    if(!email||!fullName||!roleId)return NextResponse.json({error:'Nombre, correo y rol son obligatorios.'},{status:400});

    const admin=getSupabaseAdmin();
    const {data:role,error:roleError}=await admin.from('roles').select('id,name').eq('id',roleId).maybeSingle();
    if(roleError||!role||!ALLOWED_ROLES.includes(role.name)){
      return NextResponse.json({error:'El rol seleccionado no está permitido.'},{status:400});
    }

    const password=tempPassword();
    const {data,error}=await admin.auth.admin.createUser({email:email.trim().toLowerCase(),password,email_confirm:true,user_metadata:{full_name:fullName}});
    if(error)return NextResponse.json({error:error.message},{status:400});

    const userId=data.user.id;
    const {error:profileError}=await admin.from('profiles').upsert({id:userId,full_name:fullName.trim(),email:email.trim().toLowerCase(),role_id:roleId,active:true,must_change_password:true});
    if(profileError){await admin.auth.admin.deleteUser(userId);return NextResponse.json({error:profileError.message},{status:400});}

    const smtp=await getSmtpSettings();
    if(smtp){
      const transport=nodemailer.createTransport({host:smtp.host,port:smtp.port,secure:smtp.secure,auth:{user:smtp.username,pass:smtp.password}});
      await transport.sendMail({from:`${smtp.fromName} <${smtp.fromEmail}>`,to:email,subject:'Tu acceso a PsyCore',html:`<h2>Bienvenida/o a PsyCore</h2><p>Tu cuenta ha sido creada.</p><p><strong>Correo:</strong> ${email}</p><p><strong>Contraseña temporal:</strong> ${password}</p><p><a href="${smtp.appUrl}/login">Ingresar a PsyCore</a></p><p>Al iniciar sesión deberás cambiar la contraseña.</p>`});
    }

    return NextResponse.json({id:userId,email,passwordSent:Boolean(smtp)});
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:'Error inesperado.'},{status:500});
  }
}
