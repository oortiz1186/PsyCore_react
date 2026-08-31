import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req:NextRequest){
 try{
  const auth=req.headers.get('authorization');if(!auth?.startsWith('Bearer '))return NextResponse.json({error:'No autorizado.'},{status:401});
  const admin=getSupabaseAdmin();const token=auth.slice(7);const {data:{user},error:userError}=await admin.auth.getUser(token);if(userError||!user)return NextResponse.json({error:'Sesión no válida.'},{status:401});
  const body=await req.json();const appointmentId=Number(body.appointmentId);const rateId=Number(body.serviceRateId);if(!Number.isSafeInteger(appointmentId)||!Number.isSafeInteger(rateId))return NextResponse.json({error:'Datos no válidos.'},{status:400});
  const [{data:appointment,error:aError},{data:rate,error:rError}]=await Promise.all([
   admin.from('appointments').select('id,patient_id,psychologist_id,status').eq('id',appointmentId).maybeSingle(),
   admin.from('service_rates').select('id,psychologist_id,name,amount,currency,active').eq('id',rateId).maybeSingle()
  ]);
  if(aError||!appointment)return NextResponse.json({error:'Cita no encontrada.'},{status:404});if(rError||!rate||!rate.active)return NextResponse.json({error:'Tarifa no disponible.'},{status:404});
  if(appointment.psychologist_id&&appointment.psychologist_id!==user.id)return NextResponse.json({error:'No tienes acceso a esta cita.'},{status:403});if(rate.psychologist_id&&rate.psychologist_id!==user.id)return NextResponse.json({error:'No tienes acceso a esta tarifa.'},{status:403});
  const {data:existing}=await admin.from('billing_items').select('id,status').eq('appointment_id',appointmentId).eq('source','appointment_auto').neq('status','cancelled').maybeSingle();if(existing)return NextResponse.json({ok:true,created:false,billingItemId:existing.id,status:existing.status});
  const {data:item,error:insertError}=await admin.from('billing_items').insert({patient_id:appointment.patient_id,appointment_id:appointmentId,psychologist_id:user.id,service_rate_id:rate.id,concept:rate.name,amount:rate.amount,discount:0,currency:rate.currency,status:'pending',source:'appointment_auto'}).select('id,status').single();if(insertError)throw insertError;
  await admin.from('audit_events').insert({actor_user_id:user.id,action:'billing_item.created_from_appointment',entity_type:'billing_item',entity_id:String(item.id),metadata:{appointment_id:appointmentId,service_rate_id:rateId,source:'appointment_auto'}});
  return NextResponse.json({ok:true,created:true,billingItemId:item.id,status:item.status});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'No se pudo generar el cargo.'},{status:500});}
}
