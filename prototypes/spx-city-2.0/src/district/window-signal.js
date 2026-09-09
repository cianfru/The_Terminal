import {walletSignal} from '../model.js';
// Wallet meaning and signal strength are shared across rendering detail levels.
export function windowSignal(wallet,flowMax=1,time='dusk'){
 const flow=wallet.flow/(flowMax||1),direction=Math.abs(flow)>.04?Math.sign(flow):0;
 return {direction,color:direction?(direction>0?0x36df8d:0xf26c82):walletSignal(wallet,1).age,intensity:time==='day'?1.5:time==='night'?2.8:2.1};
}
