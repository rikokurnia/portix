import { evmFundingAddress } from '@/lib/evm-funding';
export const runtime='nodejs';
export async function GET(request:Request){
 try {const address=new URL(request.url).searchParams.get('address')??'';return Response.json({evmAddress:address,substrateFundingAddress:evmFundingAddress(address)});}
 catch{return Response.json({error:'Enter a valid EVM address starting with 0x.'},{status:400});}
}
