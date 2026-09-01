import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

async function currentUser(req:NextRequest){
 const auth=req.headers.get('authorization');if(!auth?.startsWith('Bearer '))return null;
 const admin=getSupabaseAdmin();const {data:{user}}=await admin.auth.getUser(auth.slice(7));return user||null;
}

export async function POST(req:NextRequest){
 try{
  const user=await currentUser(req);if(!user)return NextResponse.json({error:'No autorizado.'},{status:401});
  const body=await req.json();const paymentId=Number(body.paymentId);if(!Number.isSafeInteger(paymentId)||paymentId<=0)return NextResponse.json({error:'Pago no válido.'},{status:400});
  const admin=getSupabaseAdmin();
  const {data:payment,error}=await admin.from('payments').select('id,amount,payment_method,reference,paid_at,billing_item_id,billing_items(id,patient_id,psychologist_id,concept,amount,discount,currency,patients(first_name,last_name,email))').eq('id',paymentId).maybeSingle();
  if(error||!payment)return NextResponse.json({error:'Pago no encontrado.'},{status:404});
  const item=Array.isArray(payment.billing_items)?payment.billing_items[0]:payment.billing_items;if(!item)return NextResponse.json({error:'Cargo asociado no disponible.'},{status:404});
  if(item.psychologist_id&&item.psychologist_id!==user.id)return NextResponse.json({error:'No tienes acceso a este pago.'},{status:403});
  const existing=await admin.from('payment_receipts').select('id,receipt_number,issued_at,notes').eq('payment_id',paymentId).maybeSingle();
  if(existing.data)return NextResponse.json({ok:true,created:false,receipt:existing.data,payment,item});
  const paidDate=new Date(payment.paid_at||Date.now());const stamp=`${paidDate.getFullYear()}${String(paidDate.getMonth()+1).padStart(2,'0')}${String(paidDate.getDate()).padStart(2,'0')}`;const receiptNumber=`REC-${stamp}-${String(paymentId).padStart(6,'0')}`;
  const {data:receipt,error:insertError}=await admin.from('payment_receipts').insert({payment_id:paymentId,receipt_number:receiptNumber,issued_by:user.id,notes:typeof body.notes==='string'?body.notes.trim().slice(0,1000)||null:null}).select('id,receipt_number,issued_at,notes').single();if(insertError)throw insertError;
  await admin.from('audit_events').insert({actor_id:user.id,action:'payment_receipt.issued',entity_type:'payment_receipt',entity_id:String(receipt.id),patient_id:item.patient_id,metadata:{payment_id:paymentId,billing_item_id:item.id,receipt_number:receiptNumber}});
  return NextResponse.json({ok:true,created:true,receipt,payment,item});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'No se pudo generar el recibo.'},{status:500});}
}
